import type { Estimate, Property, LineItem } from "../types/estimate";

export const estimates: Estimate[] = [
  {
    id: "EST-2418", version: "v3",
    name: "Delgado residence · 412 W Holloway Ave",
    address: "412 W Holloway Ave", cityState: "Tampa, FL 33606",
    owner: "Maria Delgado", parcel: "A-12-29-18-014",
    total: "$25,582", margin: "38% margin",
    sq: "22.4", sqFt: "2,240 sf", status: "sent",
    updated: "just now", updatedSub: "opens 0/1",
  },
  {
    id: "EST-2412", version: "v2",
    name: "Aldridge bungalow · 1842 Bayshore Blvd",
    address: "1842 Bayshore Blvd", cityState: "Tampa, FL 33606",
    owner: "Carmen & Joel Aldridge", parcel: "A-09-29-18-052",
    total: "$31,840", margin: "42% margin",
    sq: "28.1", sqFt: "2,810 sf", status: "signed",
    updated: "2d ago", updatedSub: "install Mar 24",
  },
  {
    id: "EST-2415", version: "draft",
    name: "Hester duplex · 4920 N Florida Ave",
    address: "4920 N Florida Ave", cityState: "Tampa, FL 33603",
    owner: "Reid Hester", parcel: "A-15-28-18-220",
    total: null, margin: null,
    sq: "36.2", sqFt: "3,620 sf", status: "draft",
    progress: { current: 3, total: 5 },
    updated: "9d stalled", updatedSub: "last in pricing", staleDays: 9,
  },
  {
    id: "EST-2410", version: "v1",
    name: "Pham residence · 1206 E 22nd Ave",
    address: "1206 E 22nd Ave", cityState: "Tampa, FL 33605",
    owner: "Linh Pham", parcel: "A-22-29-19-103",
    total: "$18,920", margin: "35% margin",
    sq: "17.6", sqFt: "1,760 sf", status: "sent",
    updated: "3d ago", updatedSub: "opens 6/1",
  },
  {
    id: "EST-2409", version: "draft",
    name: "Okafor home · 7711 Hidden Pines Cir",
    address: "7711 Hidden Pines Cir", cityState: "Tampa, FL 33625",
    owner: "Adaeze Okafor", parcel: "A-06-28-17-410",
    total: null, margin: null,
    sq: null, sqFt: "drone scheduled", status: "draft",
    progress: { current: 1, total: 5 },
    updated: "1d ago", updatedSub: "in capture",
  },
  {
    id: "EST-2406", version: "v1",
    name: "Watanabe residence · 320 S Westland Ave",
    address: "320 S Westland Ave", cityState: "Tampa, FL 33606",
    owner: "Yuki Watanabe", parcel: "A-10-29-18-088",
    total: "$22,140", margin: "36% margin",
    sq: "19.4", sqFt: "1,940 sf", status: "signed",
    updated: "5d ago", updatedSub: "install Mar 18",
  },
  {
    id: "EST-2398", version: "v2",
    name: "Gianopoulos rental · 8204 Whisper Ridge Dr",
    address: "8204 Whisper Ridge Dr", cityState: "Lutz, FL 33549",
    owner: "Spiros Gianopoulos", parcel: "A-31-27-18-040",
    total: "$29,460", margin: "39% margin",
    sq: "26.8", sqFt: "2,680 sf", status: "expired",
    updated: "38d ago", updatedSub: "no response",
  },
  {
    id: "EST-2395", version: "draft",
    name: "Thibodeaux home · 2117 W Ridge Pl",
    address: "2117 W Ridge Pl", cityState: "Tampa, FL 33614",
    owner: "Etienne Thibodeaux", parcel: "A-14-28-18-076",
    total: null, margin: null,
    sq: "14.8", sqFt: "1,480 sf", status: "draft",
    progress: { current: 2, total: 5 },
    updated: "11d stalled", updatedSub: "last in faces", staleDays: 11,
  },
  {
    id: "EST-2389", version: "v1",
    name: "Martín-Reyes home · 5611 Riverhills Dr",
    address: "5611 Riverhills Dr", cityState: "Tampa, FL 33617",
    owner: "Lucia Martín-Reyes", parcel: "A-29-28-19-202",
    total: "$41,720", margin: "44% margin",
    sq: "38.6", sqFt: "3,860 sf", status: "signed",
    updated: "13d ago", updatedSub: "installed",
  },
];

export const statusCounts = { all: 28, draft: 5, sent: 7, signed: 12, expired: 4 };

export const properties: Property[] = [
  { id: 0, line1: "412 W Holloway Ave", line2: "Tampa, FL 33606 · Hillsborough County", parcel: "A-12-29-18-3WR-000003-00009.0", tag: "recent", tagLabel: "Recent · EST-2418" },
  { id: 1, line1: "8804 Pinecrest Dr", line2: "Brandon, FL 33511 · Hillsborough County", parcel: "U-22-30-20-8YT-000018-00012.0", tag: "imagery", tagLabel: "Fresh imagery · 4d" },
  { id: 2, line1: "1402 Bayshore Blvd", line2: "Tampa, FL 33606 · Hillsborough County", parcel: "A-23-29-18-1ZH-000004-00021.0", tag: "imagery", tagLabel: "Fresh imagery · 1d" },
  { id: 3, line1: "214 Magnolia Ct", line2: "St. Petersburg, FL 33701 · Pinellas County", parcel: "B-08-31-17-5MN-000007-00003.0", tag: "recent", tagLabel: "Recent · EST-2412" },
  { id: 4, line1: "6027 Riverview Pl", line2: "Riverview, FL 33578 · Hillsborough County", parcel: "U-04-30-20-2KP-000011-00006.0", tag: null, tagLabel: null },
  { id: 5, line1: "330 N Lakeside Dr", line2: "Lakeland, FL 33801 · Polk County", parcel: "P-15-28-24-9LD-000022-00001.0", tag: null, tagLabel: null },
];

export const lineItems: LineItem[] = [
  { color: "#5a5d62", name: "Duration · Estate Gray shingles", detail: "22.4 sq · 12% waste · 6 facets", qty: "25.1 sq", unitPrice: "$485.00", total: "$12,173.50" },
  { color: "#3a3d44", name: "Ridge cap · CertainTeed Mountain Ridge", detail: "68 lf · matched to field", qty: "68 lf", unitPrice: "$8.40", total: "$571.20" },
  { color: "#e8eaec", name: "Ice & water shield · 2 courses", detail: "Eaves · valleys · low-slope", qty: "6 rolls", unitPrice: "$94.00", total: "$564.00" },
  { color: "#a8aeb6", name: "Synthetic underlayment", detail: "22.4 sq · 1 layer · 10 sq rolls", qty: "3 rolls", unitPrice: "$112.00", total: "$336.00" },
  { color: "#6e5a3f", name: "Drip edge · 5\" white aluminum", detail: "Eave + rake", qty: "112 lf", unitPrice: "$3.20", total: "$358.40" },
  { color: "#586773", name: "Pipe boots, vents, step flash", detail: "3 boots · 2 box vents · 22 lf flash", qty: "1 set", unitPrice: "$245.00", total: "$245.00" },
];
