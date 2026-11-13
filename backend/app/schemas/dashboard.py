from datetime import datetime

from pydantic import BaseModel

from app.schemas.document import DocumentOut


class DashboardStats(BaseModel):
    document_count: int
    indexed_document_count: int
    processing_document_count: int
    failed_document_count: int
    chunk_count: int
    conversation_count: int
    question_count: int
    recent_documents: list[DocumentOut]
    status_counts: dict[str, int]


class HealthStatus(BaseModel):
    status: str
    database: str
    vector_store: str
    llm_provider: str
    llm_model: str
    llm_configured: bool
    llm_available: bool
    version: str | None = None
    timestamp: datetime | None = None
