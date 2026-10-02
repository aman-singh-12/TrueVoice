"""
TrueVoice SQLAlchemy Async Database Session Management.
Manages connection pooling, async sessions, and engine configuration.
"""

from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from app.config import settings

# Global Declarative Base
Base = declarative_base()

# Engine creation with connection pooling
def get_engine(database_url: Optional[str] = None) -> AsyncEngine:
    url = database_url or settings.DATABASE_URL
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    kwargs = {"echo": settings.DEBUG, "future": True}
    if url.startswith("sqlite"):
        # SQLite specific options
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # PostgreSQL pool parameters
        kwargs["pool_size"] = 10
        kwargs["max_overflow"] = 20
        kwargs["pool_pre_ping"] = True
    return create_async_engine(url, **kwargs)


engine = get_engine()
async_engine = engine
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Async generator yielding scoped SQLAlchemy session with rollback on error."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
