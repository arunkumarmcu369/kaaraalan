from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class OrderItemCreate(BaseModel):
    product_variant_id: UUID
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    due_date: date
    items: list[OrderItemCreate] = Field(min_length=1)
    mrp_glass: Optional[Decimal] = Field(default=None, ge=0)
    mrp_pet_300: Optional[Decimal] = Field(default=None, ge=0)
    mrp_pet_220: Optional[Decimal] = Field(default=None, ge=0)


class OrderReject(BaseModel):
    reason: str = Field(min_length=3)


class OrderItemOut(BaseModel):
    id: UUID
    product_variant_id: UUID
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    flavour_name: Optional[str] = None
    name: Optional[str] = None
    bottle_type: Optional[str] = None
    product_type: Optional[str] = None
    size_ml: Optional[int] = None
    size_label: Optional[str] = None
    volume_liters: Optional[Decimal] = None
    sku: Optional[str] = None

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: UUID
    order_number: str
    dealer_id: UUID
    dealer_name: Optional[str] = None
    shop_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    status: str
    due_date: date
    total_amount: Decimal
    mrp_glass: Optional[Decimal] = None
    mrp_pet_300: Optional[Decimal] = None
    mrp_pet_220: Optional[Decimal] = None
    rejection_reason: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    items: list[OrderItemOut] = []
    total_quantity: Optional[int] = None

    model_config = {"from_attributes": True}
