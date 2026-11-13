import uuid

import pytest

from app.core import services as core_services
from app.services.llm_service import INSUFFICIENT_ANSWER, LLMError
from app.services.processing.types import ChunkDraft
from app.services.rag_service import RAGError, RAGService
from tests.fakes import FakeEmbeddingService, FakeLLMService


@pytest.fixture
def embedder() -> FakeEmbeddingService:
    return FakeEmbeddingService()


@pytest.fixture
def store():
    return core_services.get_vector_store_service()


def _seed(store, embedder, user_id: uuid.UUID, doc_id: uuid.UUID, texts: list[str]):
    chunks = [
        ChunkDraft(
            text=text,
            token_count=len(text.split()),
            page_number=index + 1,
            page_end=index + 1,
            chunk_index=index,
        )
        for index, text in enumerate(texts)
    ]
    store.add_chunks(
        user_id=user_id,
        document_id=doc_id,
        filename="ai.txt",
        chunks=chunks,
        embeddings=embedder.embed_documents(texts),
        chunk_ids=[uuid.uuid4() for _ in texts],
    )


def test_rag_returns_validated_sources(store, embedder):
    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    _seed(
        store,
        embedder,
        user_id,
        doc_id,
        [
            "LSTMs are recurrent neural networks designed for sequence data.",
            "The weather in Paris is often mild in spring.",
        ],
    )
    llm = FakeLLMService()
    rag = RAGService(embedding_service=embedder, vector_store=store, llm_service=llm)

    result = rag.answer_question(user_id=user_id, question="What are LSTMs?", document_ids=[doc_id])
    assert result.answer == llm.answer
    assert len(result.sources) == 1
    source = result.sources[0]
    assert source.chunk_id
    assert source.document_id == str(doc_id)
    assert source.filename == "ai.txt"
    assert source.page_number == 1
    assert len(source.excerpt) > 0
    assert result.used_llm is True


def test_rag_discards_invented_citations(store, embedder):
    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    _seed(store, embedder, user_id, doc_id, ["Grounded source text."])
    llm = FakeLLMService()
    llm.cited_labels = ["S99"]
    rag = RAGService(embedding_service=embedder, vector_store=store, llm_service=llm)

    result = rag.answer_question(user_id=user_id, question="What is grounded?")
    retrieved_ids = {source.chunk_id for source in result.sources}
    assert retrieved_ids
    assert "S99" not in retrieved_ids
    assert result.sources[0].document_id == str(doc_id)


def test_rag_insufficient_when_no_chunks(store, embedder):
    llm = FakeLLMService()
    rag = RAGService(embedding_service=embedder, vector_store=store, llm_service=llm)
    result = rag.answer_question(user_id=uuid.uuid4(), question="What is the answer?")
    assert result.answer == INSUFFICIENT_ANSWER
    assert result.sources == []
    assert result.used_llm is False
    assert llm.calls == []


def test_rag_maps_insufficient_model_answer_to_no_sources(store, embedder):
    user_id = uuid.uuid4()
    _seed(store, embedder, user_id, uuid.uuid4(), ["Some unrelated content."])
    llm = FakeLLMService()
    llm.answer = "I couldn't find the answer in the provided documents."
    rag = RAGService(embedding_service=embedder, vector_store=store, llm_service=llm)
    result = rag.answer_question(user_id=user_id, question="Unknown topic?")
    assert result.answer == INSUFFICIENT_ANSWER
    assert result.sources == []


def test_rag_propagates_llm_errors(store, embedder):
    user_id = uuid.uuid4()
    _seed(store, embedder, user_id, uuid.uuid4(), ["Some content."])
    llm = FakeLLMService()
    llm.error = LLMError("Rate limited", status_code=429)
    rag = RAGService(embedding_service=embedder, vector_store=store, llm_service=llm)
    with pytest.raises(RAGError) as exc_info:
        rag.answer_question(user_id=user_id, question="Any question?")
    assert exc_info.value.status_code == 429


def test_rag_respects_user_isolation(store, embedder):
    alice = uuid.uuid4()
    bob = uuid.uuid4()
    _seed(store, embedder, alice, uuid.uuid4(), ["Alice secret research notes."])
    llm = FakeLLMService()
    rag = RAGService(embedding_service=embedder, vector_store=store, llm_service=llm)
    result = rag.answer_question(user_id=bob, question="What are Alice's notes?")
    assert result.sources == []
    assert result.used_llm is False


def test_rag_rejects_too_short_question(store, embedder):
    rag = RAGService(embedding_service=embedder, vector_store=store, llm_service=FakeLLMService())
    with pytest.raises(RAGError) as exc_info:
        rag.answer_question(user_id=uuid.uuid4(), question="x")
    assert exc_info.value.status_code == 400


@pytest.mark.parametrize(
    "greeting", ["hi", "Hello!", "hey there", "good morning", "Namaste", "hi documind"]
)
def test_rag_greeting_prompts_for_questions_without_retrieval(store, embedder, greeting):
    llm = FakeLLMService()
    rag = RAGService(embedding_service=embedder, vector_store=store, llm_service=llm)
    result = rag.answer_question(
        user_id=uuid.uuid4(), question=greeting, document_ids=[uuid.uuid4()]
    )
    assert "selected PDF" in result.answer
    assert "page-level citations" in result.answer
    assert result.sources == []
    assert result.used_llm is False
    assert llm.calls == []


def test_rag_greeting_without_selected_documents(store, embedder):
    rag = RAGService(
        embedding_service=embedder, vector_store=store, llm_service=FakeLLMService()
    )
    result = rag.answer_question(user_id=uuid.uuid4(), question="hello")
    assert "your documents" in result.answer
    assert result.sources == []


def test_rag_greeting_followed_by_question_is_not_a_greeting(store, embedder):
    user_id = uuid.uuid4()
    _seed(store, embedder, user_id, uuid.uuid4(), ["LSTMs are recurrent neural networks."])
    llm = FakeLLMService()
    rag = RAGService(embedding_service=embedder, vector_store=store, llm_service=llm)
    result = rag.answer_question(user_id=user_id, question="hi what are LSTMs?")
    assert llm.calls
    assert result.used_llm is True
