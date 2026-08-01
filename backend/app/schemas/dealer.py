from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class DealerCreate(BaseModel):
    dealer_name: str = Field(min_length=2, max_length=150)
    shop_name: Optional[str] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    email: Optional[EmailStr] = None


class DealerUpdate(BaseModel):
    dealer_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    shop_name: Optional[str] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(default=None, min_length=3, max_length=80)
    current_password: Optional[str] = Field(default=None, max_length=128)
    password: Optional[str] = Field(default=None, max_length=128)


class DealerOut(BaseModel):
    id: UUID
    user_id: UUID
    dealer_name: str
    shop_name: Optional[str]
    phone: Optional[str] = None
    email: Optional[str]
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: bool = True
    username: Optional[str] = None
    password: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DealerCredentialsOut(BaseModel):
    dealer: DealerOut
    username: str
    password: str
    message: str = "Please share these credentials with the dealer."
