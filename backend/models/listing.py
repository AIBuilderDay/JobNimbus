from typing import Literal

from pydantic import BaseModel, ConfigDict


class EstimateProgress(BaseModel):
    model_config = ConfigDict(frozen=True)

    current: int
    total: int


class EstimateListing(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    version: str
    name: str
    address: str
    city_state: str
    owner: str
    parcel: str
    total: str | None = None
    margin: str | None = None
    sq: str | None = None
    sq_ft: str
    status: Literal["sent", "signed", "draft", "expired"]
    progress: EstimateProgress | None = None
    updated: str
    updated_sub: str
    stale_days: int | None = None


class EstimateLineItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    color: str
    name: str
    detail: str
    qty: str
    unit_price: str
    total: str
    category: Literal["materials", "labor", "addons", "disposal"]


class StatusCounts(BaseModel):
    model_config = ConfigDict(frozen=True)

    all: int
    draft: int
    sent: int
    signed: int
    expired: int


class DashboardStats(BaseModel):
    model_config = ConfigDict(frozen=True)

    pipeline_value_cents: int
    pipeline_count: int
    signed_count: int
    signed_value_cents: int
    drafts_open: int
    drafts_stalled: int
