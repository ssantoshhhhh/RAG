from pathlib import Path

import pymupdf

from app.services.processing.types import ExtractionResult, PageText


class ExtractionError(Exception):
    """Raised when a document cannot be read or yields no usable text."""


def extract_document(path: str | Path, file_type: str) -> ExtractionResult:
    path = Path(path)
    if not path.exists():
        raise ExtractionError("Document file is missing from storage")

    if file_type == "pdf":
        return _extract_pdf(path)
    if file_type == "txt":
        return _extract_txt(path)
    raise ExtractionError(f"Unsupported file type: {file_type}")


def _extract_pdf(path: Path) -> ExtractionResult:
    try:
        document = pymupdf.open(path)
    except Exception as exc:  # noqa: BLE001 - surface a user-facing error
        raise ExtractionError("The PDF file could not be opened or is corrupt") from exc

    try:
        if document.needs_pass:
            raise ExtractionError("Password-protected PDFs are not supported")
        if document.page_count == 0:
            raise ExtractionError("The PDF has no pages")

        pages: list[PageText] = []
        for index, page in enumerate(document):
            try:
                text = page.get_text("text") or ""
            except Exception as exc:  # noqa: BLE001
                raise ExtractionError(f"Could not extract text from page {index + 1}") from exc
            pages.append(PageText(page_number=index + 1, text=text))
        return ExtractionResult(pages=pages, page_count=document.page_count)
    finally:
        document.close()


def _extract_txt(path: Path) -> ExtractionResult:
    raw = path.read_bytes()
    if not raw:
        raise ExtractionError("The text file is empty")

    text: str | None = None
    for encoding in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            decoded = raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
        if decoded.count("\x00") > len(decoded) // 10:
            continue
        text = decoded
        break

    if text is None:
        raise ExtractionError("The text file encoding is not supported")

    return ExtractionResult(pages=[PageText(page_number=1, text=text)], page_count=1)
