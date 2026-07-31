from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class DealerCreate(BaseModel):
    dealer_name: str = Field(min_length=2, max_length=150)
    shop_name: Optional[str] = None
    phone: str = Field(min_length=5, max_length=30)
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None


class DealerUpdate(BaseModel):
    dealer_name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: Optional[bool] = None


class DealerOut(BaseModel):
    id: UUID
    user_id: UUID
    dealer_name: str
    shop_name: Optional[str]
    phone: str
    email: Optional[str]
    address: Optional[str]
    gst_number: Optional[str]
    is_active: bool
    username: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DealerCredentialsOut(BaseModel):
    dealer: DealerOut
    username: str
    password: str
    message: str = "Save these credentials — they will not be shown again."
