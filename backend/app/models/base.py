"""
TrueVoice SQLAlchemy Base Model & Type Decorators.
Provides UUID primary keys, UTC timestamps, and cross-dialect vector support.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import Column, DateTime, String, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pgvector.sqlalchemy import Vector

from app.db.session import Base


class UniversalUUID(TypeDecorator):
    """Platform-independent UUID type. Stores as String(36), converts to/from uuid.UUID."""
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))



class Vector192(TypeDecorator):
    """
    192-dimensional vector type decorator.
    Uses native pgvector Vector(192) on PostgreSQL, falls back to JSON-serialized String on SQLite.
    """
    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Vector(192))
        return dialect.type_descriptor(String)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value  # pgvector handles numpy arrays or lists
        if isinstance(value, (list, tuple)):
            return json.dumps([float(x) for x in value])
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            # pgvector returns numpy array or list
            return list(value)
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return []
        return list(value)


def utc_now() -> datetime:
    """Return timezone-aware current UTC time."""
    return datetime.now(timezone.utc)
