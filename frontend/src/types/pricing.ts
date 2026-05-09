import { z } from "zod";

const LineItemSchema = z.object({
  name: z.string(),
  category: z.enum(["materials", "labor", "disposal", "permits", "addons"]),
  quantity: z.number(),
  unit: z.string(),
  unit_price_cents: z.number().int(),
  total_cents: z.number().int(),
});

const FinancingOptionSchema = z.object({
  label: z.string(),
  down_payment_cents: z.number().int(),
  apr_pct: z.number(),
  term_months: z.number().int(),
  monthly_cents: z.number().int(),
  total_financed_cents: z.number().int(),
});

export const PricingSchema = z.object({
  line_items: z.array(LineItemSchema),
  subtotal_cents: z.number().int(),
  margin_pct: z.number(),
  margin_addon_cents: z.number().int(),
  sales_tax_pct: z.number(),
  sales_tax_cents: z.number().int(),
  customer_total_cents: z.number().int(),
  financing_options: z.array(FinancingOptionSchema),
});

export type Pricing = z.infer<typeof PricingSchema>;
export type PricingLineItem = z.infer<typeof LineItemSchema>;
export type FinancingOption = z.infer<typeof FinancingOptionSchema>;

export interface PricingOverrides {
  margin_pct?: number;
  material_name?: string;
  material_unit_price_cents?: number;
  addons_cents?: number;
  waste_factor?: number;
  labor_cents?: number;
  disposal_cents?: number;
  sales_tax_pct?: number;
}
