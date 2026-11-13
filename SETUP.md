# DocuMind — Complete Setup Guide

This guide takes you from a fresh machine to a running DocuMind instance:
PostgreSQL + FastAPI + ChromaDB + Next.js, with local answers from Ollama.

There are two supported paths:

- **Option A — Docker (recommended):** every service except Ollama runs in Docker.
- **Option B — Local development:** Python and Node run on your machine;
  PostgreSQL can still run in Docker.

Both paths need **Ollama running on the host** with a model pulled. Setup takes
about 10 minutes plus downloads (Docker image build, Ollama model, embedding model).

---

## 1. Prerequisites

| Requirement | Version / notes |
| --- | --- |
| Docker Desktop / Docker Engine + Compose v2 | Required for Option A |
| Ollama | Required for local LLM answers |
| Git | To clone/update the project |
| Python | 3.12–3.14 (Option B only) |
| Node.js | 20.9+; 22 or 24 recommended (Option B only) |
| Free ports | `3000` (frontend), `8000` (backend), `5432` (Postgres), `11434` (Ollama) |
| RAM | 8 GB+ recommended for `llama3:instruct` |

Verify the basics:

```bash
docker --version
docker compose version
git --version
python3 --version
node --version
```

On Windows, run these in PowerShell. `python3` is usually `py -3.12`.

---

## 2. Install and prepare Ollama

DocuMind uses Ollama for answer generation. Document chunks never leave your
machine when `LLM_PROVIDER=ollama`. Uploading/indexing still works without
Ollama, but asking questions will fail until it is running.

### 2.1 Install Ollama

**macOS**

```bash
brew install ollama
brew services start ollama
```

Alternatively, download the app from <https://ollama.com/download> and open it.
The menu-bar app starts the server automatically.

**Linux**

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
```

**Windows**

Download and run the installer from <https://ollama.com/download>, then make
sure Ollama is running in the system tray.

### 2.2 Pull the model

```bash
ollama pull llama3:instruct
ollama list
```

`llama3:instruct` is roughly a 4.7 GB download. On a machine with less RAM, a
smaller model works too:

```bash
ollama pull llama3.2:3b
# then set OLLAMA_MODEL=llama3.2:3b in .env
```

### 2.3 Verify the Ollama API

```bash
curl -s http://localhost:11434/api/tags
```

You should get JSON listing the installed models. If the command fails, start
the server in a terminal:

```bash
ollama serve
```

If it prints `address already in use`, Ollama is already running and is fine.

### 2.4 Notes for Docker and remote Ollama

- Docker Compose already points the backend at
  `http://host.docker.internal:11434`, so the container can reach Ollama on
  macOS/Windows and on most Linux setups.
- On Linux, if the container cannot connect, Ollama may be listening only on
  `127.0.0.1`. Expose it to Docker:

  ```bash
  sudo systemctl edit ollama
  ```

  Add:

  ```ini
  [Service]
  Environment="OLLAMA_HOST=0.0.0.0:11434"
  ```

  Then reload and restart:

  ```bash
  sudo systemctl daemon-reload
  sudo systemctl restart ollama
  ```

  Only do this on a trusted network or with a firewall rule.
- To use Ollama on another machine, edit `OLLAMA_BASE_URL` in
  `docker-compose.yml` (Compose overrides the value from `.env`), then recreate
  the backend: `docker compose up -d backend`.

### 2.5 Optional: Gemini instead of Ollama

Set the following in `.env`, create a key at
<https://aistudio.google.com/app/apikey>, and recreate the backend
(`docker compose up -d backend`):

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash
```

With Gemini, retrieved document excerpts are sent to Google's API.

---

## 3. Get the project and create `.env`

```bash
cd /path/to
git clone <your-repository-url> RAG-SIMPLE
cd RAG-SIMPLE
```

If the project is already on disk, just `cd` into it.

Create your environment file:

```bash
cp .env.example .env
```

Generate a strong JWT signing secret:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

If Python is unavailable, `openssl rand -base64 48` works too.

Open `.env` and set at least:

```dotenv
JWT_SECRET=<paste the generated secret>
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3:instruct
```

The default `DATABASE_URL` matches Docker Compose:

```dotenv
DATABASE_URL=postgresql+psycopg://documind:documind@localhost:5432/documind
```

Optional values:

- `SMTP_*` and `INTERNAL_API_KEY`: only needed for password-reset emails.
  Leave them blank locally; the UI shows a direct reset link in development.
- `OLLAMA_TIMEOUT_SECONDS`, `RETRIEVAL_TOP_K`, `SIMILARITY_THRESHOLD`, and the
  chunking values: tune later if needed.
- Never commit `.env`; it is already git-ignored.

If you use Supabase instead of Docker Postgres, use the **Session Pooler** URI
and keep the `postgresql+psycopg://` scheme with `?sslmode=require`.

---

## 4. Option A — Run everything with Docker (recommended)

