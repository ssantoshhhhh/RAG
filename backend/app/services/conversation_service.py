import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Conversation, Message, MessageRole, User
from app.repositories import conversation_repo, document_repo, message_repo
from app.schemas.chat import ChatRequest
from app.schemas.conversation import ConversationCreate, ConversationUpdate
from app.services.document_service import ensure_all_owned
from app.services.rag_service import RAGError, RAGService

DEFAULT_TITLE = "New conversation"


def _clean_title(title: str | None, fallback: str = DEFAULT_TITLE) -> str:
    if not title:
        return fallback
    cleaned = " ".join(title.split()).strip()
    return cleaned[:200] if cleaned else fallback


def _title_from_question(question: str) -> str:
    cleaned = " ".join(question.split()).strip()
    if len(cleaned) <= 60:
        return cleaned or DEFAULT_TITLE
    return cleaned[:57].rstrip() + "..."


def _get_owned(db: Session, user: User, conversation_id: uuid.UUID) -> Conversation:
    conversation = conversation_repo.get_owned(db, conversation_id, user.id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation


def create_conversation(db: Session, *, user: User, payload: ConversationCreate) -> Conversation:
    document_ids: list[str] | None = None
    if payload.document_ids:
        ensure_all_owned(db, user=user, document_ids=payload.document_ids)
        document_ids = [str(document_id) for document_id in payload.document_ids]

    conversation = conversation_repo.create(
        db,
        user_id=user.id,
        title=_clean_title(payload.title),
        document_ids=document_ids,
    )
    db.commit()
    db.refresh(conversation)
    return conversation


def list_conversations(db: Session, *, user: User) -> list[Conversation]:
    return conversation_repo.list_owned(db, user.id)


def get_conversation(db: Session, *, user: User, conversation_id: uuid.UUID) -> Conversation:
    return _get_owned(db, user, conversation_id)


def get_messages(db: Session, *, conversation_id: uuid.UUID) -> list[Message]:
    return message_repo.list_for_conversation(db, conversation_id)


def update_conversation(
    db: Session, *, user: User, conversation_id: uuid.UUID, payload: ConversationUpdate
) -> Conversation:
    conversation = _get_owned(db, user, conversation_id)
    if payload.title is not None:
        title = _clean_title(payload.title)
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Title cannot be empty",
            )
        conversation.title = title
    if payload.document_ids is not None:
        if not payload.document_ids:
            conversation.document_ids = None
        else:
            ensure_all_owned(db, user=user, document_ids=payload.document_ids)
            conversation.document_ids = [str(doc_id) for doc_id in payload.document_ids]
    db.commit()
    db.refresh(conversation)
    return conversation


def delete_conversation(db: Session, *, user: User, conversation_id: uuid.UUID) -> None:
    conversation = _get_owned(db, user, conversation_id)
    conversation_repo.delete(db, conversation)
    db.commit()


def _resolve_document_ids(
    db: Session, *, user: User, conversation: Conversation, requested: list[uuid.UUID] | None
) -> list[uuid.UUID] | None:
    if requested:
        ensure_all_owned(db, user=user, document_ids=requested)
        return list(dict.fromkeys(requested))

    stored = conversation.document_ids or []
    try:
        stored_ids = [uuid.UUID(str(doc_id)) for doc_id in stored]
    except (ValueError, TypeError):
        return None
    if not stored_ids:
        return None

    existing = document_repo.list_owned_by_ids(db, user.id, stored_ids)
    existing_ids = [doc.id for doc in existing]
    return existing_ids or None


def ask_question(
    db: Session, *, user: User, payload: ChatRequest
) -> tuple[Conversation, Message, Message]:
    settings = get_settings()

    if payload.conversation_id is None:
        conversation = conversation_repo.create(
            db, user_id=user.id, title=_title_from_question(payload.question)
        )
    else:
        conversation = _get_owned(db, user, payload.conversation_id)

    document_ids = _resolve_document_ids(
        db, user=user, conversation=conversation, requested=payload.document_ids
    )
    if payload.document_ids is not None:
        conversation.document_ids = (
            [str(doc_id) for doc_id in payload.document_ids] if payload.document_ids else None
        )
    if conversation.title == DEFAULT_TITLE:
        conversation.title = _title_from_question(payload.question)

    history = [
        {"role": message.role.value, "content": message.content}
        for message in message_repo.recent_for_conversation(
            db, conversation.id, limit=settings.max_history_messages
        )
    ]

    now = datetime.now(UTC)
    user_message = message_repo.create(
        db,
        conversation_id=conversation.id,
        user_id=user.id,
        role=MessageRole.USER,
        content=payload.question,
    )
    conversation.last_message_at = now
    db.commit()

    rag_service = RAGService()
    try:
        result = rag_service.answer_question(
            user_id=user.id,
            question=payload.question,
            document_ids=document_ids,
            history=history,
        )
    except RAGError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    sources = [source.model_dump(mode="json") for source in result.sources]
    assistant_message = message_repo.create(
        db,
        conversation_id=conversation.id,
        user_id=user.id,
        role=MessageRole.ASSISTANT,
        content=result.answer,
        sources=sources or None,
    )
    conversation.last_message_at = datetime.now(UTC)
    db.commit()
    db.refresh(conversation)
    db.refresh(user_message)
    db.refresh(assistant_message)
    return conversation, user_message, assistant_message
