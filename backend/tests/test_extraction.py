import pytest

from app.services.processing.extraction import ExtractionError, extract_document
from tests.conftest import make_pdf


def test_extract_txt_preserves_text(tmp_path):
    path = tmp_path / "notes.txt"
    path.write_text("Hello DocuMind.\nSecond line.", encoding="utf-8")
    result = extract_document(path, "txt")
    assert result.page_count == 1
    assert result.pages[0].page_number == 1
    assert "Hello DocuMind" in result.pages[0].text


def test_extract_txt_supports_utf16(tmp_path):
    path = tmp_path / "notes.txt"
    path.write_bytes("Unicode text: café".encode("utf-16"))
    result = extract_document(path, "txt")
    assert "café" in result.pages[0].text


def test_extract_pdf_keeps_page_numbers(tmp_path):
    path = tmp_path / "sample.pdf"
    path.write_bytes(make_pdf("DocuMind PDF content"))
    result = extract_document(path, "pdf")
    assert result.page_count == 1
    assert result.pages[0].page_number == 1
    assert "DocuMind PDF content" in result.pages[0].text


def test_blank_pdf_has_no_extractable_text(tmp_path):
    path = tmp_path / "blank.pdf"
    path.write_bytes(make_pdf(None))
    result = extract_document(path, "pdf")
    assert result.page_count == 1
    assert not result.pages[0].text.strip()


def test_corrupt_pdf_raises(tmp_path):
    path = tmp_path / "broken.pdf"
    path.write_bytes(b"%PDF-1.7 not really a pdf")
    with pytest.raises(ExtractionError):
        extract_document(path, "pdf")


def test_missing_file_raises(tmp_path):
    with pytest.raises(ExtractionError):
        extract_document(tmp_path / "missing.txt", "txt")
