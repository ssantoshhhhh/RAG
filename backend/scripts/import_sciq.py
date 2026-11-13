"""Import SciQ supporting passages into DocuMind as normal documents.

Usage:
    cd backend
    python scripts/import_sciq.py --limit 100 --user-email you@example.com

The script downloads the SciQ dataset (train split) from the Hugging Face
datasets server, creates one TXT document per unique supporting passage,
runs the normal ingestion pipeline (chunk -> embed -> ChromaDB), and writes an
evaluation file with questions/correct answers under data/sciq/eval.jsonl.

Requires: pyarrow (installed via requirements-dev.txt or
`pip install -r scripts/requirements-sciq.txt`). It is intentionally not run
at application startup.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import sys
from datetime import UTC, datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx  # noqa: E402
from sqlalchemy import inspect  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models import DocumentStatus  # noqa: E402
from app.repositories import document_repo, user_repo  # noqa: E402
from app.services.document_service import create_document  # noqa: E402
from app.services.pipeline import process_document  # noqa: E402

DATASET = "allenai/sciq"
PARQUET_API = f"https://datasets-server.huggingface.co/parquet?dataset={DATASET}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import SciQ passages into DocuMind")
    parser.add_argument("--limit", type=int, default=100, help="Maximum rows to import")
    parser.add_argument(
        "--split", default="train", choices=["train", "validation", "test"], help="SciQ split"
    )
    parser.add_argument("--user-email", default=None, help="Owner email for imported documents")
    parser.add_argument("--refresh", action="store_true", help="Re-download the parquet file")
    return parser.parse_args()


def ensure_schema() -> None:
    tables = set(inspect(engine).get_table_names())
    required = {"users", "documents", "document_chunks", "conversations", "messages"}
    if not required.issubset(tables):
        raise SystemExit(
            "Database tables are missing. Run `cd backend && alembic upgrade head` first."
        )


def download_parquet(split: str, refresh: bool) -> Path:
    import pyarrow.parquet as pq  # noqa: F401 - fail early with a clear message

    settings = get_settings()
    cache_dir = settings.resolved_data_dir / "sciq"
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / f"{split}.parquet"

    if target.exists() and not refresh:
        print(f"Using cached dataset: {target}")
        return target

    response = httpx.get(PARQUET_API, timeout=60)
    response.raise_for_status()
    files = response.json().get("parquet_files", [])
    match = next(
        (item for item in files if item.get("config") == "default" and item.get("split") == split),
        None,
    )
    if not match:
        raise SystemExit(f"No parquet file found for split {split!r}")

    print(f"Downloading {match['url']} ...")
    with httpx.stream("GET", match["url"], follow_redirects=True, timeout=120) as stream:
        stream.raise_for_status()
        with target.open("wb") as handle:
            for chunk in stream.iter_bytes():
                handle.write(chunk)
    print(f"Saved dataset to {target}")
    return target


def get_or_create_user(db, args: argparse.Namespace):
    settings = get_settings()
    email = (args.user_email or settings.sciq_import_email or "sciq-demo@documind.local").lower()
    user = user_repo.get_by_email(db, email)
    if user:
        return user

    password = settings.sciq_import_password or os.environ.get("SCIQ_IMPORT_PASSWORD")
    generated = password is None
    password = password or secrets.token_urlsafe(12)
    user = user_repo.create(
        db,
        email=email,
        name="SciQ Import",
        password_hash=hash_password(password),
    )
    db.commit()
    db.refresh(user)
    print(f"Created user {email}")
    if generated:
        print(f"  Generated password: {password}")
        print("  Save it now, or set SCIQ_IMPORT_PASSWORD for repeatable imports.")
    return user


def read_rows(path: Path):
    import pyarrow.parquet as pq

    print(f"Reading {path} ...")
    table = pq.read_table(path, columns=["question", "correct_answer", "support"])
    return table.to_pylist()


def main() -> int:
    args = parse_args()
    if args.limit <= 0:
        raise SystemExit("--limit must be positive")
    ensure_schema()

    rows = read_rows(download_parquet(args.split, args.refresh))[: args.limit]
    print(f"Processing {len(rows)} SciQ rows")

    created = 0
    skipped = 0
    failed = 0
    eval_entries: list[dict] = []
    seen_hashes: dict[str, dict] = {}

    with SessionLocal() as db:
        user = get_or_create_user(db, args)
        for index, row in enumerate(rows, start=1):
            support = (row.get("support") or "").strip()
            question = (row.get("question") or "").strip()
            answer = (row.get("correct_answer") or "").strip()
            if not support or not question or not answer:
                skipped += 1
                continue

            content_hash = hashlib.sha256(support.encode("utf-8")).hexdigest()
            document_info = seen_hashes.get(content_hash)
            if document_info is None:
                existing = document_repo.find_by_content_hash(
                    db, user.id, content_hash, source="sciq"
                )
                if existing:
                    document_info = {
                        "id": str(existing.id),
                        "filename": existing.filename,
                        "status": existing.status.value,
                        "reused": True,
                    }
                    skipped += 1
                else:
                    filename = f"sciq-{content_hash[:10]}.txt"
                    try:
                        document = create_document(
                            db,
                            user=user,
                            filename=filename,
                            content=support.encode("utf-8"),
                            source="sciq",
                        )
                    except Exception as exc:  # noqa: BLE001
                        db.rollback()
                        print(f"[{index}/{len(rows)}] Failed to create document: {exc}")
                        failed += 1
                        continue

                    process_document(document.id)
                    db.expire(document)
                    db.refresh(document)
                    document_info = {
                        "id": str(document.id),
                        "filename": document.filename,
                        "status": document.status.value,
                        "reused": False,
                    }
                    if document.status == DocumentStatus.FAILED:
                        failed += 1
                        print(
                            f"[{index}/{len(rows)}] FAILED {document.filename}: "
                            f"{document.failure_message}"
                        )
                    else:
                        created += 1
                        print(
                            f"[{index}/{len(rows)}] Indexed {document.filename} "
                            f"({document.chunk_count} chunks)"
                        )
                seen_hashes[content_hash] = document_info
            else:
                skipped += 1

            eval_entries.append(
                {
                    "question": question,
                    "correct_answer": answer,
                    "support": support,
                    "support_hash": content_hash,
                    "document_id": document_info["id"],
                    "filename": document_info["filename"],
                    "document_status": document_info["status"],
                    "source": "sciq",
                }
            )

    settings = get_settings()
    eval_dir = settings.resolved_data_dir / "sciq"
    eval_dir.mkdir(parents=True, exist_ok=True)
    eval_path = eval_dir / "eval.jsonl"
    with eval_path.open("w", encoding="utf-8") as handle:
        for entry in eval_entries:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")

    summary = {
        "dataset": DATASET,
        "split": args.split,
        "rows_requested": len(rows),
        "documents_created": created,
        "documents_reused_or_skipped": skipped,
        "documents_failed": failed,
        "eval_entries": len(eval_entries),
        "eval_file": str(eval_path),
        "imported_at": datetime.now(UTC).isoformat(),
    }
    (eval_dir / "import_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("\nImport summary:")
    print(json.dumps(summary, indent=2))
    print(
        "\nRun evaluation with a Gemini key: "
        "python scripts/evaluate_sciq.py --user-email <email> --limit 20"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
