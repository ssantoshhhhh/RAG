import os
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Document, DocumentStatus, User
from app.schemas.document import DocumentOut, DocumentPreview
from app.services import document_service
from app.services.document_service import (
    UploadValidationError,
    detect_file_type,
    sanitize_filename,
)
from app.services.pipeline import process_document

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_FILES_PER_UPLOAD = 10


@router.post("/upload", response_model=list[DocumentOut], status_code=status.HTTP_201_CREATED)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Document]:
    settings = get_settings()
    if not files:
        raise HTTPException(status_code=400, detail="No files were provided")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=400, detail=f"Upload at most {MAX_FILES_PER_UPLOAD} files at a time"
        )

    validated: list[tuple[str, bytes]] = []
    for upload in files:
        content = await upload.read(settings.max_upload_bytes + 1)
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"{upload.filename or 'File'} exceeds the 10 MB limit",
            )
        try:
            name = sanitize_filename(upload.filename)
            detect_file_type(name, content)
        except UploadValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{upload.filename or 'File'}: {exc}",
            ) from exc
        validated.append((name, content))

    documents: list[Document] = []
    for name, content in validated:
        try:
            document = document_service.create_document(
                db, user=user, filename=name, content=content
            )
        except UploadValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        documents.append(document)
        background_tasks.add_task(process_document, document.id)
    return documents


@router.get("", response_model=list[DocumentOut])
def list_documents(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, max_length=200),
    document_status: DocumentStatus | None = Query(default=None, alias="status"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Document]:
    return document_service.list_documents(
        db,
        user=user,
        limit=limit,
        offset=offset,
        search=search,
        status_filter=document_status,
    )


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Document:
    return document_service.get_document(db, user=user, document_id=document_id)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    document_service.delete_document(db, user=user, document_id=document_id)


@router.post("/{document_id}/retry", response_model=DocumentOut)
def retry_document(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Document:
    document = document_service.prepare_retry(db, user=user, document_id=document_id)
    background_tasks.add_task(process_document, document.id)
    return document


@router.get("/{document_id}/preview", response_model=DocumentPreview)
def preview_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return document_service.get_preview(db, user=user, document_id=document_id)


@router.get("/{document_id}/file")
def download_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    document = document_service.get_document(db, user=user, document_id=document_id)
    if not os.path.isfile(document.storage_path):
        raise HTTPException(status_code=404, detail="Original file is no longer available")
    media_type = "application/pdf" if document.file_type == "pdf" else "text/plain"
    return FileResponse(
        document.storage_path,
        media_type=media_type,
        filename=document.filename,
        content_disposition_type="inline",
    )
