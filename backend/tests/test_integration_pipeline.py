import uuid

import pymupdf
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core import services as core_services
from app.db.session import SessionLocal
from app.main import app
from app.models import DocumentChunk
from tests.conftest import csrf_headers, register_user


def _multi_page_pdf() -> bytes:
    document = pymupdf.open()
    for page_number in (1, 2):
        page = document.new_page()
        text = " ".join(
            f"Page {page_number} sentence {index} explains retrieval augmented generation "
            "and how vector databases support semantic search."
            for index in range(30)
        )
        page.insert_textbox(pymupdf.Rect(50, 50, 550, 750), text, fontsize=9)
    data = document.tobytes()
    document.close()
    return data


def test_end_to_end_upload_ask_delete(client: TestClient, fake_llm):
    register_user(client)
    upload = client.post(
        "/api/v1/documents/upload",
        files={"files": ("rag.pdf", _multi_page_pdf(), "application/pdf")},
        headers=csrf_headers(client),
    )
    assert upload.status_code == 201, upload.text
    document_id = upload.json()[0]["id"]

    document = client.get(f"/api/v1/documents/{document_id}").json()
    assert document["status"] == "INDEXED"
    assert document["page_count"] == 2
    assert document["chunk_count"] >= 2

    with SessionLocal() as db:
        stored = db.scalar(
            select(func.count(DocumentChunk.id)).where(
                DocumentChunk.document_id == uuid.UUID(document_id)
            )
        )
        assert stored == document["chunk_count"]
        pages = set(
            db.scalars(
                select(DocumentChunk.page_number).where(
                    DocumentChunk.document_id == uuid.UUID(document_id)
                )
            ).all()
        )
        assert 1 in pages and 2 in pages

    preview = client.get(f"/api/v1/documents/{document_id}/preview").json()
    assert len(preview["pages"]) == 2

    ask = client.post(
        "/api/v1/chat/ask",
        json={
            "question": "How do vector databases support semantic search?",
            "document_ids": [document_id],
        },
        headers=csrf_headers(client),
    )
    assert ask.status_code == 200, ask.text
    payload = ask.json()
    sources = payload["assistant_message"]["sources"]
    assert sources
    assert all(source["document_id"] == document_id for source in sources)
    assert all(source["page_number"] in (1, 2) for source in sources)
    assert fake_llm.calls
    assert fake_llm.calls[0]["sources"]

    conversation_id = payload["conversation"]["id"]
    user_id = uuid.UUID(client.get("/api/v1/auth/me").json()["id"])
    vector_store = core_services.get_vector_store_service()
    assert (
        vector_store.count_document_chunks(user_id=user_id, document_id=uuid.UUID(document_id))
        == document["chunk_count"]
    )

    deleted = client.delete(f"/api/v1/documents/{document_id}", headers=csrf_headers(client))
    assert deleted.status_code == 204

    with SessionLocal() as db:
        remaining = db.scalar(
            select(func.count(DocumentChunk.id)).where(
                DocumentChunk.document_id == uuid.UUID(document_id)
            )
        )
        assert remaining == 0
    assert (
        vector_store.count_document_chunks(user_id=user_id, document_id=uuid.UUID(document_id)) == 0
    )

    follow_up = client.post(
        "/api/v1/chat/ask",
        json={"question": "What did the deleted document say?", "conversation_id": conversation_id},
        headers=csrf_headers(client),
    )
    assert follow_up.status_code == 200
    assert "couldn't find the answer" in follow_up.json()["assistant_message"]["content"].lower()


def test_data_survives_client_restart(fake_llm):
    with TestClient(app) as first:
        register_user(first, email="restart@example.com", name="Restart")
        upload = first.post(
            "/api/v1/documents/upload",
            files={
                "files": (
                    "restart.txt",
                    b"Persistent document content about embedding models.",
                    "text/plain",
                )
            },
            headers=csrf_headers(first),
        )
        assert upload.status_code == 201
        document_id = upload.json()[0]["id"]

    with TestClient(app) as second:
        login = second.post(
            "/api/v1/auth/login",
            json={"email": "restart@example.com", "password": "Password123"},
        )
        assert login.status_code == 200
        documents = second.get("/api/v1/documents").json()
        assert len(documents) == 1
        assert documents[0]["id"] == document_id
        assert documents[0]["status"] == "INDEXED"

        answer = second.post(
            "/api/v1/chat/ask",
            json={"question": "What is the document about?", "document_ids": [document_id]},
            headers=csrf_headers(second),
        )
        assert answer.status_code == 200
        assert answer.json()["assistant_message"]["sources"]
