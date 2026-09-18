"""
API Router aggregation.
"""
from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.sessions import router as sessions_router
from app.api.routes.speakers import router as speakers_router
from app.api.routes.verification import router as verification_router
from app.api.routes.risk import router as risk_router
from app.api.routes.policies import router as policies_router
from app.api.routes.audit import router as audit_router
from app.api.routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(sessions_router)
api_router.include_router(speakers_router)
api_router.include_router(verification_router)
api_router.include_router(risk_router)
api_router.include_router(policies_router)
api_router.include_router(audit_router)

__all__ = ["api_router"]
