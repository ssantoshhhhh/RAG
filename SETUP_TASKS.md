# DocuMind — Manual setup checklist

Everything that can be automated is already built and tested. This document lists
only the tasks that require **your accounts, keys, files, or decisions**.

Work top to bottom. Total time is about 10 minutes (excluding the first Docker
build and the first embedding-model download).

---

## 1. Required accounts and secrets

### 1.1 Ollama model (required for answers)

DocuMind uses the local Ollama model `llama3:instruct` by default.

- [ ] Install Ollama from <https://ollama.com> and make sure it is running.
- [ ] Pull the model once:

```bash
ollama pull llama3:instruct
ollama list
```

- [ ] To use a different installed model, set `OLLAMA_MODEL=<model>` in `.env`.

Without Ollama/model the app still runs, uploads and indexes documents, and shows
`Ollama: Unavailable` in Settings — but asking questions will fail with a clear
connection or model-not-found error.

**Alternative — Gemini:** set `LLM_PROVIDER=gemini` and `GEMINI_API_KEY=<key>`
(from <https://aistudio.google.com/app/apikey>). Keep the key private; it is used
only by the backend and never exposed to the browser.

### 1.2 JWT secret (required)

Generate one and paste it into `.env`:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

- [ ] Set `JWT_SECRET=` in `.env`.

Changing this later invalidates existing sessions (users simply sign in again).

### 1.3 Database (choose one)

**Option A — Docker Postgres (easiest, no account):**

- [ ] Do nothing. `docker compose up` starts Postgres and the default
      `DATABASE_URL` is already correct.

**Option B — Supabase (optional):**

- [ ] Create a project at <https://supabase.com>.
- [ ] Open **Project Settings → Database → Connection string → Session Pooler**.
- [ ] Copy the URI and convert the scheme to SQLAlchemy's psycopg driver:

```dotenv
DATABASE_URL=postgresql+psycopg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

- [ ] URL-encode special characters in the password (for example `@` → `%40`).
- [ ] Use the **Session Pooler** host (IPv4-compatible), not the direct connection
      host, if your network lacks IPv6.

Migrations are applied automatically by Docker; for local development run
`alembic upgrade head` (Section 2B).

### 1.4 Create `.env`

```bash
cd /Users/santoshkumar/persoanl_work/RAG-SIMPLE
cp .env.example .env
```

- [ ] Fill in at minimum: `JWT_SECRET` (and `DATABASE_URL` if using Supabase).
- [ ] Ollama defaults are already set: `LLM_PROVIDER=ollama`,
      `OLLAMA_MODEL=llama3:instruct`. Docker automatically points the backend at
      `host.docker.internal:11434`; local processes use `localhost:11434`.
- [ ] Never commit `.env` (it is already git-ignored).

---

## 2. Start DocuMind

Choose **one** path.

### Option A — Docker (recommended)

Requirements: Docker Desktop / Docker Engine with Compose v2.

```bash
cd /Users/santoshkumar/persoanl_work/RAG-SIMPLE
docker compose up --build
```

- [ ] Wait for `backend` and `frontend` health checks to pass.
- [ ] Open <http://localhost:3000>.
- [ ] Open <http://localhost:8000/docs> if you want the interactive API docs.
- [ ] Check <http://localhost:8000/api/v1/health> shows `"status": "ok"`.

Notes:
- The first build downloads Python ML dependencies (several minutes).
- The first document upload downloads the embedding model (~90 MB) into the
  `documind_data` volume. Subsequent uploads are fast.
- Uploads, extracted text, Chroma vectors, and the model cache persist across
  `docker compose down` / `up`. To reset everything (including the database):
  `docker compose down -v` (destructive).

Useful commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
```

### Option B — Local processes

Requirements: Python 3.12–3.14, Node.js 20.9+ (22/24 recommended), and
PostgreSQL (Docker Postgres from Option A also works: `docker compose up -d postgres`).

```bash
cd /Users/santoshkumar/persoanl_work/RAG-SIMPLE

python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

cd backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd /Users/santoshkumar/persoanl_work/RAG-SIMPLE/frontend
npm install
npm run dev
```

- [ ] Open <http://localhost:3000>.
- [ ] If the backend is not on port 8000, create `frontend/.env.local` with
      `BACKEND_URL=http://localhost:<port>` and restart `npm run dev`.

Run the checks before relying on the deployment:

```bash
# backend (venv active, from backend/)
pytest
ruff check .

# frontend (from frontend/)
npm run typecheck
npm test
npm run build
```

---

## 3. First-run product checks

These require a browser and your own files.

- [ ] **Create an account** at `/register` (name, email, password ≥ 8 characters
      with a letter and a number).
- [ ] **Upload documents** on the Documents page. Manual files are not included.
      Use PDFs with selectable text (not scanned images) or `.txt` files, max
      10 MB each, up to 10 at a time.
- [ ] Wait for each document to move `Queued → Processing → Indexing → Indexed`.
      The page polls automatically.
- [ ] If a document is `FAILED`, open it, read the failure message, and press
      **Retry**. Image-only/scanned PDFs are rejected because there is no
      extractable text.
- [ ] **Ask a question** in Chat. Verify the answer shows citation chips like
      `filename.pdf · p.4`; click one to inspect the exact excerpt.
- [ ] Ask something unrelated to your files and confirm DocuMind refuses rather
      than inventing an answer.
- [ ] Optional: open Settings and confirm **API & database**, **Vector store**,
      and **Ollama · llama3:instruct** are all Operational.
- [ ] Optional: test on a phone-sized viewport (mobile navigation and chat
      history drawer).

### Optional SciQ corpus (if you want data without uploading files)

This creates a user and imports science passages + an evaluation file. It uses
the same database and storage as the app.

```bash
cd /Users/santoshkumar/persoanl_work/RAG-SIMPLE
source .venv/bin/activate
pip install -r backend/scripts/requirements-sciq.txt

cd backend
python scripts/import_sciq.py --limit 20 --user-email sciq@example.com
python scripts/evaluate_sciq.py --user-email sciq@example.com --limit 20
```

- [ ] Set `SCIQ_IMPORT_EMAIL` / `SCIQ_IMPORT_PASSWORD` in `.env` if you want a
      repeatable login for the import account instead of a generated password.
- [ ] Evaluation uses the configured LLM (`ollama` by default, or `gemini`).
- [ ] Re-running the import is safe (content-hash deduplication).

---

## 4. Production / public deployment checklist

Only needed if you expose DocuMind beyond your machine.

- [ ] Serve over HTTPS and set `COOKIE_SECURE=true`; set `ENVIRONMENT=production`.
- [ ] Use a strong, unique `JWT_SECRET`; never reuse the example value.
- [ ] Put the frontend and backend behind a reverse proxy (or keep the bundled
      Next.js proxy). Do not expose PostgreSQL port `5432` publicly.
- [ ] Restrict `CORS_ORIGINS` / `FRONTEND_ORIGIN` to your real domain.
- [ ] If using Gemini, set quotas/billing alerts appropriate to your usage.
- [ ] Back up the Postgres volume **and** the `documind_data` volume together —
      database rows and Chroma vectors must stay in sync.
- [ ] Review the privacy implication: retrieved excerpts go to the configured
      LLM. With Ollama they stay on your machine; with Gemini they leave it.
- [ ] Consider running `docker compose up -d --build` under a process supervisor
      or platform that restarts unhealthy containers.

---

## 5. Verification checklist (copy/paste)

```bash
# Backend unit/integration tests
cd backend && pytest

# Backend lint
ruff check .

# Frontend typecheck, tests, production build
cd ../frontend && npm run typecheck && npm test && npm run build

# Live health (Docker or local backend)
curl -s http://localhost:8000/api/v1/health
```

Expected: backend `73 passed, 1 skipped`; frontend `17 passed`; a clean
typecheck/build; health JSON with `"status": "ok"`, `"llm_provider": "ollama"`,
and `"llm_available": true` once Ollama and the model are running.

---

## 6. Troubleshooting quick reference

| Problem | What to do |
| --- | --- |
| `502` / "backend unavailable" in the UI | Check `docker compose ps` or the uvicorn terminal. Verify `BACKEND_URL` for local/Compose |
| `403` on save/delete/ask | Cookies or CSRF blocked. Reload the page; allow cookies for the site |
| Answers fail with 401/403 | Sign out and back in; verify `JWT_SECRET` did not change mid-session |
| Answers fail with Ollama error | Run `ollama serve`, check `ollama list`, and verify `OLLAMA_MODEL`. In Docker use `host.docker.internal:11434` |
| Answers fail with Gemini error | Only with `LLM_PROVIDER=gemini`: verify `GEMINI_API_KEY`; 429 means quota/rate limit |
| Upload says unsupported/too large | PDF/TXT only, ≤ 10 MB, ≤ 10 files per request |
| Document FAILED | Open detail → read message → Retry; use text-based PDFs |
| Login redirect loop | Clear site cookies, then sign in again |
| Supabase connection refused | Use Session Pooler URL, URL-encoded password, `sslmode=require` |
| Data disappeared after `docker compose down` | Use `down` without `-v`; volumes are preserved only when not removed |

---

## 7. Files you may want to edit manually

| File | Why |
| --- | --- |
| `.env` | Secrets, LLM provider/model, database URL, thresholds |
| `frontend/.env.local` | Custom `BACKEND_URL` for local development |
| `README.md` | Project-specific documentation for your team |
| `docker-compose.yml` | Ports, volumes, production resource limits |

No seed data, external storage bucket, OAuth app, or email provider is required.