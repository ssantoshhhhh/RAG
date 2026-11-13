import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.services import get_embedding_service, get_file_store, get_vector_store_service
from app.db.session import SessionLocal
from app.models import Document, DocumentChunk, DocumentStatus
from app.repositories import chunk_repo
from app.services.processing.chunking import chunk_pages
from app.services.processing.cleaning import clean_pages
from app.services.processing.embeddings import EmbeddingError
from app.services.processing.extraction import ExtractionError, extract_document
from app.services.processing.vector_store import VectorStoreError, VectorStoreService

logger = logging.getLogger(__name__)


class ProcessingError(Exception):
    pass


def process_document(document_id: uuid.UUID) -> None:
    """Run the full ingestion pipeline. Safe to call from a background task."""
    db = SessionLocal()
    vectors: VectorStoreService | None = None
    document = db.get(Document, document_id)
    if document is None:
        db.close()
        return
    user_id = document.user_id
    filename = document.filename

    try:
        try:
            vectors = get_vector_store_service()
        except Exception as exc:  # noqa: BLE001
            raise ProcessingError(
                "The vector database is unavailable. Please retry in a moment."
            ) from exc
        _run_pipeline(db, document)
        logger.info("Document %s indexed successfully", document_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Processing failed for document %s (%s)", document_id, filename)
        _mark_failed(db, document_id=document_id, user_id=user_id, vectors=vectors, exc=exc)
    finally:
        db.close()


def _run_pipeline(db: Session, document: Document) -> None:
    settings = get_settings()
    vectors = get_vector_store_service()
    embeddings = get_embedding_service()
    file_store = get_file_store()

    # Clear any previous artifacts so retries are idempotent.
    try:
        vectors.delete_document_chunks(user_id=document.user_id, document_id=document.id)
    except VectorStoreError as exc:
        raise ProcessingError("Existing vectors could not be cleaned up. Please retry.") from exc
    chunk_repo.delete_for_document(db, document.id)
    document.status = DocumentStatus.PROCESSING
    document.failure_message = None
    document.chunk_count = 0
    db.commit()

    extraction = extract_document(document.storage_path, document.file_type)
    document.page_count = extraction.page_count
    cleaned_pages = clean_pages(extraction.pages)

    if not cleaned_pages or not any(page.text.strip() for page in cleaned_pages):
        raise ProcessingError(
            "No extractable text was found in this document. "
            "Scanned PDFs without a text layer are not supported."
        )

    extracted_path = file_store.save_extracted_pages(
        document.id,
        [{"page_number": page.page_number, "text": page.text} for page in cleaned_pages],
    )
    document.extracted_path = str(extracted_path)

    chunks = chunk_pages(
        cleaned_pages,
        chunk_size=settings.chunk_size_tokens,
        overlap=settings.chunk_overlap_tokens,
        min_tokens=settings.min_chunk_tokens,
    )
    if not chunks:
        raise ProcessingError("The document did not produce any usable text chunks.")

    document.status = DocumentStatus.INDEXING
    db.commit()

    try:
        embeddings_list = embeddings.embed_documents([chunk.text for chunk in chunks])
    except EmbeddingError as exc:
        raise ProcessingError(
            "Embedding generation failed. The embedding model may still be loading; "
            "please retry shortly."
        ) from exc

    chunk_ids = [uuid.uuid4() for _ in chunks]
    vectors.add_chunks(
        user_id=document.user_id,
        document_id=document.id,
        filename=document.filename,
        chunks=chunks,
        embeddings=embeddings_list,
        chunk_ids=chunk_ids,
    )

    stored_count = vectors.count_document_chunks(user_id=document.user_id, document_id=document.id)
    if stored_count != len(chunks):
        raise VectorStoreError(
            "Vector storage verification failed: stored chunk count did not match."
        )

    rows = [
        DocumentChunk(
            id=chunk_id,
            document_id=document.id,
            user_id=document.user_id,
            chunk_index=chunk.chunk_index,
            page_number=chunk.page_number,
            page_end=chunk.page_end,
            text=chunk.text,
            token_count=chunk.token_count,
            embedding_model=settings.embedding_model,
        )
        for chunk_id, chunk in zip(chunk_ids, chunks, strict=True)
    ]
    chunk_repo.add_all(db, rows)
    document.chunk_count = len(chunks)
    document.status = DocumentStatus.INDEXED
    document.failure_message = None
    document.processed_at = datetime.now(UTC)
    db.commit()


def _mark_failed(
    db: Session,
    *,
    document_id: uuid.UUID,
    user_id: uuid.UUID,
    vectors: VectorStoreService | None,
    exc: Exception,
) -> None:
    db.rollback()
    if vectors is not None:
        try:
            vectors.delete_document_chunks(user_id=user_id, document_id=document_id)
        except VectorStoreError:
            logger.warning("Could not clean up vectors for failed document %s", document_id)

    message = _friendly_failure_message(exc)
    try:
        chunk_repo.delete_for_document(db, document_id)
        document = db.get(Document, document_id)
        if document is None:
            db.rollback()
            return
        document.status = DocumentStatus.FAILED
        document.failure_message = message[:1000]
        document.chunk_count = 0
        document.processed_at = datetime.now(UTC)
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Could not mark document %s as failed", document_id)
        db.rollback()


def _friendly_failure_message(exc: Exception) -> str:
    if isinstance(exc, (ProcessingError, ExtractionError, EmbeddingError, VectorStoreError)):
        return str(exc)
    return "Processing failed unexpectedly. Please retry, or delete and re-upload the file."
