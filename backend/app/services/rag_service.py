import logging
import re
import uuid
from dataclasses import dataclass, field

from app.core.config import Settings, get_settings
from app.schemas.conversation import SourceOut
from app.services.llm_service import INSUFFICIENT_ANSWER, LLMError, LLMService
from app.services.processing.embeddings import EmbeddingError, EmbeddingService
from app.services.processing.types import RetrievedChunk
from app.services.processing.vector_store import VectorStoreError, VectorStoreService

logger = logging.getLogger(__name__)

_GREETING_TOKENS = frozenset(
    {
        "hi",
        "hii",
        "hiii",
        "hello",
        "hey",
        "heyy",
        "yo",
        "hola",
        "namaste",
        "greetings",
        "hiya",
        "sup",
        "howdy",
    }
)
_GREETING_PHRASES = frozenset(
    {"good morning", "good afternoon", "good evening", "good day"}
)
_GREETING_SUFFIXES = frozenset(
    {"there", "everyone", "all", "team", "folks", "friend", "documind"}
)


def _is_greeting(message: str) -> bool:
    if "?" in message:
        return False
    normalized = re.sub(r"[^a-z\s]", " ", message.lower())
    tokens = normalized.split()
    if not tokens:
        return False
    if " ".join(tokens) in _GREETING_PHRASES:
        return True
    return tokens[0] in _GREETING_TOKENS and all(
        token in _GREETING_SUFFIXES for token in tokens[1:]
    )


def _greeting_answer(document_ids: list[uuid.UUID] | None) -> str:
    if document_ids:
        target = "selected PDF" if len(document_ids) == 1 else "selected PDFs"
        return (
            f"Hi! I'm ready. Ask your questions based on the {target} and I'll "
            "answer with page-level citations."
        )
    return (
        "Hi! I'm ready. Ask your questions based on your documents and I'll "
        "answer with page-level citations."
    )


INSUFFICIENT_MARKERS = (
    "couldn't find the answer",
    "could not find the answer",
    "cannot find the answer",
    "can't find the answer",
    "not enough information",
    "insufficient information",
    "does not contain enough information",
    "do not contain enough information",
    "not mentioned in the provided",
    "no relevant information",
)


class RAGError(Exception):
    def __init__(self, message: str, status_code: int = 503) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class RagAnswer:
    answer: str
    sources: list[SourceOut] = field(default_factory=list)
    retrieved_count: int = 0
    used_llm: bool = False


class RAGService:
    def __init__(
        self,
        *,
        embedding_service: EmbeddingService | None = None,
        vector_store: VectorStoreService | None = None,
        llm_service: LLMService | None = None,
        settings: Settings | None = None,
    ) -> None:
        # Imports are local to avoid pulling heavy model code into app startup.
        from app.core.services import (
            get_embedding_service,
            get_llm_service,
            get_vector_store_service,
        )

        self.settings = settings or get_settings()
        self.embedding_service = embedding_service or get_embedding_service()
        self.vector_store = vector_store or get_vector_store_service()
        self.llm_service = llm_service or get_llm_service()

    def answer_question(
        self,
        *,
        user_id: uuid.UUID,
        question: str,
        document_ids: list[uuid.UUID] | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> RagAnswer:
        question = question.strip()
        if len(question) < 2:
            raise RAGError("Please enter a longer question", status_code=400)

        if _is_greeting(question):
            return RagAnswer(
                answer=_greeting_answer(document_ids),
                sources=[],
                retrieved_count=0,
                used_llm=False,
            )

        try:
            query_embedding = self.embedding_service.embed_query(question)
        except EmbeddingError as exc:
            logger.exception("Query embedding failed")
            raise RAGError("The embedding model is unavailable. Please try again shortly.") from exc

        try:
            retrieved = self.vector_store.search(
                user_id=user_id,
                query_embedding=query_embedding,
                top_k=self.settings.retrieval_top_k,
                similarity_threshold=self.settings.similarity_threshold,
                document_ids=document_ids,
            )
        except VectorStoreError as exc:
            logger.exception("Vector retrieval failed")
            raise RAGError("Document search is temporarily unavailable.") from exc

        retrieved = [chunk for chunk in retrieved if chunk.text.strip()]
        if not retrieved:
            return RagAnswer(
                answer=INSUFFICIENT_ANSWER,
                sources=[],
                retrieved_count=0,
                used_llm=False,
            )

        try:
            result = self.llm_service.generate_answer(
                question=question, sources=retrieved, history=history or []
            )
        except LLMError as exc:
            raise RAGError(exc.message, status_code=exc.status_code) from exc

        answer = (result.answer or "").strip()
        if not answer:
            raise RAGError("The AI provider returned an empty answer.", status_code=502)

        normalized = answer.lower().replace("\u2019", "'")
        insufficient = any(marker in normalized for marker in INSUFFICIENT_MARKERS)
        if insufficient:
            return RagAnswer(
                answer=INSUFFICIENT_ANSWER,
                sources=[],
                retrieved_count=len(retrieved),
                used_llm=True,
            )

        sources = self._validate_sources(retrieved, result.cited_chunk_ids)
        return RagAnswer(
            answer=answer,
            sources=sources,
            retrieved_count=len(retrieved),
            used_llm=True,
        )

    @staticmethod
    def _validate_sources(
        retrieved: list[RetrievedChunk], cited_chunk_ids: list[str]
    ) -> list[SourceOut]:
        by_id = {chunk.chunk_id: chunk for chunk in retrieved}
        selected: list[RetrievedChunk] = []
        for chunk_id in cited_chunk_ids:
            chunk = by_id.get(chunk_id)
            if chunk is not None and chunk not in selected:
                selected.append(chunk)
        if not selected:
            selected = retrieved[:3]

        sources: list[SourceOut] = []
        for chunk in selected:
            excerpt = " ".join(chunk.text.split())
            if len(excerpt) > 280:
                excerpt = excerpt[:277].rstrip() + "..."
            sources.append(
                SourceOut(
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    filename=chunk.filename,
                    page_number=chunk.page_number,
                    excerpt=excerpt,
                    similarity=round(chunk.similarity, 4),
                )
            )
        return sources
