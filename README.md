# DocuMind

DocuMind is a full-stack document Q&A application. Upload PDFs or text files, ask
questions in plain language, and get answers grounded in your own documents with
page-level citations.

- **Grounded answers** — retrieval over your files, not general model knowledge
- **Page-level citations** — every answer points to the exact source passage
- **Honest refusals** — if retrieval finds nothing relevant, DocuMind says so
- **Per-user isolation** — documents, vectors, and conversations are scoped to the owner
- **Automatic ingestion** — extract → clean → chunk → embed → index, with retry on failure
- **Optional SciQ benchmark** — import a science QA corpus and measure retrieval/answer accuracy

---

## Architecture

```
Browser (React 19 / Next.js 16)
        │  same-origin /api/v1/* proxy
        ▼
Next.js route handler ──────────────► FastAPI (Python)
                                          │
              ┌───────────────────────────┼────────────────────────────┐
              ▼                           ▼                            ▼
        PostgreSQL                  ChromaDB (persistent)      Ollama (local)
     users, documents,            chunk embeddings +             cited answers,
     chunks, conversations,       metadata (user_id,             JSON structured
     messages                     document_id, page)             output
```

**Stack:** FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL (or SQLite) · ChromaDB ·
sentence-transformers (`all-MiniLM-L6-v2`) · Ollama (`llama3:instruct`) · Next.js
16 App Router · React 19 · TanStack Query · Tailwind CSS 4 · TypeScript.

Gemini 2.5 Flash remains supported as a cloud alternative by setting
`LLM_PROVIDER=gemini` and `GEMINI_API_KEY`.

Authentication uses HttpOnly JWT cookies (30-minute access, 7-day refresh) with
Argon2 password hashing and double-submit CSRF protection. The browser only talks
to Next.js; the API proxy forwards cookies and CSRF headers to FastAPI.

---

## Quick start (Docker)

