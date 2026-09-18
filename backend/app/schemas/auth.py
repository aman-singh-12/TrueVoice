from datetime import datetime
from typing import Optional, Union
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.constants import Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user_id: str
    org_id: str
    role: Role


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    role: Role = Role.OPERATOR
    org_id: Optional[str] = None  # If created by org admin, defaults to admin's org


class UserResponse(BaseModel):
    id: Union[UUID, str]
    org_id: Union[UUID, str]
    email: EmailStr
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)




class SessionTokenRequest(BaseModel):
    """Request a short-lived 5-minute session-scoped ticket token for WebSocket streaming."""
    session_id: str


class SessionTokenResponse(BaseModel):
    """Short-lived WebSocket session ticket token."""
    ticket_token: str
    token_type: str = "ticket"
    expires_in_seconds: int = 300
    session_id: str

