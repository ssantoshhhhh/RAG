import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.document import DocumentStatus


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    file_type: str
    file_size: int
    page_count: int
    chunk_count: int
    status: DocumentStatus
    failure_message: str | None
    source: str
    created_at: datetime
    updated_at: datetime
    processed_at: datetime | None


class PreviewPage(BaseModel):
    page_number: int
    text: str


class DocumentPreview(BaseModel):
    document_id: uuid.UUID
    filename: str
    file_type: str
    page_count: int
    pages: list[PreviewPage]


class UploadError(BaseModel):
    filename: str
    detail: str
