import uuid

from fastapi.testclient import TestClient

from app.core import services as core_services
from tests.conftest import csrf_headers, make_pdf, register_user, upload_txt


def test_upload_and_process_txt_document(client: TestClient):
    register_user(client)
    content = "DocuMind indexes documents. " * 120
    response = upload_txt(client, content, "notes.txt")
    assert response.status_code == 201, response.text
    document = response.json()[0]
    assert document["filename"] == "notes.txt"

    detail = client.get(f"/api/v1/documents/{document['id']}")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["status"] == "INDEXED"
    assert payload["chunk_count"] > 0
    assert payload["page_count"] == 1
    assert payload["failure_message"] is None


def test_upload_pdf_and_preview(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/documents/upload",
        files={
            "files": (
                "paper.pdf",
                make_pdf("Retrieval augmented generation works."),
                "application/pdf",
            )
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text
    document = response.json()[0]
    detail = client.get(f"/api/v1/documents/{document['id']}").json()
    assert detail["status"] == "INDEXED"
    assert detail["file_type"] == "pdf"

    preview = client.get(f"/api/v1/documents/{document['id']}/preview")
    assert preview.status_code == 200
    pages = preview.json()["pages"]
    assert pages and pages[0]["page_number"] == 1
    assert "Retrieval augmented generation" in pages[0]["text"]

    file_response = client.get(f"/api/v1/documents/{document['id']}/file")
    assert file_response.status_code == 200
    assert file_response.headers["content-type"].startswith("application/pdf")


def test_blank_pdf_fails_and_can_be_retried(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/documents/upload",
        files={"files": ("blank.pdf", make_pdf(None), "application/pdf")},
        headers=csrf_headers(client),
    )
    assert response.status_code == 201
    document_id = response.json()[0]["id"]

    detail = client.get(f"/api/v1/documents/{document_id}").json()
    assert detail["status"] == "FAILED"
    assert "extractable text" in detail["failure_message"].lower()

    retry = client.post(f"/api/v1/documents/{document_id}/retry", headers=csrf_headers(client))
    assert retry.status_code == 200
    assert client.get(f"/api/v1/documents/{document_id}").json()["status"] == "FAILED"


def test_retry_rejects_indexed_document(client: TestClient):
    register_user(client)
    upload = upload_txt(client, "Some content for a document.")
    document_id = upload.json()[0]["id"]
    response = client.post(f"/api/v1/documents/{document_id}/retry", headers=csrf_headers(client))
    assert response.status_code == 409


def test_rejects_unsupported_and_invalid_files(client: TestClient):
    register_user(client)
    headers = csrf_headers(client)
    response = client.post(
        "/api/v1/documents/upload",
        files={"files": ("notes.md", b"# hello", "text/markdown")},
        headers=headers,
    )
    assert response.status_code == 400

    response = client.post(
        "/api/v1/documents/upload",
        files={"files": ("fake.pdf", b"not a pdf at all", "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 400

    response = client.post(
        "/api/v1/documents/upload",
        files={"files": ("empty.txt", b"", "text/plain")},
        headers=headers,
    )
    assert response.status_code == 400


def test_rejects_files_over_ten_megabytes(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/documents/upload",
        files={"files": ("big.txt", b"a" * (10 * 1024 * 1024 + 1), "text/plain")},
        headers=csrf_headers(client),
    )
    assert response.status_code == 413


def test_upload_requires_csrf(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/documents/upload",
        files={"files": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 403


def test_multiple_uploads(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/documents/upload",
        files=[
            ("files", ("one.txt", b"First document about cats.", "text/plain")),
            ("files", ("two.txt", b"Second document about dogs.", "text/plain")),
        ],
        headers=csrf_headers(client),
    )
    assert response.status_code == 201
    assert len(response.json()) == 2
    listing = client.get("/api/v1/documents").json()
    assert len(listing) == 2


def test_delete_document_removes_vectors_and_chunks(client: TestClient):
    register_user(client)
    upload = upload_txt(client, "Vectors must disappear when a document is deleted. " * 20)
    document = upload.json()[0]
    user_id = uuid.UUID(client.get("/api/v1/auth/me").json()["id"])
    vector_store = core_services.get_vector_store_service()
    assert (
        vector_store.count_document_chunks(user_id=user_id, document_id=uuid.UUID(document["id"]))
        > 0
    )

    response = client.delete(f"/api/v1/documents/{document['id']}", headers=csrf_headers(client))
    assert response.status_code == 204
    assert client.get(f"/api/v1/documents/{document['id']}").status_code == 404
    assert (
        vector_store.count_document_chunks(user_id=user_id, document_id=uuid.UUID(document["id"]))
        == 0
    )


def test_documents_are_isolated_per_user(client: TestClient):
    register_user(client)
    upload = upload_txt(client, "Alice private document content.")
    document_id = upload.json()[0]["id"]

    with TestClient(client.app) as bob_client:
        register_user(bob_client, email="bob@example.com", name="Bob")
        assert bob_client.get(f"/api/v1/documents/{document_id}").status_code == 404
        assert bob_client.get(f"/api/v1/documents/{document_id}/preview").status_code == 404
        assert (
            bob_client.delete(
                f"/api/v1/documents/{document_id}", headers=csrf_headers(bob_client)
            ).status_code
            == 404
        )
        assert bob_client.get("/api/v1/documents").json() == []


def test_dashboard_stats_reflect_real_data(client: TestClient):
    register_user(client)
    upload_txt(client, "Dashboard statistics content.")
    stats = client.get("/api/v1/dashboard/stats")
    assert stats.status_code == 200
    payload = stats.json()
    assert payload["document_count"] == 1
    assert payload["indexed_document_count"] == 1
    assert payload["chunk_count"] > 0
    assert payload["recent_documents"][0]["filename"] == "notes.txt"


def test_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["database"] == "ok"
    assert payload["vector_store"] == "ok"
    assert payload["llm_provider"] == "gemini"
    assert payload["llm_configured"] is False
    assert payload["llm_available"] is False


def test_security_headers_present(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "SAMEORIGIN"
