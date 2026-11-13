import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DocumentChunk


def add_all(db: Session, chunks: list[DocumentChunk]) -> None:
    if chunks:
        db.add_all(chunks)


def delete_for_document(db: Session, document_id: uuid.UUID) -> None:
    for chunk in db.scalars(
        select(DocumentChunk).where(DocumentChunk.document_id == document_id)
    ).all():
        db.delete(chunk)


def count_for_user(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(select(func.count(DocumentChunk.id)).where(DocumentChunk.user_id == user_id)) or 0
    )


def count_for_document(db: Session, document_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == document_id)
        )
        or 0
    )


def list_for_document(db: Session, document_id: uuid.UUID) -> list[DocumentChunk]:
    query = (
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
    )
    return list(db.scalars(query).all())
