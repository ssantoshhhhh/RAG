import hashlib
import math

from app.services.llm_service import INSUFFICIENT_ANSWER, LLMResult
from app.services.processing.types import RetrievedChunk


class FakeEmbeddingService:
    model_name = "fake-embedding"
    dimension = 384

    def _encode(self, text: str) -> list[float]:
        vector = [0.0] * self.dimension
        words = text.lower().split() or ["empty"]
        for word in words:
            digest = hashlib.md5(word.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            vector[index] += 1.0
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._encode(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._encode(text)


class FakeLLMService:
    def __init__(self) -> None:
        self.answer = "LSTMs are a type of recurrent neural network used for sequences."
        self.cited_labels: list[str] | None = None
        self.error: Exception | None = None
        self.calls: list[dict] = []
        self.is_configured = True

    def generate_answer(
        self,
        *,
        question: str,
        sources: list[RetrievedChunk],
        history: list[dict[str, str]] | None = None,
    ) -> LLMResult:
        self.calls.append({"question": question, "sources": sources, "history": history})
        if self.error is not None:
            raise self.error
        if not sources:
            return LLMResult(answer=INSUFFICIENT_ANSWER, cited_chunk_ids=[])
        labels = self.cited_labels if self.cited_labels is not None else ["S1"]
        label_map = {f"S{index}": source.chunk_id for index, source in enumerate(sources, 1)}
        cited = [label_map[label] for label in labels if label in label_map]
        return LLMResult(answer=self.answer, cited_chunk_ids=cited)