### 4.1 Start the stack

From the repository root:

```bash
docker compose up --build
```

Or run it in the background:

```bash
docker compose up --build -d
```

What happens:

1. PostgreSQL starts and becomes healthy.
2. The backend image builds (installs PyTorch CPU and ML dependencies), applies
   Alembic migrations, and starts FastAPI on port `8000`.
3. The frontend image builds and starts Next.js on port `3000`.
4. Ollama is **not** containerized; the backend talks to the Ollama server on
   your host.

The first build can take several minutes. Later starts are much faster.

### 4.2 Verify it is running

```bash
docker compose ps
curl -s http://localhost:8000/api/v1/health
```

Healthy output includes:

```json
{
  "status": "ok",
  "database": "ok",
  "vector_store": "ok",
  "llm_provider": "ollama",
  "llm_available": true
}
```

`llm_available` becomes `true` once Ollama is running and the configured model
is installed.

Open:

- App: <http://localhost:3000>
- API docs: <http://localhost:8000/docs>
- Backend health: <http://localhost:8000/api/v1/health>

### 4.3 Logs and lifecycle

```bash
docker compose logs -f              # all services
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

docker compose restart backend      # restart a crashed/hung service
docker compose up -d backend        # recreate after .env or compose changes
docker compose stop                 # stop without removing containers
docker compose start                # start stopped containers
docker compose down                 # stop and remove containers (data kept)
docker compose up -d --build        # rebuild after code changes
```

The backend runs `alembic upgrade head` automatically on every start, so new
migrations are applied by a rebuild/restart.

### 4.4 Data, reset, and backups

Named volumes keep your data across `docker compose down`:

- `documind_postgres` — users, documents, conversations
- `documind_data` — uploads, extracted text, Chroma vectors, model cache

Docker prefixes them with the project name; check with:

```bash
docker volume ls | grep documind
```

Reset everything (destructive — deletes users, documents, and vectors):

```bash
docker compose down -v
```

Database shell:

```bash
docker compose exec postgres psql -U documind -d documind
```

Back up PostgreSQL and the data volume together (they must stay in sync):

```bash
docker compose exec -T postgres pg_dump -U documind documind > documind.sql
docker run --rm -v rag-simple_documind_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/documind_data.tgz -C /data .
```

Replace `rag-simple_documind_data` with the name shown by `docker volume ls`
if your folder/project name differs.

---

## 5. Option B — Run locally for development

Useful when editing code, with hot reload for both backend and frontend.

### 5.1 Start PostgreSQL

The simplest option is Docker for the database only:

```bash
docker compose up -d postgres
```

This exposes PostgreSQL on `localhost:5432` with user/password/database
`documind` / `documind` / `documind`, matching the default `.env`.

If you already have PostgreSQL 14+ installed locally, create the database and
user yourself, or point `DATABASE_URL` at Supabase.

### 5.2 Start the backend (terminal 1)

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

cd backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Run the backend from `backend/`. Relative storage paths (`data`, `data/chroma`)
resolve against the backend directory.

Leave this terminal running. Logs show incoming requests and ingestion jobs.

### 5.3 Start the frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. The Next.js proxy defaults to
`http://localhost:8000`. To change it, create `frontend/.env.local`:

```dotenv
BACKEND_URL=http://localhost:8000
```

Restart `npm run dev` after editing that file.

The frontend also reads the repository-root `.env` for SMTP settings;
`frontend/.env.local` takes precedence for overlapping variables.

### 5.4 Ollama (terminal 3, only if not already running)

```bash
ollama serve
```

On macOS/Windows the desktop app normally handles this. Ensure the model from
`.env` is installed:

```bash
ollama pull llama3:instruct
```

### 5.5 Stop local development

Press `Ctrl+C` in the backend and frontend terminals. Stop the database when
done:

```bash
docker compose stop postgres
```

---

## 6. First-run checks in the app

1. Open <http://localhost:3000/register> and create an account.
   Passwords need at least 8 characters with a letter and a number.
2. Go to **Documents** and upload a text-based PDF or `.txt` file
   (max 10 MB per file, up to 10 files at once).
3. Watch the document move through `Queued → Processing → Indexed`. The first
   upload downloads the embedding model (~90 MB) and is slower.
4. Open **Chat**, ask a question about the document, and confirm the answer shows
   citation chips such as `file.pdf · p.4`.
5. Click a citation to inspect the exact excerpt.
6. Ask something unrelated and confirm DocuMind refuses instead of inventing an
   answer.
7. Open **Settings** and check that database, vector store, and Ollama are
   operational.

Scanned/image-only PDFs fail intentionally because there is no extractable text.

---

## 7. Run the test suites

Backend (venv active, from `backend/`):

```bash
pytest
ruff check .
```

Run the optional real-embedding test (downloads/loads the model):

```bash
RUN_MODEL_TESTS=1 pytest tests/test_embeddings.py
```

