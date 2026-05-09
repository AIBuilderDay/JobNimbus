"""Pricing computation.

Pure functions — no I/O, no DB. Inputs come from a measurement (slanted
roof area in sq ft, sourced from Google Solar) plus a material selection;
outputs are line items and totals in cents (per backend/CLAUDE.md). The
math mirrors PricingPage.tsx so the live UI and the server agree.
"""
import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

LineItemCategory = Literal["materials", "labor", "addons", "disposal"]

DEFAULT_LABOR_CENTS = 387_000          # $3,870 — matches PricingPage default
DEFAULT_DISPOSAL_CENTS = 42_000        # $420  — matches PricingPage default
DEFAULT_MARGIN_PCT = 38                # matches the PricingPage slider default
DEFAULT_SALES_TAX_PCT = 7.5            # labor exempt
DEFAULT_WASTE_FACTOR = 0.12            # 12% material waste


class PricingLineItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    detail: str
    category: LineItemCategory
    quantity: float
    unit: str
    unit_price_cents: int
    total_cents: int

    @model_validator(mode="after")
    def _total_matches(self) -> "PricingLineItem":
        expected = round(self.quantity * self.unit_price_cents)
        if abs(expected - self.total_cents) > 1:  # 1¢ tolerance
            raise ValueError(
                f"total_cents={self.total_cents} != quantity*unit_price={expected}"
            )
        return self


class PricingInputs(BaseModel):
    model_config = ConfigDict(frozen=True)

    roof_area_sq_ft: float = Field(..., gt=0)
    material_name: str = "Architectural Shingle"
    material_unit_price_cents: int = 575  # $5.75/sf default — Estate Gray range
    waste_factor: float = DEFAULT_WASTE_FACTOR
    labor_cents: int = DEFAULT_LABOR_CENTS
    disposal_cents: int = DEFAULT_DISPOSAL_CENTS
    margin_pct: int = DEFAULT_MARGIN_PCT  # 0..99
    sales_tax_pct: float = DEFAULT_SALES_TAX_PCT
    addons_cents: int = 0


