from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AdminSummary(BaseModel):
    pending_orders: int
    todays_orders: int
    low_stock_alerts: int
    active_dealers: int
    revenue: Decimal


class SalesTrendPoint(BaseModel):
    date: date
    series: dict[str, int]


class SalesTrendOut(BaseModel):
    categories: list[str]
    series: list[dict]


class BatchFlavourOut(BaseModel):
    flavour: str
    total_crates: int
    batches_required: float
    total_syrup_kg: float


class BatchRequiredOut(BaseModel):
    flavours: list[BatchFlavourOut]
    grand_total_crates: int
    grand_total_batches: float
    grand_total_syrup_kg: float


class DealerSummary(BaseModel):
    pending_orders: int
    approved_orders: int
    rejected_orders: int
    total_orders: int
    recent_orders: list[dict]


class NotificationOut(BaseModel):
    id: UUID
    type: str
    message: str
    order_id: Optional[UUID]
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
