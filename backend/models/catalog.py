from typing import Literal

from pydantic import BaseModel, ConfigDict


class CatalogItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    detail: str
    color: str
    default_unit: str
    default_unit_price: float
    category: Literal["materials", "labor", "addons", "disposal"]


class Material(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    tab: Literal["shingle", "metal", "membrane"]
    name: str
    sub: str
    price_display: str
    price_per_sf: float
    swatch: str