class FinancingOption(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    down_cents: int
    apr_pct: float
    months: int
    monthly_cents: int
    discounted_total_cents: int | None = None


class Pricing(BaseModel):
    model_config = ConfigDict(frozen=True)

    line_items: list[PricingLineItem]
    subtotal_cents: int
    margin_pct: int
    margin_addon_cents: int
    sales_tax_pct: float
    sales_tax_cents: int
    customer_total_cents: int
    financing_options: list[FinancingOption] = Field(default_factory=list)

    @model_validator(mode="after")
    def _math_holds(self) -> "Pricing":
        sum_li = sum(li.total_cents for li in self.line_items)
        if sum_li != self.subtotal_cents:
            raise ValueError(
                f"subtotal_cents={self.subtotal_cents} != sum(line_items)={sum_li}"
            )
        expected_total = self.subtotal_cents + self.margin_addon_cents + self.sales_tax_cents
        if expected_total != self.customer_total_cents:
            raise ValueError(
                f"customer_total_cents={self.customer_total_cents} != "
                f"subtotal+margin+tax={expected_total}"
            )
        return self


def _margin_addon_cents(subtotal_cents: int, margin_pct: int) -> int:
    """Gross-up dollars to add so post-sale margin == margin_pct.

    Mirrors PricingPage.tsx:298 — `subtotal * (m / (100 - m))`.
    """
    if margin_pct <= 0:
        return 0
    if margin_pct >= 100:
        raise ValueError("margin_pct must be < 100")
    return round(subtotal_cents * (margin_pct / (100 - margin_pct)))


def _monthly_payment_cents(total: int, down: int, apr_pct: float, months: int) -> int:
    """Standard amortization. 0% APR = straight division. Mirrors
    PricingPage.tsx:140-146 so monthly figures agree with the UI."""
    principal = total - down
    if apr_pct == 0:
        return round(principal / months)
    r = apr_pct / 100 / 12
    pmt = principal * (r * math.pow(1 + r, months)) / (math.pow(1 + r, months) - 1)
    return round(pmt)


def compute_financing_options(customer_total_cents: int) -> list[FinancingOption]:
    """The four options the PricingPage renders. Server-side so the
    proposal payload can serialize them without re-doing the math."""
    return [
        FinancingOption(
            id="84mo_zero_down",
            title="$0 down · 84 mo",
            down_cents=0,
            apr_pct=9.99,
            months=84,
            monthly_cents=_monthly_payment_cents(customer_total_cents, 0, 9.99, 84),
        ),
        FinancingOption(
            id="60mo_2500_down",
            title="$2,500 down · 60 mo",
            down_cents=250_000,
            apr_pct=7.99,
            months=60,
            monthly_cents=_monthly_payment_cents(customer_total_cents, 250_000, 7.99, 60),
        ),
        FinancingOption(
            id="18mo_same_as_cash",
            title="Same as cash · 18 mo",
            down_cents=0,
            apr_pct=0.0,
            months=18,
            monthly_cents=_monthly_payment_cents(customer_total_cents, 0, 0, 18),
        ),
        FinancingOption(
            id="pay_in_full",
            title="Pay in full · 3% discount",
            down_cents=round(customer_total_cents * 0.97),
            apr_pct=0.0,
            months=0,
            monthly_cents=0,
            discounted_total_cents=round(customer_total_cents * 0.97),
        ),
    ]


def compute_pricing(inputs: PricingInputs) -> Pricing:
    """Compute a full pricing breakdown from area + material selection.

    Material qty carries the waste factor. Labor and disposal are flat
    fees. Sales tax applies to materials + addons + margin (labor exempt
    — see PricingPage.tsx:594).
    """
    waste_qty = round(inputs.roof_area_sq_ft * (1 + inputs.waste_factor), 2)
    material_total_cents = round(waste_qty * inputs.material_unit_price_cents)

    line_items: list[PricingLineItem] = [
        PricingLineItem(
            name=inputs.material_name,
            detail=f"{inputs.roof_area_sq_ft:.0f} sf roof + {int(inputs.waste_factor * 100)}% waste",
            category="materials",
            quantity=waste_qty,
            unit="sf",
            unit_price_cents=inputs.material_unit_price_cents,
            total_cents=material_total_cents,
        ),
        PricingLineItem(
            name="Labor",
            detail="Tear-off + install (crew of 4)",
            category="labor",
            quantity=1,
            unit="job",
            unit_price_cents=inputs.labor_cents,
            total_cents=inputs.labor_cents,
        ),
        PricingLineItem(
            name="Disposal & permits",
            detail="Dumpster + county roofing permit",
            category="disposal",
            quantity=1,
            unit="job",
            unit_price_cents=inputs.disposal_cents,
            total_cents=inputs.disposal_cents,
        ),
    ]
    if inputs.addons_cents > 0:
        line_items.append(
            PricingLineItem(
                name="Add-ons",
                detail="Selected upgrades",
                category="addons",
                quantity=1,
                unit="bundle",
                unit_price_cents=inputs.addons_cents,
                total_cents=inputs.addons_cents,
            )
        )

    subtotal_cents = sum(li.total_cents for li in line_items)
    margin_addon = _margin_addon_cents(subtotal_cents, inputs.margin_pct)

    taxable_cents = sum(
        li.total_cents for li in line_items if li.category != "labor"
    ) + margin_addon
    sales_tax_cents = round(taxable_cents * (inputs.sales_tax_pct / 100))

    customer_total_cents = subtotal_cents + margin_addon + sales_tax_cents
    financing = compute_financing_options(customer_total_cents)

    return Pricing(
        line_items=line_items,
        subtotal_cents=subtotal_cents,
        margin_pct=inputs.margin_pct,
        margin_addon_cents=margin_addon,
        sales_tax_pct=inputs.sales_tax_pct,
        sales_tax_cents=sales_tax_cents,
        customer_total_cents=customer_total_cents,
        financing_options=financing,
    )
