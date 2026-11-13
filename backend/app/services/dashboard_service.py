from sqlalchemy.orm import Session

from app.models import DocumentStatus, User
from app.repositories import (
    chunk_repo,
    conversation_repo,
    document_repo,
    message_repo,
)
from app.schemas.dashboard import DashboardStats


def get_stats(db: Session, *, user: User) -> DashboardStats:
    status_counts = document_repo.status_breakdown(db, user.id)
    processing = (
        status_counts.get(DocumentStatus.PROCESSING.value, 0)
        + status_counts.get(DocumentStatus.INDEXING.value, 0)
        + status_counts.get(DocumentStatus.UPLOADED.value, 0)
    )
    return DashboardStats(
        document_count=document_repo.count_owned(db, user.id),
        indexed_document_count=status_counts.get(DocumentStatus.INDEXED.value, 0),
        processing_document_count=processing,
        failed_document_count=status_counts.get(DocumentStatus.FAILED.value, 0),
        chunk_count=chunk_repo.count_for_user(db, user.id),
        conversation_count=conversation_repo.count_owned(db, user.id),
        question_count=message_repo.count_user_questions(db, user.id),
        recent_documents=document_repo.recent(db, user.id, limit=5),
        status_counts=status_counts,
    )
