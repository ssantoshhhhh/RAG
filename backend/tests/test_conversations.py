from fastapi.testclient import TestClient

from tests.conftest import csrf_headers, register_user, upload_txt


def _create_conversation(client: TestClient, **payload) -> dict:
    response = client.post("/api/v1/conversations", json=payload, headers=csrf_headers(client))
    assert response.status_code == 201, response.text
    return response.json()


def test_conversation_crud(client: TestClient):
    register_user(client)
    conversation = _create_conversation(client, title="My research")
    assert conversation["title"] == "My research"

    listing = client.get("/api/v1/conversations")
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    detail = client.get(f"/api/v1/conversations/{conversation['id']}")
    assert detail.status_code == 200
    assert detail.json()["messages"] == []

    renamed = client.patch(
        f"/api/v1/conversations/{conversation['id']}",
        json={"title": "Renamed chat"},
        headers=csrf_headers(client),
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Renamed chat"

    deleted = client.delete(
        f"/api/v1/conversations/{conversation['id']}", headers=csrf_headers(client)
    )
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/conversations/{conversation['id']}").status_code == 404


def test_create_conversation_rejects_foreign_document(client: TestClient):
    register_user(client)
    upload = upload_txt(client, "Alice document.")
    document_id = upload.json()[0]["id"]

    with TestClient(client.app) as bob:
        register_user(bob, email="bob@example.com", name="Bob")
        response = bob.post(
            "/api/v1/conversations",
            json={"document_ids": [document_id]},
            headers=csrf_headers(bob),
        )
        assert response.status_code == 400


def test_conversations_are_isolated_per_user(client: TestClient):
    register_user(client)
    conversation = _create_conversation(client)
    with TestClient(client.app) as bob:
        register_user(bob, email="bob@example.com", name="Bob")
        assert bob.get(f"/api/v1/conversations/{conversation['id']}").status_code == 404
        assert bob.get("/api/v1/conversations").json() == []
        assert (
            bob.patch(
                f"/api/v1/conversations/{conversation['id']}",
                json={"title": "Hijack"},
                headers=csrf_headers(bob),
            ).status_code
            == 404
        )
        assert (
            bob.post(
                "/api/v1/chat/ask",
                json={"question": "Hello?", "conversation_id": conversation["id"]},
                headers=csrf_headers(bob),
            ).status_code
            == 404
        )


def test_ask_creates_conversation_messages_and_sources(client: TestClient, fake_llm):
    register_user(client)
    upload = upload_txt(
        client,
        "LSTMs are recurrent neural networks. They are used for sequence modeling. "
        "Retrieval augmented generation uses retrieved documents.",
    )
    document_id = upload.json()[0]["id"]

    response = client.post(
        "/api/v1/chat/ask",
        json={"question": "What are LSTMs?", "document_ids": [document_id]},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["conversation"]["title"].startswith("What are LSTMs?")
    assert payload["user_message"]["role"] == "user"
    assert payload["assistant_message"]["role"] == "assistant"
    assert payload["assistant_message"]["content"] == fake_llm.answer
    sources = payload["assistant_message"]["sources"]
    assert sources and sources[0]["document_id"] == document_id
    assert sources[0]["chunk_id"]
    assert sources[0]["excerpt"]
    assert payload["conversation"]["document_ids"] == [document_id]

    conversation_id = payload["conversation"]["id"]
    detail = client.get(f"/api/v1/conversations/{conversation_id}").json()
    assert len(detail["messages"]) == 2
    assert detail["messages"][0]["content"] == "What are LSTMs?"

    second = client.post(
        "/api/v1/chat/ask",
        json={"question": "Tell me more", "conversation_id": conversation_id},
        headers=csrf_headers(client),
    )
    assert second.status_code == 200
    assert len(fake_llm.calls) == 2
    history = fake_llm.calls[1]["history"]
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"


def test_ask_insufficient_when_no_documents(client: TestClient, fake_llm):
    register_user(client)
    response = client.post(
        "/api/v1/chat/ask",
        json={"question": "What is the meaning of life?"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200
    payload = response.json()
    assert "couldn't find the answer" in payload["assistant_message"]["content"].lower()
    assert payload["assistant_message"]["sources"] is None
    assert fake_llm.calls == []


def test_ask_rejects_foreign_documents(client: TestClient):
    register_user(client)
    upload = upload_txt(client, "Alice private knowledge.")
    document_id = upload.json()[0]["id"]
    with TestClient(client.app) as bob:
        register_user(bob, email="bob@example.com", name="Bob")
        response = bob.post(
            "/api/v1/chat/ask",
            json={"question": "What is the private knowledge?", "document_ids": [document_id]},
            headers=csrf_headers(bob),
        )
        assert response.status_code == 400


def test_ask_validation(client: TestClient):
    register_user(client)
    response = client.post(
        "/api/v1/chat/ask",
        json={"question": "x"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 422
