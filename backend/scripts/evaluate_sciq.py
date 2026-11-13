"""Evaluate the RAG pipeline against imported SciQ questions.

This is optional and requires a configured GEMINI_API_KEY plus the imports
created by `scripts/import_sciq.py`.

Usage:
    cd backend
    python scripts/evaluate_sciq.py --user-email you@example.com --limit 20
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.repositories import document_repo, user_repo  # noqa: E402
from app.services.llm_service import LLMError  # noqa: E402
from app.services.rag_service import RAGError, RAGService  # noqa: E402


def normalize(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", text.lower()).split())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate DocuMind on SciQ")
    parser.add_argument(
        "--eval-file",
        type=Path,
        default=None,
        help="Defaults to data/sciq/eval.jsonl",
    )
    parser.add_argument("--user-email", required=True, help="Owner of the imported documents")
    parser.add_argument("--limit", type=int, default=20, help="Number of questions to evaluate")
    parser.add_argument(
        "--threshold", type=float, default=None, help="Override similarity threshold"
    )
    parser.add_argument("--top-k", type=int, default=None, help="Override retrieval top-k")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    settings = get_settings()
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is not configured; cannot evaluate live answers.")

    eval_path = args.eval_file or (settings.resolved_data_dir / "sciq" / "eval.jsonl")
    if not eval_path.exists():
        raise SystemExit(f"Eval file not found: {eval_path}. Run scripts/import_sciq.py first.")

    entries = [
        json.loads(line)
        for line in eval_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ][: args.limit]

    overrides = {}
    if args.threshold is not None:
        overrides["similarity_threshold"] = args.threshold
    if args.top_k is not None:
        overrides["retrieval_top_k"] = args.top_k
    eval_settings = settings.model_copy(update=overrides) if overrides else settings

    correct = 0
    source_correct = 0
    insufficient = 0
    errors = 0
    results: list[dict] = []

    with SessionLocal() as db:
        user = user_repo.get_by_email(db, args.user_email.lower())
        if user is None:
            raise SystemExit(f"User not found: {args.user_email}")

        rag = RAGService(settings=eval_settings)
        for index, entry in enumerate(entries, start=1):
            document_id = entry.get("document_id")
            document = (
                document_repo.get_owned(db, uuid.UUID(document_id), user.id)
                if document_id
                else None
            )
            if document is None or document.status.value != "INDEXED":
                errors += 1
                results.append({"question": entry["question"], "error": "document unavailable"})
                continue

            try:
                result = rag.answer_question(
                    user_id=user.id,
                    question=entry["question"],
                    document_ids=[document.id],
                )
            except (RAGError, LLMError) as exc:
                errors += 1
                results.append({"question": entry["question"], "error": str(exc)})
                print(f"[{index}/{len(entries)}] ERROR: {exc}")
                continue

            expected = normalize(entry["correct_answer"])
            actual = normalize(result.answer)
            answer_ok = bool(expected) and expected in actual
            source_ok = any(source.document_id == str(document.id) for source in result.sources)
            if answer_ok:
                correct += 1
            if source_ok:
                source_correct += 1
            if "couldn't find the answer" in result.answer.lower():
                insufficient += 1

            results.append(
                {
                    "question": entry["question"],
                    "expected_answer": entry["correct_answer"],
                    "answer": result.answer,
                    "answer_match": answer_ok,
                    "source_match": source_ok,
                    "sources": [source.model_dump() for source in result.sources],
                }
            )
            print(
                f"[{index}/{len(entries)}] answer={'OK' if answer_ok else 'MISS'} "
                f"source={'OK' if source_ok else 'MISS'}"
            )

    total = len(entries)
    summary = {
        "dataset": "allenai/sciq",
        "questions": total,
        "answer_accuracy": round(correct / total, 4) if total else 0,
        "source_accuracy": round(source_correct / total, 4) if total else 0,
        "insufficient_answers": insufficient,
        "errors": errors,
        "similarity_threshold": eval_settings.similarity_threshold,
        "top_k": eval_settings.retrieval_top_k,
        "generated_at": datetime.now(UTC).isoformat(),
    }
    report_path = settings.resolved_data_dir / "sciq" / "eval_report.json"
    report_path.write_text(
        json.dumps({"summary": summary, "results": results}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print("\n" + json.dumps(summary, indent=2))
    print(f"\nFull report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
