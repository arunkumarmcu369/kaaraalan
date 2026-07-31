from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class StockUpdate(BaseModel):
    quantity_delta: int
    reason: str = Field(default="restock", pattern="^(restock|adjustment)$")
    reorder_level: Optional[int] = Field(default=None, ge=0)


class StockOut(BaseModel):
    id: UUID
    product_variant_id: UUID
    quantity_available: int
    reorder_level: int
    updated_at: datetime
    flavour_name: str
    name: Optional[str] = None
    bottle_type: str
    product_type: Optional[str] = None
    size_ml: Optional[int] = None
    size_label: Optional[str] = None
    volume_liters: Decimal
    sku: str
    price: Decimal
    is_low: bool = False

    model_config = {"from_attributes": True}


class DealerStockVariant(BaseModel):
    id: UUID
    bottle_type: str
    product_type: Optional[str] = None
    volume_liters: Decimal
    size_ml: Optional[int] = None
    size_label: Optional[str] = None
    sku: str
    price: Decimal
    quantity_available: int
    flavour_name: Optional[str] = None
    name: Optional[str] = None


class DealerStockGroup(BaseModel):
    product_id: UUID
    flavour_name: str
    description: Optional[str] = None
    variants: list[DealerStockVariant]


class StockMatrixRowIn(BaseModel):
    flavour: str
    glass: int = Field(ge=0)
    pet_300: int = Field(ge=0)
    pet_220: int = Field(ge=0)


class StockMatrixBulkUpdate(BaseModel):
    rows: list[StockMatrixRowIn]


class StockMatrixRowOut(BaseModel):
    flavour: str
    glass: int
    pet_300: int
    pet_220: int


class StockUpdateInfoOut(BaseModel):
    last_updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None
    previous_total_glass: Optional[int] = None
    previous_total_pet_300: Optional[int] = None
    previous_total_pet_220: Optional[int] = None
    current_total_glass: int
    current_total_pet_300: int
    current_total_pet_220: int


class StockMatrixOut(BaseModel):
    rows: list[StockMatrixRowOut]
    totals: dict
    info: StockUpdateInfoOut


class StockUpdateLogOut(BaseModel):
    id: UUID
    previous_glass_total: int
    previous_pet_300_total: int
    previous_pet_220_total: int
    new_glass_total: int
    new_pet_300_total: int
    new_pet_220_total: int
    updated_by: str
    created_at: datetime

    model_config = {"from_attributes": True}
