import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Message, MessageRole


def create(
    db: Session,
    *,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    role: MessageRole,
    content: str,
    sources: list[dict] | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        user_id=user_id,
        role=role,
        content=content,
        sources=sources,
    )
    db.add(message)
    db.flush()
    return message


def list_for_conversation(
    db: Session, conversation_id: uuid.UUID, *, limit: int = 200
) -> list[Message]:
    query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    return list(db.scalars(query).all())


def recent_for_conversation(
    db: Session, conversation_id: uuid.UUID, *, limit: int = 6
) -> list[Message]:
    query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(db.scalars(query).all())
    messages.reverse()
    return messages


def count_user_questions(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count(Message.id)).where(
                Message.user_id == user_id, Message.role == MessageRole.USER
            )
        )
        or 0
    )
