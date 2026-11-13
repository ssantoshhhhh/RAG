from dataclasses import dataclass, field


@dataclass
class PageText:
    page_number: int
    text: str


@dataclass
class ExtractionResult:
    pages: list[PageText]
    page_count: int


@dataclass
class ChunkDraft:
    text: str
    token_count: int
    page_number: int
    page_end: int
    chunk_index: int = 0


@dataclass
class RetrievedChunk:
    chunk_id: str
    text: str
    user_id: str
    document_id: str
    filename: str
    page_number: int
    page_end: int
    chunk_index: int
    similarity: float
    metadata: dict = field(default_factory=dict)
