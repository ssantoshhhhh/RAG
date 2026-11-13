import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.core.config import get_settings
from app.db.session import get_db
from app.services.llm_service import create_llm_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> JSONResponse:
    settings = get_settings()

    database_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        logger.exception("Database health check failed")
        database_status = "unavailable"

    vector_status = "ok"
    try:
        from app.core.services import get_vector_store_service

        if not get_vector_store_service().heartbeat():
            vector_status = "unavailable"
    except Exception:  # noqa: BLE001
        vector_status = "unavailable"

    llm_available = False
    try:
        llm_available = create_llm_service(settings).check_availability()
    except Exception:  # noqa: BLE001
        logger.exception("LLM availability check failed")

    healthy = database_status == "ok" and vector_status == "ok"
    payload = {
        "status": "ok" if healthy else "degraded",
        "database": database_status,
        "vector_store": vector_status,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model_name,
        "llm_configured": settings.llm_configured,
        "llm_available": llm_available,
        "version": __version__,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    return JSONResponse(status_code=200 if healthy else 503, content=payload)
