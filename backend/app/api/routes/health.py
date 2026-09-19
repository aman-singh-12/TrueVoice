"""
TrueVoice Health & Readiness Endpoints.
Reports operational status, loaded ML model status, and database connectivity.
"""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.config import get_settings
from app.dependencies import get_db
from app.detectors.registry import DetectorRegistry

router = APIRouter(tags=["Health"])


@router.get("/health", status_code=status.HTTP_200_OK)
@router.get("/v1/health", status_code=status.HTTP_200_OK)
async def health_check(db: AsyncSession = Depends(get_db)):
    """System health check and component diagnostics."""
    settings = get_settings()

    # Verify database connectivity
    db_status = "HEALTHY"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as ex:
        db_status = f"UNHEALTHY: {str(ex)}"

    # Check resident detector
    registry = DetectorRegistry.get_registry()
    detector = registry.initialize_primary_detector()

    return {
        "status": "ONLINE" if db_status == "HEALTHY" else "DEGRADED",
        "service": "TrueVoice MVP Backend",
        "version": "1.2.0",
        "database": db_status,
        "primary_detector": {
            "name": detector.get_model_name(),
            "version": detector.get_model_version(),
            "mode": settings.truevoice_ml_mode,
        },
        "target_specifications": {
            "analysis_window_seconds": settings.window_seconds,
            "hop_seconds": settings.hop_seconds,
            "initial_accumulation_target": "approx. 2.0s audio accumulation + target processing latency",
            "target_processing_latency_ms": 120,
        },
    }


@router.get("/ready", status_code=status.HTTP_200_OK)
@router.get("/v1/ready", status_code=status.HTTP_200_OK)
async def readiness_probe(db: AsyncSession = Depends(get_db)):
    """Deep readiness probe for load balancers and container orchestrators."""
    settings = get_settings()
    errors = []

    # 1. Probe database
    try:
        await db.execute(text("SELECT 1"))
    except Exception as ex:
        errors.append(f"Database error: {str(ex)}")

    # 2. Probe primary model initialization
    try:
        registry = DetectorRegistry.get_registry()
        detector = registry.initialize_primary_detector()
        if not detector:
            errors.append("Primary detector not loaded")
    except Exception as ex:
        errors.append(f"Detector error: {str(ex)}")

    if errors:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ready": False, "errors": errors, "version": settings.VERSION}
        )

    return {"ready": True, "service": "TrueVoice Backend", "version": settings.VERSION}
