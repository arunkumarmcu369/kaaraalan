from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: UUID
    username: str
    role: str
    must_reset_password: bool
    is_active: bool
    dealer_id: Optional[UUID] = None
    dealer_name: Optional[str] = None

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    message: str


class PaginatedMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
