import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Conversation


def create(
    db: Session,
    *,
    user_id: uuid.UUID,
    title: str,
    document_ids: list[str] | None = None,
) -> Conversation:
    conversation = Conversation(user_id=user_id, title=title, document_ids=document_ids)
    db.add(conversation)
    db.flush()
    return conversation


def get_owned(db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> Conversation | None:
    return db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user_id
        )
    )


def list_owned(db: Session, user_id: uuid.UUID) -> list[Conversation]:
    activity = func.coalesce(Conversation.last_message_at, Conversation.created_at)
    query = select(Conversation).where(Conversation.user_id == user_id).order_by(activity.desc())
    return list(db.scalars(query).all())


def delete(db: Session, conversation: Conversation) -> None:
    db.delete(conversation)


def count_owned(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(select(func.count(Conversation.id)).where(Conversation.user_id == user_id)) or 0
    )
