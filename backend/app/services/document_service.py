import re
import uuid
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.services import get_file_store, get_vector_store_service
from app.models import Document, DocumentStatus, User
from app.repositories import chunk_repo, document_repo
from app.services.processing.vector_store import VectorStoreError
from app.storage.file_store import FileStore

ALLOWED_TYPES = {
    ".pdf": "pdf",
    ".txt": "txt",
}
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


class UploadValidationError(ValueError):
    pass


def sanitize_filename(filename: str | None) -> str:
    raw = (filename or "document").replace("\\", "/")
    name = raw.rsplit("/", 1)[-1].strip()
    name = _CONTROL_CHARS.sub("", name)
    if not name or name in {".", ".."}:
        raise UploadValidationError("The file has an invalid name")
    if len(name) > 255:
        stem, suffix = Path(name).stem[:200], Path(name).suffix
        name = f"{stem}{suffix}"
    return name


def detect_file_type(filename: str, content: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_TYPES:
        raise UploadValidationError("Only PDF and TXT files are supported")
    if not content:
        raise UploadValidationError("The file is empty")

    if suffix == ".pdf":
        if b"%PDF-" not in content[:1024]:
            raise UploadValidationError("The file is not a valid PDF")
        return "pdf"

    sample = content[:4096]
    if b"\x00" in sample:
        raise UploadValidationError("The file is not a valid text file")
    for encoding in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            sample.decode(encoding)
            return "txt"
        except (UnicodeDecodeError, LookupError):
            continue
    raise UploadValidationError("The text file encoding is not supported")


def create_document(
    db: Session,
    *,
    user: User,
    filename: str,
    content: bytes,
    source: str = "upload",
    settings: Settings | None = None,
    file_store: FileStore | None = None,
) -> Document:
    settings = settings or get_settings()
    file_store = file_store or get_file_store()

    clean_name = sanitize_filename(filename)
    if len(content) > settings.max_upload_bytes:
        raise UploadValidationError("File exceeds the 10 MB limit")
    file_type = detect_file_type(clean_name, content)

    storage_path, content_hash = file_store.save_upload(user.id, clean_name, content)
    try:
        document = document_repo.create(
            db,
            user_id=user.id,
            filename=clean_name,
            file_type=file_type,
            file_size=len(content),
            storage_path=str(storage_path),
            content_hash=content_hash,
            source=source,
        )
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        file_store.delete_file(str(storage_path))
        raise
    return document


def list_documents(
    db: Session,
    *,
    user: User,
    limit: int = 100,
    offset: int = 0,
    search: str | None = None,
    status_filter: DocumentStatus | None = None,
) -> list[Document]:
    return document_repo.list_owned(
        db,
        user.id,
        limit=min(max(limit, 1), 200),
        offset=max(offset, 0),
        search=search,
        status=status_filter,
    )


def get_document(db: Session, *, user: User, document_id: uuid.UUID) -> Document:
    document = document_repo.get_owned(db, document_id, user.id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def get_preview(db: Session, *, user: User, document_id: uuid.UUID) -> dict:
    document = get_document(db, user=user, document_id=document_id)
    pages = get_file_store().load_extracted_pages(document.extracted_path)
    formatted = [
        {
            "page_number": int(page.get("page_number", index + 1)),
            "text": str(page.get("text", "")),
        }
        for index, page in enumerate(pages)
    ]
    return {
        "document_id": document.id,
        "filename": document.filename,
        "file_type": document.file_type,
        "page_count": document.page_count,
        "pages": formatted,
    }


def delete_document(db: Session, *, user: User, document_id: uuid.UUID) -> None:
    document = get_document(db, user=user, document_id=document_id)

    try:
        vector_store = get_vector_store_service()
        vector_store.delete_document_chunks(user_id=user.id, document_id=document.id)
    except VectorStoreError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not remove the document's vectors. Please retry.",
        ) from exc

    storage_path = document.storage_path
    extracted_path = document.extracted_path
    try:
        chunk_repo.delete_for_document(db, document.id)
        document_repo.delete(db, document)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The document could not be deleted from the database.",
        ) from exc

    file_store = get_file_store()
    file_store.delete_file(storage_path)
    file_store.delete_file(extracted_path)


def prepare_retry(db: Session, *, user: User, document_id: uuid.UUID) -> Document:
    document = get_document(db, user=user, document_id=document_id)
    if document.status != DocumentStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only failed documents can be retried",
        )
    document.status = DocumentStatus.UPLOADED
    document.failure_message = None
    document.processed_at = None
    db.commit()
    db.refresh(document)
    return document


def ensure_all_owned(db: Session, *, user: User, document_ids: list[uuid.UUID]) -> list[Document]:
    unique_ids = list(dict.fromkeys(document_ids))
    documents = document_repo.list_owned_by_ids(db, user.id, unique_ids)
    if len(documents) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more selected documents do not exist or are not yours",
        )
    return documents
