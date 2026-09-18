"""
Pytest configuration and shared async test fixtures for TrueVoice backend.
Uses SQLite in-memory with aiosqlite for fast, isolated test runs.
"""

import asyncio
from datetime import timedelta
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
import uuid

from app.config import settings
from app.core.constants import Role
from app.core.security import hash_password, create_access_token
from app.db.session import Base
from app.dependencies import get_db
from app.models.organization import Organization
from app.models.user import User
from app.main import app

# Test SQLite in-memory engine
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create session-level event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create fresh in-memory schema and session per test function."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        future=True,
    )

    # Build schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    # Drop schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def seeded_tenant(test_db_session: AsyncSession):
    """Seed sample organization and admin/analyst users."""
    org = Organization(
        id=uuid.uuid4(),
        name="Apex Financial Corp",
        tenant_code="apex-financial",
    )

    test_db_session.add(org)
    await test_db_session.flush()

    admin_user = User(
        id=uuid.uuid4(),
        org_id=org.id,
        email="admin@apexfin.com",
        password_hash=hash_password("AdminSecurePass123!"),
        full_name="Alice Admin",
        role=Role.ORG_ADMIN.value,
        is_active=True,
    )
    analyst_user = User(
        id=uuid.uuid4(),
        org_id=org.id,
        email="analyst@apexfin.com",
        password_hash=hash_password("AnalystSecurePass123!"),
        full_name="Bob Analyst",
        role=Role.SECURITY_ANALYST.value,
        is_active=True,
    )
    test_db_session.add_all([admin_user, analyst_user])
    await test_db_session.commit()
    await test_db_session.refresh(org)
    await test_db_session.refresh(admin_user)
    await test_db_session.refresh(analyst_user)

    admin_token = create_access_token(
        subject=str(admin_user.id),
        org_id=str(org.id),
        role=admin_user.role,
        secret_key=settings.SECRET_KEY,
    )
    analyst_token = create_access_token(
        subject=str(analyst_user.id),
        org_id=str(org.id),
        role=analyst_user.role,
        secret_key=settings.SECRET_KEY,
    )

    return {
        "org": org,
        "admin": admin_user,
        "analyst": analyst_user,
        "admin_token": admin_token,
        "analyst_token": analyst_token,
    }


@pytest_asyncio.fixture(scope="function")
async def async_client(test_db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTP async client with DB dependency override."""
    async def override_get_db():
        yield test_db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
