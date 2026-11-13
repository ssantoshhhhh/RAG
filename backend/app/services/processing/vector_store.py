import logging
import uuid

from chromadb import PersistentClient
from chromadb.config import Settings as ChromaSettings

from app.core.config import Settings, get_settings
from app.services.processing.types import ChunkDraft, RetrievedChunk

logger = logging.getLogger(__name__)


class VectorStoreError(Exception):
    """Raised when ChromaDB operations fail."""


class VectorStoreService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.collection_name = self.settings.chroma_collection
        self.persist_dir = self.settings.resolved_chroma_dir
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        try:
            self.client = PersistentClient(
                path=str(self.persist_dir),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError("The vector store could not be initialized") from exc

    def add_chunks(
        self,
        *,
        user_id: uuid.UUID,
        document_id: uuid.UUID,
        filename: str,
        chunks: list[ChunkDraft],
        embeddings: list[list[float]],
        chunk_ids: list[uuid.UUID],
    ) -> None:
        if not chunks:
            return
        if not (len(chunks) == len(embeddings) == len(chunk_ids)):
            raise VectorStoreError("Chunk, embedding and id counts do not match")

        metadatas = [
            {
                "user_id": str(user_id),
                "document_id": str(document_id),
                "filename": filename,
                "page_number": int(chunk.page_number),
                "page_end": int(chunk.page_end),
                "chunk_index": int(chunk.chunk_index),
                "token_count": int(chunk.token_count),
            }
            for chunk in chunks
        ]
        try:
            self.collection.upsert(
                ids=[str(chunk_id) for chunk_id in chunk_ids],
                embeddings=embeddings,
                documents=[chunk.text for chunk in chunks],
                metadatas=metadatas,
            )
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError("Failed to store chunk embeddings") from exc

    def search(
        self,
        *,
        user_id: uuid.UUID,
        query_embedding: list[float],
        top_k: int = 5,
        similarity_threshold: float = 0.0,
        document_ids: list[uuid.UUID] | None = None,
    ) -> list[RetrievedChunk]:
        if top_k <= 0:
            return []
        clauses: list[dict] = [{"user_id": {"$eq": str(user_id)}}]
        if document_ids:
            clauses.append({"document_id": {"$in": [str(doc_id) for doc_id in document_ids]}})
        where = {"$and": clauses} if len(clauses) > 1 else clauses[0]

        try:
            if self.collection.count() == 0:
                return []
            result = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Vector search failed")
            raise VectorStoreError("Vector search failed") from exc

        ids = (result.get("ids") or [[]])[0]
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]

        retrieved: list[RetrievedChunk] = []
        for chunk_id, text, metadata, distance in zip(
            ids, documents, metadatas, distances, strict=False
        ):
            distance_value = float(distance) if distance is not None else 1.0
            similarity = max(-1.0, min(1.0, 1.0 - distance_value))
            if similarity < similarity_threshold:
                continue
            metadata = metadata or {}
            retrieved.append(
                RetrievedChunk(
                    chunk_id=str(chunk_id),
                    text=text or "",
                    user_id=str(metadata.get("user_id", "")),
                    document_id=str(metadata.get("document_id", "")),
                    filename=str(metadata.get("filename", "Document")),
                    page_number=int(metadata.get("page_number", 1) or 1),
                    page_end=int(metadata.get("page_end", metadata.get("page_number", 1)) or 1),
                    chunk_index=int(metadata.get("chunk_index", 0) or 0),
                    similarity=similarity,
                    metadata=dict(metadata),
                )
            )
        return retrieved

    def delete_document_chunks(self, *, user_id: uuid.UUID, document_id: uuid.UUID) -> None:
        where = {
            "$and": [
                {"user_id": {"$eq": str(user_id)}},
                {"document_id": {"$eq": str(document_id)}},
            ]
        }
        try:
            self.collection.delete(where=where)
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError("Failed to delete document vectors") from exc

    def count_document_chunks(self, *, user_id: uuid.UUID, document_id: uuid.UUID) -> int:
        where = {
            "$and": [
                {"user_id": {"$eq": str(user_id)}},
                {"document_id": {"$eq": str(document_id)}},
            ]
        }
        try:
            result = self.collection.get(where=where, include=[])
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError("Failed to read document vectors") from exc
        return len(result.get("ids", []))

    def heartbeat(self) -> bool:
        try:
            self.client.heartbeat()
            return True
        except Exception:  # noqa: BLE001
            return False
