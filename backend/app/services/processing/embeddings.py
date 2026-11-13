import logging
import threading

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    """Raised when the embedding model cannot be loaded or used."""


class EmbeddingService:
    """Lazily loaded Sentence Transformers embedding service.

    The same model and preprocessing are used for both document chunks and
    questions so vectors live in a single consistent space.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model_name = self.settings.embedding_model
        self.dimension = self.settings.embedding_dimension
        self._model = None
        self._lock = threading.Lock()

    def _get_model(self):
        if self._model is not None:
            return self._model
        with self._lock:
            if self._model is not None:
                return self._model
            try:
                from sentence_transformers import SentenceTransformer

                logger.info("Loading embedding model %s", self.model_name)
                self._model = SentenceTransformer(self.model_name)
                logger.info("Embedding model loaded")
            except Exception as exc:  # noqa: BLE001
                raise EmbeddingError(
                    "The embedding model could not be loaded. "
                    "Check network access or pre-download the model."
                ) from exc
        return self._model

    def _encode(self, texts: list[str]) -> list[list[float]]:
        cleaned = [text.strip() for text in texts]
        if not cleaned:
            return []
        if any(not text for text in cleaned):
            raise EmbeddingError("Cannot embed empty text")

        model = self._get_model()
        try:
            vectors = model.encode(
                cleaned,
                batch_size=32,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True,
            )
        except Exception as exc:  # noqa: BLE001
            raise EmbeddingError("Embedding generation failed") from exc

        result = vectors.tolist()
        if result and len(result[0]) != self.dimension:
            raise EmbeddingError(
                f"Unexpected embedding dimension {len(result[0])}; expected {self.dimension}"
            )
        return result

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._encode(texts)

    def embed_query(self, text: str) -> list[float]:
        vectors = self._encode([text])
        return vectors[0]