Prerequisites: Docker Desktop (or Docker Engine + Compose v2), plus
[Ollama](https://ollama.com) running on the host with the model pulled:

```bash
ollama pull llama3:instruct
```

```bash
cp .env.example .env
# Edit .env:
#   JWT_SECRET=<long random string>
# Ollama defaults to llama3:instruct on the host.
docker compose up --build
```

Compose points the backend at `http://host.docker.internal:11434` so the
container can reach Ollama on your machine. Change `OLLAMA_MODEL` in `.env` to
use a different installed model.

Open **http://localhost:3000**, create an account, and upload a PDF.

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/v1/health
- The first backend build installs ML dependencies and can take several minutes.
- The embedding model (~90 MB) downloads on the first document processing run and
  is cached in the `documind_data` volume.

Compose starts PostgreSQL, applies migrations automatically, and persists
uploads, extracted text, and ChromaDB data in named volumes. See
[SETUP_TASKS.md](./SETUP_TASKS.md) for the manual checklist.

---

## Local development

Prerequisites: Python 3.12–3.14, Node.js 20.9+ (Node 22/24 recommended),
PostgreSQL 14+ or a Supabase database. Docker is optional for Postgres.

### 1. Environment

```bash
cp .env.example .env
```

Fill in at minimum:

```dotenv
DATABASE_URL=postgresql+psycopg://documind:documind@localhost:5432/documind
JWT_SECRET=<long random string>
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:instruct
```

Ollama must be running (`ollama serve`) and the model available
(`ollama pull llama3:instruct`). To use Gemini instead, set
`LLM_PROVIDER=gemini` and `GEMINI_API_KEY=<your key>`.

No local Postgres? Start only the container:

```bash
docker compose up -d postgres
```

Or point `DATABASE_URL` at Supabase (use the Session Pooler URI and keep the
`postgresql+psycopg://` scheme, with `?sslmode=require`).

### 2. Backend

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

cd backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Backend tests and lint (from `backend/`, with the venv active):

```bash
pytest
ruff check .
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The app proxy defaults to `http://localhost:8000`;
override it by creating `frontend/.env.local`:

```dotenv
BACKEND_URL=http://localhost:8000
```

Frontend checks:

```bash
npm run typecheck
npm test
npm run build
```

---

## Configuration

All backend settings are environment variables loaded from the repository-root
`.env` (then `backend/.env`). See `.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | local Postgres | SQLAlchemy URL (`postgresql+psycopg://…` or `sqlite:///…`) |
| `JWT_SECRET` | insecure dev value | Signing key for access/refresh tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access cookie lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh cookie lifetime |
| `PASSWORD_RESET_EXPIRE_MINUTES` | `30` | Password reset link lifetime |
| `INTERNAL_API_KEY` | empty | Shared with the Next.js proxy so it can fetch reset links in production |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `FRONTEND_ORIGIN` / `CORS_ORIGINS` | `http://localhost:3000` | Allowed browser origins |
| `BACKEND_URL` | `http://localhost:8000` | Next.js proxy target (frontend env) |
| `LLM_PROVIDER` | `ollama` | Answer provider: `ollama` or `gemini` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3:instruct` | Installed Ollama model |
| `OLLAMA_TIMEOUT_SECONDS` | `120` | Local generation timeout |
| `OLLAMA_NUM_CTX` | `8192` | Ollama context window |
| `GEMINI_API_KEY` | empty | Required only when `LLM_PROVIDER=gemini` |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model ID |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence-transformers model |
| `CHUNK_SIZE_TOKENS` | `500` | Target chunk size |
| `CHUNK_OVERLAP_TOKENS` | `100` | Overlap between chunks |
| `MIN_CHUNK_TOKENS` | `50` | Chunks below this are merged/dropped |
| `RETRIEVAL_TOP_K` | `5` | Passages retrieved per question |
| `SIMILARITY_THRESHOLD` | `0.2` | Minimum cosine similarity to count as evidence |
| `MAX_UPLOAD_BYTES` | `10485760` | 10 MB per file |
| `DATA_DIR` | `backend/data` | Uploads, extracted text, Chroma, SciQ cache |
| `CHROMA_PERSIST_DIR` | `backend/data/chroma` | Chroma persistence directory |

Relative storage paths resolve against `backend/`, regardless of where the
process is started from.

Password reset emails are sent by the Next.js server using nodemailer. Configure
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and
`SMTP_USE_TLS` in `frontend/.env.local` for local development (or in the root
`.env` for Docker Compose). `INTERNAL_API_KEY` must match in both the backend and
frontend. Without SMTP, the API returns the reset link outside production so the
flow remains testable locally.

---

## How ingestion and answering work

1. **Upload** — PDF/TXT only, max 10 MB and 10 files per request. Filenames are
   sanitized and contents are checked (not just the extension). The file is
   stored under `data/uploads/` and a `Document` row is created with `UPLOADED`.
2. **Extract & clean** — PyMuPDF extracts text per page; whitespace, control
   characters, and repeated artifacts are normalized. Page numbers are retained.
3. **Chunk** — tiktoken-based sentence-aware chunks (500 tokens, 100 overlap,
   minimum 50) with page start/end metadata.
4. **Embed & index** — `all-MiniLM-L6-v2` produces normalized 384-d vectors,
   stored in the persistent Chroma collection with user/document/page metadata.
5. **Verify** — after indexing, the pipeline confirms the stored chunk count and
   marks the document `INDEXED` (or `FAILED` with a user-safe message).
6. **Ask** — the question is embedded, top-k owned chunks above the similarity
   threshold are retrieved, and only those excerpts are sent to the configured
   LLM (local Ollama by default) with a JSON response schema. Answers carry
   `sources` (file, page, excerpt, similarity).
   If evidence is weak, the assistant returns an explicit "not enough information"
   response instead of hallucinating.

A background task runs steps 2–5; the documents UI polls status while work is in
flight.

---

## API overview

All routes are under `/api/v1` and (except auth/health) require the session cookie.
Unsafe methods also require the `X-CSRF-Token` header matching the readable
`dm_csrf` cookie.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create account, set cookies |
| `POST` | `/auth/login` | Sign in |
| `POST` | `/auth/refresh` | Rotate access/refresh cookies |
| `POST` | `/auth/logout` | Clear cookies |
| `POST` | `/auth/forgot-password` | Request a password reset link |
| `POST` | `/auth/reset-password` | Set a new password with a reset token |
| `GET` | `/auth/me` | Current user |
| `GET` | `/documents` | List/search/filter documents |
| `POST` | `/documents/upload` | Upload one or more files |
| `GET` | `/documents/{id}` | Document detail + status |
| `DELETE` | `/documents/{id}` | Delete document, chunks, vectors, file |
| `POST` | `/documents/{id}/retry` | Re-run ingestion for a failed file |
| `GET` | `/documents/{id}/preview` | Extracted text by page |
| `GET` | `/documents/{id}/file` | Original file (inline) |
| `POST` | `/conversations` | Create a conversation |
| `GET` | `/conversations` | List conversations |
| `GET` | `/conversations/{id}` | Conversation + messages |
| `PATCH` | `/conversations/{id}` | Rename / update scope |
| `DELETE` | `/conversations/{id}` | Delete conversation |
| `POST` | `/chat/ask` | Retrieve + answer (creates a conversation if omitted) |
| `GET` | `/dashboard/stats` | Real workspace statistics |
| `GET` | `/health` | Database/vector/LLM health |

---

## SciQ import and evaluation (optional)

To populate the app with a real corpus and benchmark retrieval/answers:

```bash
source .venv/bin/activate
pip install -r backend/scripts/requirements-sciq.txt

cd backend
python scripts/import_sciq.py --limit 20 --user-email you@example.com
# Repeat/re-run safely: content hashes prevent duplicate documents.

python scripts/evaluate_sciq.py --user-email you@example.com --limit 20
```

`import_sciq.py` downloads the SciQ train split, creates one TXT document per
unique supporting passage, runs the normal ingestion pipeline, and writes
`backend/data/sciq/eval.jsonl`. `evaluate_sciq.py` asks those questions through
the live RAG service and reports answer/source accuracy. Both require a migrated
database and (for evaluation) a configured LLM — local Ollama by default, or
Gemini with `LLM_PROVIDER=gemini`. Set
`SCIQ_IMPORT_EMAIL` / `SCIQ_IMPORT_PASSWORD` in `.env` to reuse a deterministic
account.

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/v1/            # auth, documents, conversations, chat, dashboard, health
│   │   ├── core/              # config, JWT/Argon2, CSRF middleware, dependencies
│   │   ├── db/                # engine, session, declarative base
│   │   ├── models/            # User, Document, DocumentChunk, Conversation, Message
│   │   ├── repositories/      # database access helpers
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── services/          # ingestion pipeline, RAG, LLM, conversations, dashboard
│   │   └── main.py            # app wiring
│   ├── alembic/               # migration environment + initial schema
│   ├── scripts/               # SciQ import/evaluation
│   └── tests/                 # pytest suite (73 passed, 1 skipped by default)
├── frontend/
│   ├── app/                   # App Router pages + /api/v1 proxy route
│   ├── components/            # UI kit, app shell, documents, chat, dashboard
│   ├── lib/                   # API client, typed queries, validation, utils
│   └── proxy.ts               # Next 16 route protection
├── docker-compose.yml
├── .env.example
└── SETUP_TASKS.md
```

---

## Testing

Backend (from `backend/`):

```bash
pytest                 # 73 passed, 1 skipped (real-model test is opt-in)
RUN_MODEL_TESTS=1 pytest tests/test_embeddings.py   # downloads/runs the real model
ruff check .
```

The suite uses an isolated temporary SQLite database + Chroma directory and fake
embedding/LLM services for deterministic tests, plus integration coverage of the
full upload → index → retrieve → answer pipeline.

Frontend (from `frontend/`):

```bash
npm run typecheck
npm test               # 17 tests
npm run build
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `502` "backend unavailable" | Ensure FastAPI is running; check `BACKEND_URL` (in Docker use `http://backend:8000`) |
| `403` on POST/PATCH/DELETE | The CSRF cookie is missing/blocked. Reload the page and retry; ensure cookies are enabled |
| `Could not reach Ollama` | Start Ollama (`ollama serve`) and confirm `OLLAMA_BASE_URL`; in Docker it must be `host.docker.internal` |
| `Ollama model ... is not available` | Run `ollama pull llama3:instruct` or set `OLLAMA_MODEL` to an installed model |
| `GEMINI_API_KEY is not configured` | Only when `LLM_PROVIDER=gemini`: add the key and restart the backend |
| Gemini `429` / `503` | Quota or transient upstream issue; retry later or switch `GEMINI_MODEL` |
| Document stuck/FAILED | Open the document, read the failure message, press Retry. Scanned image-only PDFs have no extractable text |
| First upload slow | The embedding model is downloading and warming up |
| Supabase connection errors | Use the Session Pooler URL, URL-encode the password, include `sslmode=require` |
| Login redirect loop | Clear cookies for the site; restart with a valid `JWT_SECRET` |

## Security notes

- Keep `.env` out of version control; rotate `JWT_SECRET` to invalidate sessions.
- Set `COOKIE_SECURE=true` and terminate TLS at a reverse proxy in production.
- Document excerpts are sent to the configured LLM when a question is asked.
  With the default Ollama provider they stay on your machine; with Gemini they
  are sent to Google's API.
- Passwords are hashed with Argon2; cookies are HttpOnly, SameSite=Lax, and
  scoped (`dm_refresh` is limited to `/api/v1/auth`).