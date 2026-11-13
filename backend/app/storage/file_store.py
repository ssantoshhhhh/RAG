import hashlib
import json
import shutil
import uuid
from pathlib import Path

from app.core.config import Settings, get_settings


class FileStore:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.settings.extracted_dir.mkdir(parents=True, exist_ok=True)

    def save_upload(self, user_id: uuid.UUID, filename: str, content: bytes) -> tuple[Path, str]:
        suffix = Path(filename).suffix.lower()
        if suffix not in {".pdf", ".txt"}:
            raise ValueError("Unsupported file type")
        user_dir = self.settings.uploads_dir / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)
        path = user_dir / f"{uuid.uuid4()}{suffix}"
        path.write_bytes(content)
        content_hash = hashlib.sha256(content).hexdigest()
        return path, content_hash

    def save_extracted_pages(self, document_id: uuid.UUID, pages: list[dict[str, object]]) -> Path:
        path = self.settings.extracted_dir / f"{document_id}.json"
        path.write_text(json.dumps({"pages": pages}, ensure_ascii=False), encoding="utf-8")
        return path

    def load_extracted_pages(self, extracted_path: str | None) -> list[dict[str, object]]:
        if not extracted_path:
            return []
        path = Path(extracted_path)
        if not path.exists():
            return []
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
        pages = payload.get("pages")
        return pages if isinstance(pages, list) else []

    def delete_file(self, path: str | None) -> None:
        if not path:
            return
        file_path = Path(path)
        try:
            if file_path.is_file():
                file_path.unlink()
        except OSError:
            pass

    def delete_user_uploads(self, user_id: uuid.UUID) -> None:
        user_dir = self.settings.uploads_dir / str(user_id)
        shutil.rmtree(user_dir, ignore_errors=True)