Frontend (from `frontend/`):

```bash
npm run typecheck
npm test
npm run build
```

The backend tests use an isolated SQLite database and fake embedding/LLM
services. The full suite should pass without Ollama running.

---

## 8. Command cheat sheet

| Task | Command |
| --- | --- |
| Pull the Ollama model | `ollama pull llama3:instruct` |
| Check Ollama | `ollama list` / `curl http://localhost:11434/api/tags` |
| Start Docker stack (foreground) | `docker compose up --build` |
| Start Docker stack (background) | `docker compose up --build -d` |
| Rebuild after code changes | `docker compose up -d --build` |
| Container status | `docker compose ps` |
| Follow logs | `docker compose logs -f backend` |
| Restart one service | `docker compose restart backend` |
| Apply `.env` changes | `docker compose up -d` (recreates affected containers) |
| Stop, keep data | `docker compose down` |
| Stop and delete all data | `docker compose down -v` |
| Open Postgres shell | `docker compose exec postgres psql -U documind -d documind` |
| Start only Postgres for local dev | `docker compose up -d postgres` |
| Backend local dev | `cd backend && uvicorn app.main:app --reload --port 8000` |
| Apply migrations manually | `cd backend && alembic upgrade head` |
| Frontend local dev | `cd frontend && npm run dev` |
| Backend tests | `cd backend && pytest` |
| Backend lint | `cd backend && ruff check .` |
| Frontend checks | `cd frontend && npm run typecheck && npm test && npm run build` |
| Live health check | `curl -s http://localhost:8000/api/v1/health` |

---

## 9. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot connect to the Docker daemon` | Start Docker Desktop / the Docker service, then retry |
| `port is already allocated` | Free the port: `lsof -nP -iTCP:3000 -sTCP:LISTEN` (macOS/Linux) or change the published port in `docker-compose.yml` |
| Login page loads but API calls return `502` | The backend is down or `BACKEND_URL` is wrong. Check `docker compose ps` and backend logs. In Compose it must be `http://backend:8000` |
| `Could not reach Ollama` | Start Ollama (`ollama serve` or the desktop app) and confirm `curl http://localhost:11434/api/tags` |
| Ollama works on the host but not in Docker (Linux) | Expose it with `OLLAMA_HOST=0.0.0.0:11434` as shown in section 2.4 |
| `model ... is not available` / model-not-found | `ollama pull <model>` and make sure `OLLAMA_MODEL` matches `ollama list` |
| First upload is very slow | The embedding model is downloading once; later uploads are faster |
| Document stuck or `FAILED` | Open the document, read the message, press Retry. Use text-based PDFs |
| `403` on upload/ask/delete | Cookies or CSRF headers are blocked. Reload the page and allow cookies |
| Login redirect loop | Clear cookies for `localhost`, then sign in again. Changing `JWT_SECRET` invalidates sessions |
| Password reset email not sent | Leave `SMTP_*` blank in development; the API returns a reset link and the UI shows **Open reset link** |
| `docker compose down` removed nothing but data looks gone after reinstalling | Do not use `down -v` unless you intend to delete volumes. Back up Postgres and `documind_data` together |
| Backend unhealthy after first start | First start can take up to ~90 seconds while dependencies load/migrations run; check `docker compose logs backend` |
| Frontend build fails in Docker | Rebuild without cache: `docker compose build --no-cache frontend` |

---

## 10. Updating the app

Docker:

```bash
git pull
docker compose up -d --build
```

Migrations run automatically in the backend container.

Local development:

```bash
git pull
source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt
cd backend && alembic upgrade head
# restart uvicorn
```

If `frontend/package.json` changed, run `npm install` in `frontend/` and restart
`npm run dev`.

---

## 11. Optional: SciQ corpus and evaluation

This imports a real science-QA corpus and benchmarks retrieval/answers. Run it
after the database is migrated:

```bash
source .venv/bin/activate
pip install -r backend/scripts/requirements-sciq.txt

cd backend
python scripts/import_sciq.py --limit 20 --user-email you@example.com
python scripts/evaluate_sciq.py --user-email you@example.com --limit 20
```

Re-running the import is safe; content hashes prevent duplicates. Set
`SCIQ_IMPORT_EMAIL` / `SCIQ_IMPORT_PASSWORD` in `.env` for a repeatable account.

---

## 12. Production and security notes

- Serve over HTTPS, set `ENVIRONMENT=production`, `COOKIE_SECURE=true`, and a
  strong unique `JWT_SECRET`.
- Restrict `FRONTEND_ORIGIN` and `CORS_ORIGINS` to your real domain.
- Do not expose PostgreSQL port `5432` publicly.
- Keep `.env` out of version control. If SMTP credentials were ever committed,
  rotate the app password.
- Back up the database and the `documind_data` volume together; vectors and
  document rows must stay in sync.
- With Ollama, document excerpts stay on your machine. With Gemini, they are
  sent to Google's API.