from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models.measurement import Measurement


class LineItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    category: Literal["materials", "labor", "disposal", "permits", "addons"]
    quantity: float
    unit: str
    unit_price_cents: int
    total_cents: int

    @model_validator(mode="after")
    def _total_matches_qty_x_price(self) -> "LineItem":
        expected = round(self.quantity * self.unit_price_cents)
        if abs(expected - self.total_cents) > 1:  # 1¢ rounding tolerance
            raise ValueError(
                f"total_cents={self.total_cents} doesn't match quantity*unit_price_cents={expected}"
            )
        return self


class Estimate(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    property_address: str
    measurement: Measurement
    line_items: list[LineItem] = Field(default_factory=list)
    subtotal_cents: int
    waste_factor: float = 0.12
    total_cents: int
    description: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @model_validator(mode="after")
    def _subtotal_matches_line_items(self) -> "Estimate":
        if self.line_items:
            expected = sum(li.total_cents for li in self.line_items)
            if expected != self.subtotal_cents:
                raise ValueError(
                    f"subtotal_cents={self.subtotal_cents} doesn't match sum of line_items={expected}"
                )
        return self
