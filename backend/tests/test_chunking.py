from app.services.processing.chunking import chunk_pages, count_tokens
from app.services.processing.cleaning import clean_text
from app.services.processing.types import PageText


def _long_sentences(count: int, page: int = 1) -> PageText:
    body = " ".join(
        f"Sentence number {index} explains an important concept about neural networks."
        for index in range(count)
    )
    return PageText(page_number=page, text=body)


def test_chunks_respect_token_size_and_minimum():
    pages = [_long_sentences(200)]
    chunks = chunk_pages(pages, chunk_size=500, overlap=100, min_tokens=50)
    assert len(chunks) > 3
    for chunk in chunks:
        assert chunk.token_count <= 520
        if len(chunks) > 1:
            assert chunk.token_count >= 40
        assert chunk.page_number == 1
        assert chunk.page_end == 1
    assert [chunk.chunk_index for chunk in chunks] == list(range(len(chunks)))


def test_consecutive_chunks_have_sentence_overlap():
    pages = [_long_sentences(120)]
    chunks = chunk_pages(pages, chunk_size=200, overlap=60, min_tokens=30)
    assert len(chunks) >= 3
    first_tokens = chunks[0].text.split()
    second_tokens = chunks[1].text.split()
    overlap = False
    for size in range(min(len(first_tokens), len(second_tokens)), 0, -1):
        if first_tokens[-size:] == second_tokens[:size]:
            overlap = True
            break
    assert overlap, "Expected the second chunk to start with text from the first chunk"


def test_chunks_track_pages_and_span_boundaries():
    pages = [
        PageText(
            page_number=1,
            text=" ".join(
                f"Page one sentence {i} discusses document retrieval." for i in range(40)
            ),
        ),
        PageText(
            page_number=2,
            text=" ".join(f"Page two sentence {i} discusses vector databases." for i in range(40)),
        ),
    ]
    chunks = chunk_pages(pages, chunk_size=500, overlap=100, min_tokens=50)
    assert chunks[0].page_number == 1
    assert chunks[-1].page_end == 2
    assert any(chunk.page_end > chunk.page_number for chunk in chunks)
    for chunk in chunks:
        assert chunk.page_end >= chunk.page_number


def test_short_document_produces_single_chunk():
    chunks = chunk_pages(
        [PageText(page_number=1, text="A short note about transformers.")],
        chunk_size=500,
        overlap=100,
        min_tokens=50,
    )
    assert len(chunks) == 1
    assert "transformers" in chunks[0].text


def test_very_long_sentence_is_split():
    long_sentence = "word " * 1200
    chunks = chunk_pages(
        [PageText(page_number=1, text=long_sentence)],
        chunk_size=500,
        overlap=100,
        min_tokens=50,
    )
    assert len(chunks) > 1
    assert all(count_tokens(chunk.text) <= 520 for chunk in chunks)


def test_clean_text_normalizes_whitespace_and_control_characters():
    dirty = "Hello\u200b  world\r\n\r\n\r\nSecond hyphen-\nated line\x00 here."
    cleaned = clean_text(dirty)
    assert "\u200b" not in cleaned
    assert "\x00" not in cleaned
    assert "hyphenated" in cleaned
    assert "\r" not in cleaned
    assert cleaned.count("\n\n") <= 1


def test_invalid_chunk_configuration_is_rejected():
    import pytest

    with pytest.raises(ValueError):
        chunk_pages([], chunk_size=100, overlap=100)
    with pytest.raises(ValueError):
        chunk_pages([], chunk_size=0, overlap=0)
