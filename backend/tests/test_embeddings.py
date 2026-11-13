import os

import numpy as np
import pytest

from app.core.config import Settings
from app.services.processing.embeddings import EmbeddingError, EmbeddingService


class _FakeModel:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def encode(self, texts, **kwargs):
        self.calls.append({"texts": texts, "kwargs": kwargs})
        return np.ones((len(texts), 384), dtype=np.float32) / np.sqrt(384)


def test_embedding_service_uses_consistent_normalized_encoding(monkeypatch):
    fake_model = _FakeModel()
    monkeypatch.setattr("sentence_transformers.SentenceTransformer", lambda name: fake_model)
    service = EmbeddingService(
        Settings(
            embedding_model="sentence-transformers/all-MiniLM-L6-v2",
            embedding_dimension=384,
            database_url="sqlite://",
        )
    )
    documents = service.embed_documents(["first text", "second text"])
    query = service.embed_query("question text")
    assert len(documents) == 2
    assert len(query) == 384
    assert len(fake_model.calls) == 2
    for call in fake_model.calls:
        assert call["kwargs"]["normalize_embeddings"] is True
        assert call["kwargs"]["convert_to_numpy"] is True
    assert service._model is fake_model


def test_embedding_service_rejects_empty_text(monkeypatch):
    monkeypatch.setattr("sentence_transformers.SentenceTransformer", lambda name: _FakeModel())
    service = EmbeddingService(Settings(database_url="sqlite://"))
    with pytest.raises(EmbeddingError):
        service.embed_query("   ")
    with pytest.raises(EmbeddingError):
        service.embed_documents([""])


def test_embedding_dimension_mismatch_fails(monkeypatch):
    class WrongDimensionModel(_FakeModel):
        def encode(self, texts, **kwargs):
            return np.ones((len(texts), 128), dtype=np.float32)

    monkeypatch.setattr(
        "sentence_transformers.SentenceTransformer", lambda name: WrongDimensionModel()
    )
    service = EmbeddingService(Settings(database_url="sqlite://"))
    with pytest.raises(EmbeddingError):
        service.embed_query("text")


@pytest.mark.skipif(
    os.environ.get("RUN_MODEL_TESTS") != "1",
    reason="Set RUN_MODEL_TESTS=1 to download and exercise the real MiniLM model",
)
def test_real_minilm_model_smoke():
    service = EmbeddingService(Settings(database_url="sqlite://"))
    vectors = service.embed_documents(
        ["LSTMs are recurrent neural networks.", "Cats are popular pets."]
    )
    assert len(vectors) == 2
    assert len(vectors[0]) == 384
    assert vectors[0] != vectors[1]
    query = service.embed_query("What are LSTMs?")
    dot_first = sum(a * b for a, b in zip(query, vectors[0], strict=True))
    dot_second = sum(a * b for a, b in zip(query, vectors[1], strict=True))
    assert dot_first > dot_second
