"""
TrueVoice Database Initialization and Default Seeding Module.
Ensures all table schemas are created and default administrative / analyst
credentials exist for immediate out-of-the-box authentication.
"""

import logging
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_engine, async_session_factory, Base
import app.models  # Import all models so metadata is populated
from app.models.organization import Organization, User, Policy
from app.core.security import hash_password
from app.core.constants import Role

logger = logging.getLogger("truevoice.db")

DEFAULT_USERS = [
    {
        "email": "admin@truevoice.sec",
        "password": "AdminPass123!",
        "full_name": "TrueVoice SOC Administrator",
        "role": Role.ORG_ADMIN.value,
        "org_name": "TrueVoice Security Operations",
        "tenant_code": "TRUEVOICE_HQ",
    },
    {
        "email": "analyst@truevoice.sec",
        "password": "AnalystPass123!",
        "full_name": "Sarah Chen (Senior Analyst)",
        "role": Role.SECURITY_ANALYST.value,
        "org_name": "TrueVoice Security Operations",
        "tenant_code": "TRUEVOICE_HQ",
    },
    {
        "email": "operator@truevoice.sec",
        "password": "OperatorPass123!",
        "full_name": "Marcus Miller (Voice Operator)",
        "role": Role.OPERATOR.value,
        "org_name": "TrueVoice Security Operations",
        "tenant_code": "TRUEVOICE_HQ",
    },
    {
        "email": "admin@apexfin.com",
        "password": "AdminSecurePass123!",
        "full_name": "Alice Admin",
        "role": Role.ORG_ADMIN.value,
        "org_name": "Apex Financial Corp",
        "tenant_code": "apex-financial",
    },
    {
        "email": "analyst@apexfin.com",
        "password": "AnalystSecurePass123!",
        "full_name": "Bob Analyst",
        "role": Role.SECURITY_ANALYST.value,
        "org_name": "Apex Financial Corp",
        "tenant_code": "apex-financial",
    },
]


async def init_db() -> None:
    """Create all tables and seed default users/tenants if not present."""
    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schemas verified/created successfully.")
    except Exception as e:
        logger.warning(f"Could not auto-create tables via create_all: {e}")

    try:
        async with async_session_factory() as session:
            await seed_default_data(session)
    except Exception as e:
        logger.warning(f"Default data seeding encountered notice: {e}")


async def seed_default_data(session: AsyncSession) -> None:
    """Seed default organizations and authentication accounts."""
    for user_info in DEFAULT_USERS:
        # Check if user exists
        stmt = select(User).where(User.email == user_info["email"])
        result = await session.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            continue

        # Check or create organization
        org_stmt = select(Organization).where(Organization.name == user_info["org_name"])
        org_res = await session.execute(org_stmt)
        org = org_res.scalar_one_or_none()

        if not org:
            org = Organization(
                id=uuid.uuid4(),
                name=user_info["org_name"],
                tenant_code=user_info["tenant_code"],
                is_active=True,
            )
            session.add(org)
            await session.flush()

            # Create default policy for this organization
            default_policy = Policy(
                id=uuid.uuid4(),
                org_id=org.id,
                policy_name=f"{org.name} Default Policy",
                caution_threshold=30.0,
                verify_threshold=60.0,
                block_threshold=80.0,
                enforce_transaction_lock=True,
                sensitive_amount_threshold=250000.0,
                oob_timeout_seconds=30,
                version="1.0.0",
            )
            session.add(default_policy)
            await session.flush()

        new_user = User(
            id=uuid.uuid4(),
            org_id=org.id,
            email=user_info["email"],
            full_name=user_info["full_name"],
            role=user_info["role"],
            password_hash=hash_password(user_info["password"]),
            is_active=True,
        )
        session.add(new_user)
        logger.info(f"Seeded default user account: {user_info['email']} ({user_info['role']})")

    await session.commit()


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)
    asyncio.run(init_db())
