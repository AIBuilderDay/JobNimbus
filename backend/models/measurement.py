import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RoofSegment(BaseModel):
    model_config = ConfigDict(frozen=True)

    pitch_degrees: float
    azimuth_degrees: float
    area_sqft: float
    pitch_ratio: str | None = None  # e.g. "6:12"


class Measurement(BaseModel):
    model_config = ConfigDict(frozen=True)

    address: str
    total_roof_area_sqft: float            # THE submitted number
    predominant_pitch: str                  # "6:12"
    pitch_multiplier_applied: float = 1.0   # 1.0 means none applied
    source: Literal["google_solar", "eagleview"]
    sources_consulted: list[str] = Field(default_factory=list)
    segments: list[RoofSegment] = Field(default_factory=list)

    # EagleView-style line items, optional. Lengths in linear feet.
    ridge_lf: float = 0.0
    hip_lf: float = 0.0
    valley_lf: float = 0.0
    rake_lf: float = 0.0
    eave_lf: float = 0.0
    flashing_lf: float = 0.0
    step_flashing_lf: float = 0.0

    raw: dict = Field(default_factory=dict)  # source-of-truth blob, debugging only

    def apply_pitch_multiplier(self, rise: int, run: int) -> "Measurement":
        """Returns a NEW Measurement with the multiplier applied.
        Idempotent: do not re-multiply if pitch_multiplier_applied != 1.0."""
        if self.pitch_multiplier_applied != 1.0:
            return self
        m = math.sqrt(1 + (rise / run) ** 2)
        return self.model_copy(
            update={
                "total_roof_area_sqft": self.total_roof_area_sqft * m,
                "pitch_multiplier_applied": m,
            }
        )
