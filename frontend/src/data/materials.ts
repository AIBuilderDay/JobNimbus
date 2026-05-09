export type MaterialTab = "shingle" | "metal" | "membrane";

export interface MaterialCard {
  id: string;
  name: string;
  sub: string;
  price: string;
  pricePerSf: number;
  swatch: string;
}

export const MATERIALS: Record<MaterialTab, MaterialCard[]> = {
  shingle: [
    { id: "arch-charcoal", name: "Architectural", sub: "Charcoal", price: "$1.85", pricePerSf: 1.85, swatch: "#3a3a3a" },
    { id: "arch-weathered", name: "Architectural", sub: "Weathered Wood", price: "$1.85", pricePerSf: 1.85, swatch: "#7a6b5a" },
    { id: "arch-onyx", name: "Architectural", sub: "Onyx Black", price: "$1.85", pricePerSf: 1.85, swatch: "#1a1a1a" },
    { id: "arch-pewter", name: "Architectural", sub: "Pewter Gray", price: "$1.85", pricePerSf: 1.85, swatch: "#8a8a8a" },
    { id: "des-barkwood", name: "Designer", sub: "Barkwood", price: "$2.40", pricePerSf: 2.4, swatch: "#5e4a38" },
    { id: "des-slate", name: "Designer", sub: "Slate", price: "$2.40", pricePerSf: 2.4, swatch: "#5a6570" },
  ],
  metal: [
    { id: "st-galv", name: "Standing Seam", sub: "Galvalume", price: "$4.50", pricePerSf: 4.5, swatch: "#b0b5b8" },
    { id: "st-charcoal", name: "Standing Seam", sub: "Charcoal", price: "$4.75", pricePerSf: 4.75, swatch: "#3a3f42" },
    { id: "st-forest", name: "Standing Seam", sub: "Forest Green", price: "$4.75", pricePerSf: 4.75, swatch: "#2d5a3d" },
    { id: "st-barn", name: "Standing Seam", sub: "Barn Red", price: "$4.75", pricePerSf: 4.75, swatch: "#7a2e2e" },
  ],
  membrane: [
    { id: "tpo-white", name: "TPO 60mil", sub: "White", price: "$3.20", pricePerSf: 3.2, swatch: "#f0f0f0" },
    { id: "tpo-tan", name: "TPO 60mil", sub: "Tan", price: "$3.20", pricePerSf: 3.2, swatch: "#c8b898" },
    { id: "epdm-black", name: "EPDM", sub: "Black", price: "$2.90", pricePerSf: 2.9, swatch: "#222222" },
    { id: "pvc-white", name: "PVC 50mil", sub: "White", price: "$3.50", pricePerSf: 3.5, swatch: "#e8e8e8" },
  ],
};

export function getMaterialById(id: string): MaterialCard | undefined {
  for (const cards of Object.values(MATERIALS)) {
    const found = cards.find((c) => c.id === id);
    if (found) return found;
  }
  return undefined;
}
