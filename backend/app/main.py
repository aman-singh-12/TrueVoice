"""
TrueVoice MVP Backend Main Application.
AI-Powered Real-Time Voice Integrity & Impersonation Attack Prevention System.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import get_settings
from app.core.logging import setup_logging
from app.core.exceptions import (
    TrueVoiceException,
    AuthenticationError,
    AuthorizationError,
    TenantAccessViolation,
    ResourceNotFoundError,
    InvalidStateTransitionException,
    AudioProcessingError,
    VerificationError,
    PolicyEvaluationError,
    AuditTamperDetectedError,
    ModelUnavailableError,
)
from app.db.session import async_engine
from app.detectors.registry import DetectorRegistry
from app.api import api_router, websocket_router

logger = logging.getLogger("truevoice")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context: initializes resident ML models and manages DB engine pool."""
    settings = get_settings()
    setup_logging(level=settings.log_level)
    logger.info("Initializing TrueVoice backend services...")

    # Initialize and keep resident the configured primary deepfake detector
    registry = DetectorRegistry.get_registry()
    detector = registry.initialize_primary_detector()
    logger.info(
        f"Resident primary detector initialized: {detector.get_model_name()} "
        f"(Version: {detector.get_model_version()}, Mode: {settings.truevoice_ml_mode})"
    )

    yield

    # Clean shutdown
    logger.info("Shutting down TrueVoice backend...")
    await async_engine.dispose()
    logger.info("Database connection pool disposed")


def create_app() -> FastAPI:
    """FastAPI Application factory."""
    settings = get_settings()

    app = FastAPI(
        title="TrueVoice API",
        version="1.2.0",
        description="AI-Powered Real-Time Voice Integrity & Impersonation Attack Prevention System",
        lifespan=lifespan,
    )

    # CORS Configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Routers
    app.include_router(api_router)
    app.include_router(websocket_router)

    # Global Exception Handlers
    @app.exception_handler(AuthenticationError)
    async def auth_error_handler(request: Request, exc: AuthenticationError):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": exc.message, "error_code": exc.error_code, "details": exc.details},
            headers={"WWW-Authenticate": "Bearer"},
        )

    @app.exception_handler(AuthorizationError)
    async def authz_error_handler(request: Request, exc: AuthorizationError):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": exc.message, "error_code": exc.error_code, "details": exc.details},
        )

    @app.exception_handler(TenantAccessViolation)
    async def tenant_error_handler(request: Request, exc: TenantAccessViolation):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": exc.message, "error_code": exc.error_code, "details": exc.details},
        )

    @app.exception_handler(ResourceNotFoundError)
    async def not_found_handler(request: Request, exc: ResourceNotFoundError):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": exc.message, "error_code": exc.error_code, "details": exc.details},
        )

    @app.exception_handler(InvalidStateTransitionException)
    async def state_transition_handler(request: Request, exc: InvalidStateTransitionException):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": exc.message, "error_code": exc.error_code, "details": exc.details},
        )

    @app.exception_handler(AudioProcessingError)
    @app.exception_handler(VerificationError)
    async def bad_request_handler(request: Request, exc: TrueVoiceException):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": exc.message, "error_code": exc.error_code, "details": exc.details},
        )

    @app.exception_handler(AuditTamperDetectedError)
    async def audit_tamper_handler(request: Request, exc: AuditTamperDetectedError):
        logger.critical(f"AUDIT INTEGRITY VIOLATION: {exc.message}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": exc.message, "error_code": exc.error_code, "details": exc.details},
        )

    @app.exception_handler(TrueVoiceException)
    async def generic_truevoice_handler(request: Request, exc: TrueVoiceException):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": exc.message, "error_code": exc.error_code, "details": exc.details},
        )

    return app


app = create_app()
