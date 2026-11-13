import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

TEST_ROOT = Path(tempfile.mkdtemp(prefix="documind-tests-"))

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_ROOT / 'test.db'}"
os.environ["DATA_DIR"] = str(TEST_ROOT / "data")
os.environ["CHROMA_PERSIST_DIR"] = str(TEST_ROOT / "chroma")
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-tests"
os.environ["LLM_PROVIDER"] = "gemini"
os.environ["GEMINI_API_KEY"] = ""
os.environ["SIMILARITY_THRESHOLD"] = "0"
os.environ["COOKIE_SECURE"] = "false"
os.environ["ENVIRONMENT"] = "test"

from app.core import services as core_services  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import pipeline  # noqa: E402
from tests.fakes import FakeEmbeddingService, FakeLLMService  # noqa: E402


@pytest.fixture
def fake_llm() -> FakeLLMService:
    return FakeLLMService()


@pytest.fixture(autouse=True)
def isolated_state(monkeypatch, fake_llm):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    vector_store = core_services.get_vector_store_service()
    ids = vector_store.collection.get().get("ids", [])
    if ids:
        vector_store.collection.delete(ids=ids)

    fake_embeddings = FakeEmbeddingService()
    monkeypatch.setattr(core_services, "get_embedding_service", lambda: fake_embeddings)
    monkeypatch.setattr(core_services, "get_llm_service", lambda: fake_llm)
    monkeypatch.setattr(pipeline, "get_embedding_service", lambda: fake_embeddings)

    yield


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def register_user(
    client: TestClient,
    *,
    email: str = "alice@example.com",
    password: str = "Password123",
    name: str = "Alice",
) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": name},
    )
    assert response.status_code == 201, response.text
    return response.json()


def csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("dm_csrf")
    assert token, "CSRF cookie missing"
    return {"X-CSRF-Token": token}


def upload_txt(client: TestClient, content: str, filename: str = "notes.txt"):
    return client.post(
        "/api/v1/documents/upload",
        files={"files": (filename, content.encode("utf-8"), "text/plain")},
        headers=csrf_headers(client),
    )


def make_pdf(text: str | None = "Hello from DocuMind.") -> bytes:
    import pymupdf

    document = pymupdf.open()
    page = document.new_page()
    if text:
        page.insert_text((72, 72), text)
    data = document.tobytes()
    document.close()
    return data
