from functools import lru_cache

from app.services.llm_service import BaseLLMService, create_llm_service
from app.services.processing.embeddings import EmbeddingService
from app.services.processing.vector_store import VectorStoreService
from app.storage.file_store import FileStore


@lru_cache(maxsize=1)
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()


@lru_cache(maxsize=1)
def get_vector_store_service() -> VectorStoreService:
    return VectorStoreService()


@lru_cache(maxsize=1)
def get_llm_service() -> BaseLLMService:
    return create_llm_service()


@lru_cache(maxsize=1)
def get_file_store() -> FileStore:
    return FileStore()


def reset_service_caches() -> None:
    get_embedding_service.cache_clear()
    get_vector_store_service.cache_clear()
    get_llm_service.cache_clear()
    get_file_store.cache_clear()
