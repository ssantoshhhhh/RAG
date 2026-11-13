import re
from dataclasses import dataclass

import tiktoken

from app.services.processing.types import ChunkDraft, PageText

_ENCODING = tiktoken.get_encoding("cl100k_base")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


@dataclass
class _Sentence:
    text: str
    tokens: int
    page: int


def count_tokens(text: str) -> int:
    return len(_ENCODING.encode(text))


def _split_long_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    token_ids = _ENCODING.encode(text)
    step = max(1, chunk_size - overlap)
    pieces: list[str] = []
    for start in range(0, len(token_ids), step):
        window = token_ids[start : start + chunk_size]
        if not window:
            break
        piece = _ENCODING.decode(window).strip()
        if piece:
            pieces.append(piece)
        if start + chunk_size >= len(token_ids):
            break
    return pieces


def _sentences_for_page(page: PageText, chunk_size: int, overlap: int) -> list[_Sentence]:
    sentences: list[_Sentence] = []
    for block in re.split(r"\n+", page.text):
        block = block.strip()
        if not block:
            continue
        for raw in _SENTENCE_SPLIT.split(block):
            raw = raw.strip()
            if not raw:
                continue
            tokens = count_tokens(raw)
            if tokens > chunk_size:
                for piece in _split_long_text(raw, chunk_size, overlap):
                    sentences.append(
                        _Sentence(text=piece, tokens=count_tokens(piece), page=page.page_number)
                    )
            else:
                sentences.append(_Sentence(text=raw, tokens=tokens, page=page.page_number))
    return sentences


def chunk_pages(
    pages: list[PageText],
    *,
    chunk_size: int = 500,
    overlap: int = 100,
    min_tokens: int = 50,
) -> list[ChunkDraft]:
    """Sentence-aware token chunking with overlap and page tracking."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be >= 0 and smaller than chunk_size")
    if min_tokens < 0:
        raise ValueError("min_tokens must be >= 0")
    min_tokens = min(min_tokens, chunk_size)

    chunks: list[ChunkDraft] = []
    current: list[_Sentence] = []
    current_tokens = 0

    def add_chunk(sentences: list[_Sentence]) -> None:
        if not sentences:
            return
        text = " ".join(sentence.text for sentence in sentences).strip()
        if not text:
            return
        chunks.append(
            ChunkDraft(
                text=text,
                token_count=count_tokens(text),
                page_number=sentences[0].page,
                page_end=sentences[-1].page,
            )
        )

    def flush_current() -> list[_Sentence]:
        nonlocal current, current_tokens
        flushed = current
        add_chunk(flushed)
        current = []
        current_tokens = 0
        return flushed

    for sentence in _sentences_for_page_stream(pages, chunk_size, overlap):
        if sentence.tokens > chunk_size:
            # Safety net; long text is pre-split in _sentences_for_page.
            flush_current()
            add_chunk([sentence])
            continue

        if (
            current
            and current_tokens + sentence.tokens > chunk_size
            and current_tokens >= min_tokens
        ):
            flushed = flush_current()
            seed: list[_Sentence] = []
            seed_tokens = 0
            for previous in reversed(flushed):
                if seed_tokens + previous.tokens > overlap:
                    break
                seed.insert(0, previous)
                seed_tokens += previous.tokens
            while seed and seed_tokens + sentence.tokens > chunk_size:
                removed = seed.pop(0)
                seed_tokens -= removed.tokens
            current = seed
            current_tokens = seed_tokens

        current.append(sentence)
        current_tokens += sentence.tokens

    if current:
        if chunks and current_tokens < min_tokens:
            tail_text = " ".join(sentence.text for sentence in current).strip()
            if tail_text:
                previous = chunks[-1]
                previous.text = f"{previous.text} {tail_text}".strip()
                previous.token_count = count_tokens(previous.text)
                previous.page_end = current[-1].page
        else:
            add_chunk(current)

    for index, chunk in enumerate(chunks):
        chunk.chunk_index = index
    return chunks


def _sentences_for_page_stream(
    pages: list[PageText], chunk_size: int, overlap: int
) -> list[_Sentence]:
    sentences: list[_Sentence] = []
    for page in pages:
        sentences.extend(_sentences_for_page(page, chunk_size, overlap))
    return sentences
