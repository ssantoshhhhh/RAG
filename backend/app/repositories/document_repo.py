import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Document, DocumentStatus


def create(
    db: Session,
    *,
    user_id: uuid.UUID,
    filename: str,
    file_type: str,
    file_size: int,
    storage_path: str,
    content_hash: str,
    source: str = "upload",
) -> Document:
    document = Document(
        user_id=user_id,
        filename=filename,
        file_type=file_type,
        file_size=file_size,
        storage_path=storage_path,
        content_hash=content_hash,
        source=source,
        status=DocumentStatus.UPLOADED,
    )
    db.add(document)
    db.flush()
    return document


def get(db: Session, document_id: uuid.UUID) -> Document | None:
    return db.get(Document, document_id)


def get_owned(db: Session, document_id: uuid.UUID, user_id: uuid.UUID) -> Document | None:
    return db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )


def list_owned(
    db: Session,
    user_id: uuid.UUID,
    *,
    limit: int = 100,
    offset: int = 0,
    search: str | None = None,
    status: DocumentStatus | None = None,
) -> list[Document]:
    query = select(Document).where(Document.user_id == user_id)
    if search:
        query = query.where(Document.filename.ilike(f"%{search.strip()}%"))
    if status:
        query = query.where(Document.status == status)
    query = query.order_by(Document.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(query).all())


def list_owned_by_ids(
    db: Session, user_id: uuid.UUID, document_ids: list[uuid.UUID]
) -> list[Document]:
    if not document_ids:
        return []
    query = select(Document).where(Document.user_id == user_id, Document.id.in_(document_ids))
    return list(db.scalars(query).all())


def find_by_content_hash(
    db: Session, user_id: uuid.UUID, content_hash: str, source: str
) -> Document | None:
    return db.scalar(
        select(Document).where(
            Document.user_id == user_id,
            Document.content_hash == content_hash,
            Document.source == source,
        )
    )


def delete(db: Session, document: Document) -> None:
    db.delete(document)


def count_owned(db: Session, user_id: uuid.UUID) -> int:
    return int(db.scalar(select(func.count(Document.id)).where(Document.user_id == user_id)) or 0)


def count_by_status(db: Session, user_id: uuid.UUID, status: DocumentStatus) -> int:
    return int(
        db.scalar(
            select(func.count(Document.id)).where(
                Document.user_id == user_id, Document.status == status
            )
        )
        or 0
    )


def status_breakdown(db: Session, user_id: uuid.UUID) -> dict[str, int]:
    rows = db.execute(
        select(Document.status, func.count(Document.id))
        .where(Document.user_id == user_id)
        .group_by(Document.status)
    ).all()
    counts = {status.value: 0 for status in DocumentStatus}
    for status, count in rows:
        key = status.value if hasattr(status, "value") else str(status)
        counts[key] = int(count)
    return counts


def recent(db: Session, user_id: uuid.UUID, limit: int = 5) -> list[Document]:
    query = (
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(query).all())
