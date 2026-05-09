export type EstimateStatus = "sent" | "signed" | "draft" | "expired";

export interface Estimate {
  id: string;
  version: string;
  name: string;
  address: string;
  cityState: string;
  owner: string;
  parcel: string;
  total: string | null;
  margin: string | null;
  sq: string | null;
  sqFt: string;
  status: EstimateStatus;
  progress?: { current: number; total: number };
  updated: string;
  updatedSub: string;
  staleDays?: number;
}

export interface Property {
  id: number;
  line1: string;
  line2: string;
  parcel: string;
  tag: "recent" | "imagery" | null;
  tagLabel: string | null;
}

export interface RoofFace {
  id: string;
  label: string;
  area: number;
  hidden?: boolean;
}

export type LineItemCategory = "materials" | "labor" | "addons" | "disposal";

export interface LineItem {
  color: string;
  name: string;
  detail: string;
  qty: string;
  unitPrice: string;
  total: string;
  category: LineItemCategory;
}

export interface CatalogItem {
  id: string;
  name: string;
  detail: string;
  color: string;
  defaultUnit: string;
  defaultUnitPrice: number;
  category: LineItemCategory;
}
