from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


ProductType = Literal["glass", "pet"]
PetSizeMl = Literal[220, 300]


class CatalogProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    product_type: ProductType
    size_ml: Optional[int] = None
    price: Decimal = Field(gt=0)
    stock: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=10, ge=0)

    @model_validator(mode="after")
    def validate_size(self):
        if self.product_type == "pet":
            if self.size_ml not in (220, 300):
                raise ValueError("PET products require size_ml of 220 or 300")
        else:
            self.size_ml = None
        return self


class CatalogProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    product_type: Optional[ProductType] = None
    size_ml: Optional[int] = None
    price: Optional[Decimal] = Field(default=None, gt=0)
    stock: Optional[int] = Field(default=None, ge=0)
    reorder_level: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_size(self):
        if self.product_type == "pet" and self.size_ml is not None and self.size_ml not in (220, 300):
            raise ValueError("PET size_ml must be 220 or 300")
        if self.product_type == "glass":
            self.size_ml = None
        return self


class CatalogProductOut(BaseModel):
    id: UUID
    product_id: UUID
    name: str
    product_type: str
    size_ml: Optional[int] = None
    size_label: str
    price: Decimal
    stock: int
    reorder_level: int = 0
    sku: str
    is_active: bool
    created_at: Optional[datetime] = None


# Legacy nested shapes kept for internal order enrichment
class VariantOut(BaseModel):
    id: UUID
    product_id: UUID
    bottle_type: str
    volume_liters: Decimal
    sku: str
    price: Decimal
    is_active: bool
    quantity_available: Optional[int] = None
    reorder_level: Optional[int] = None
    flavour_name: Optional[str] = None
    product_type: Optional[str] = None
    size_ml: Optional[int] = None
    size_label: Optional[str] = None

    model_config = {"from_attributes": True}


# Aliases used by older imports
ProductCreate = CatalogProductCreate
ProductUpdate = CatalogProductUpdate
ProductOut = CatalogProductOut
VariantCreate = CatalogProductCreate
VariantUpdate = CatalogProductUpdate
