import uuid

import pytest

from app.core import services as core_services
from app.core.config import Settings
from app.services.processing.types import ChunkDraft
from app.services.processing.vector_store import VectorStoreService
from tests.fakes import FakeEmbeddingService


def _chunk(text: str, index: int) -> ChunkDraft:
    return ChunkDraft(
        text=text,
        token_count=len(text.split()),
        page_number=1,
        page_end=1,
        chunk_index=index,
    )


@pytest.fixture
def store() -> VectorStoreService:
    return core_services.get_vector_store_service()


@pytest.fixture
def embedder() -> FakeEmbeddingService:
    return FakeEmbeddingService()


def test_add_search_and_filter_by_user(store, embedder):
    alice = uuid.uuid4()
    bob = uuid.uuid4()
    alice_doc = uuid.uuid4()
    bob_doc = uuid.uuid4()
    chunks = [_chunk("Retrieval augmented generation combines search and generation.", 0)]
    embedding = embedder.embed_documents([chunks[0].text])

    store.add_chunks(
        user_id=alice,
        document_id=alice_doc,
        filename="alice.txt",
        chunks=chunks,
        embeddings=embedding,
        chunk_ids=[uuid.uuid4()],
    )
    store.add_chunks(
        user_id=bob,
        document_id=bob_doc,
        filename="bob.txt",
        chunks=[_chunk("Bob private content about cooking.", 0)],
        embeddings=embedder.embed_documents(["Bob private content about cooking."]),
        chunk_ids=[uuid.uuid4()],
    )

    query = embedder.embed_query("retrieval generation")
    alice_results = store.search(
        user_id=alice, query_embedding=query, top_k=10, similarity_threshold=0
    )
    assert len(alice_results) == 1
    assert alice_results[0].document_id == str(alice_doc)

    bob_results = store.search(user_id=bob, query_embedding=query, top_k=10, similarity_threshold=0)
    assert len(bob_results) == 1
    assert bob_results[0].document_id == str(bob_doc)

    filtered = store.search(
        user_id=alice,
        query_embedding=query,
        top_k=10,
        similarity_threshold=0,
        document_ids=[uuid.uuid4()],
    )
    assert filtered == []


def test_delete_only_removes_target_document(store, embedder):
    user_id = uuid.uuid4()
    doc_one = uuid.uuid4()
    doc_two = uuid.uuid4()
    for doc_id, text in ((doc_one, "first text"), (doc_two, "second text")):
        store.add_chunks(
            user_id=user_id,
            document_id=doc_id,
            filename=f"{doc_id}.txt",
            chunks=[_chunk(text, 0)],
            embeddings=embedder.embed_documents([text]),
            chunk_ids=[uuid.uuid4()],
        )

    store.delete_document_chunks(user_id=user_id, document_id=doc_one)
    assert store.count_document_chunks(user_id=user_id, document_id=doc_one) == 0
    assert store.count_document_chunks(user_id=user_id, document_id=doc_two) == 1


def test_threshold_filters_unrelated_results(store, embedder):
    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    store.add_chunks(
        user_id=user_id,
        document_id=doc_id,
        filename="a.txt",
        chunks=[_chunk("apples and oranges", 0)],
        embeddings=embedder.embed_documents(["apples and oranges"]),
        chunk_ids=[uuid.uuid4()],
    )
    results = store.search(
        user_id=user_id,
        query_embedding=embedder.embed_query("quantum physics"),
        top_k=5,
        similarity_threshold=1.01,
    )
    assert results == []


def test_empty_store_returns_no_results(store, embedder):
    results = store.search(
        user_id=uuid.uuid4(),
        query_embedding=embedder.embed_query("anything"),
        top_k=5,
        similarity_threshold=0,
    )
    assert results == []


def test_vectors_persist_across_new_client(tmp_path):
    settings = Settings(
        data_dir=tmp_path / "data",
        chroma_persist_dir=tmp_path / "chroma",
        database_url=f"sqlite:///{tmp_path / 'persist.db'}",
        chroma_collection=f"persist_test_{uuid.uuid4().hex}",
    )
    embedder = FakeEmbeddingService()
    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    first = VectorStoreService(settings)
    first.add_chunks(
        user_id=user_id,
        document_id=doc_id,
        filename="persist.txt",
        chunks=[_chunk("Persistent content survives restarts.", 0)],
        embeddings=embedder.embed_documents(["Persistent content survives restarts."]),
        chunk_ids=[uuid.uuid4()],
    )

    second = VectorStoreService(settings)
    assert second.count_document_chunks(user_id=user_id, document_id=doc_id) == 1
    results = second.search(
        user_id=user_id,
        query_embedding=embedder.embed_query("persistent content"),
        top_k=1,
        similarity_threshold=0,
    )
    assert results and results[0].document_id == str(doc_id)
