import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import DarkLayout from "../components/layout/DarkLayout";
import BrandMark from "../components/ui/BrandMark";
import GlassNav, {
  NavDivider,
  NavMeta,
  SavedIndicator,
  NavIconButton,
} from "../components/ui/GlassNav";
import StepCrumbs from "../components/ui/StepCrumbs";
import { useLineItems, useCatalog, useMaterials } from "../hooks/useEstimates";
import { useEstimatorStore } from "../store/estimatorStore";
import { useAutoSync } from "../hooks/useAutoSync";
import type { LineItem, LineItemCategory, CatalogItem } from "../types/estimate";


/* ------------------------------------------------------------------ */
/*  Toggle switch                                                      */
/* ------------------------------------------------------------------ */

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="relative shrink-0 cursor-pointer border-none"
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: on ? "#4C85E5" : "#d8e1f1",
        transition: "background .2s",
      }}
    >
      <span
        className="absolute top-[2px] rounded-full bg-white shadow-sm"
        style={{
          width: 16,
          height: 16,
          left: on ? 18 : 2,
          transition: "left .2s",
        }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const tabLabels = ["Materials", "Labor", "Add-ons", "Disposal & permits"];
const tabCategories: LineItemCategory[] = ["materials", "labor", "addons", "disposal"];

function Tabs({
  active,
  onChange,
  counts,
}: {
  active: number;
  onChange: (i: number) => void;
  counts: number[];
}) {
  return (
    <div className="flex gap-1 border-b border-hair px-5 pt-4">
      {tabLabels.map((t, i) => (
        <button
          key={t}
          onClick={() => onChange(i)}
          className={`pb-3 px-3 text-[13px] font-semibold cursor-pointer border-none bg-transparent flex items-center gap-1.5 ${
            i === active
              ? "text-ink border-b-2 border-blue-bright"
              : "text-muted"
          }`}
          style={
            i === active
              ? { borderBottom: "2px solid #4C85E5", marginBottom: -1 }
              : {}
          }
        >
          {t}
          {counts[i] > 0 && (
            <span
              className="text-[10px] font-mono rounded-full px-1.5 py-0.5"
              style={{
                background: i === active ? "rgba(76,133,229,0.12)" : "#f0f2f5",
                color: i === active ? "#4C85E5" : "#8a94a6",
              }}
            >
              {counts[i]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Financing option card                                              */
/* ------------------------------------------------------------------ */

function FinancingOption({
  title,
  sub,
  selected,
  onClick,
}: {
  title: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl p-3.5 cursor-pointer border transition-colors"
      style={{
        background: selected ? "rgba(76,133,229,0.06)" : "#fff",
        borderColor: selected ? "#4C85E5" : "#e6ecf6",
      }}
    >
      <div className="text-[13px] font-semibold text-ink">{title}</div>
      <div className="text-[11.5px] text-muted mt-0.5">{sub}</div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Monthly payment helper                                             */
/* ------------------------------------------------------------------ */

function monthlyPayment(total: number, down: number, aprPct: number, months: number): string {
  const principal = total - down;
  if (aprPct === 0) return Math.round(principal / months).toLocaleString();
  const r = aprPct / 100 / 12;
  const pmt = principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.round(pmt).toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  Add Item Modal                                                     */
/* ------------------------------------------------------------------ */

function AddItemModal({
  category,
  onAdd,
  onClose,
}: {
  category: LineItemCategory;
  onAdd: (item: CatalogItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data: catalogItems = [] } = useCatalog();

  const items = useMemo(() => {
    const filtered = catalogItems.filter((c) => c.category === category);
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.detail.toLowerCase().includes(q),
    );
  }, [category, search, catalogItems]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-ink">
              Add {tabLabels[tabCategories.indexOf(category)]}
            </h3>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-transparent border-none cursor-pointer hover:bg-ink/5 transition-colors"
            >
              <span className="material-symbols-rounded text-[18px] text-muted">close</span>
            </button>
          </div>
          <div className="relative">
            <span className="material-symbols-rounded text-[18px] text-muted absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tabLabels[tabCategories.indexOf(category)].toLowerCase()}...`}
              className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl border border-hair bg-blue-soft/30 outline-none focus:border-[#4C85E5] transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {items.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-muted">
              No items found
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onAdd(item);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer bg-transparent border-none hover:bg-blue-soft/40 transition-colors"
              >
                <span
                  className="shrink-0 rounded-md"
                  style={{ width: 28, height: 28, backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-ink leading-tight truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5 truncate">
                    {item.detail}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-mono font-semibold text-ink">
                    ${item.defaultUnitPrice.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-muted">
                    per {item.defaultUnit}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PricingPage                                                        */
/* ================================================================== */

export default function PricingPage() {
  const navigate = useNavigate();
  const { data: fetchedLineItems = [] } = useLineItems();
  const { address, selectedMaterialId, buildingInsights, selectedSegmentIndices, pricingState, setPricingState } = useEstimatorStore();
  const { isSyncing, lastSyncedAt, syncNow } = useAutoSync();
  const { data: materialsMap } = useMaterials();
  const [managedItems, setManagedItems] = useState<LineItem[] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(new Set());

  const allLineItems = managedItems ?? fetchedLineItems;

  const selectedMaterial = useMemo(() => {
    if (!selectedMaterialId || !materialsMap) return null;
    for (const cards of Object.values(materialsMap)) {
      const found = cards.find((c) => c.id === selectedMaterialId);
      if (found) return found;
    }
    return null;
  }, [selectedMaterialId, materialsMap]);

  const segments = buildingInsights?.segments ?? [];
  const roofAreaSqFt = selectedSegmentIndices.length > 0
    ? selectedSegmentIndices.reduce((sum, i) => sum + (segments[i]?.area_sq_ft ?? 0), 0)
    : buildingInsights?.total_roof_area_sq_ft ?? 0;

  const materialCost = selectedMaterial ? roofAreaSqFt * selectedMaterial.pricePerSf : 14248.1;
  const laborCost = 3870;
  const disposalCost = 420;

  const { activeTab, marginPct, toggles, financing } = pricingState;
  const setActiveTab = (v: number) => setPricingState({ activeTab: v });
  const setMarginPct = (v: number) => setPricingState({ marginPct: v });
  const setFinancing = (v: number) => setPricingState({ financing: v });

  const subtotal = materialCost + laborCost + disposalCost;
  const grossProfit = Math.round(subtotal * (marginPct / (100 - marginPct)));
  const customerTotal = subtotal + grossProfit;

  const toggleAt = (i: number) =>
    setPricingState({ toggles: toggles.map((v, j) => (j === i ? !v : v)) });
  const selectFinancing = (i: number) => setFinancing(i);

  const tabCounts = tabCategories.map(
    (cat) => allLineItems.filter((item) => item.category === cat).length,
  );
  const filteredItems = useMemo(
    () =>
      allLineItems
        .map((item, globalIdx) => ({ item, globalIdx }))
        .filter(({ item }) => item.category === tabCategories[activeTab]),
    [allLineItems, activeTab],
  );

  const checkedInTab = useMemo(
    () => filteredItems.filter(({ globalIdx }) => checkedIndices.has(globalIdx)),
    [filteredItems, checkedIndices],
  );

  const toggleCheck = useCallback((globalIdx: number) => {
    setCheckedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(globalIdx)) next.delete(globalIdx);
      else next.add(globalIdx);
      return next;
    });
  }, []);

  const selectAllInTab = useCallback(() => {
    setCheckedIndices((prev) => {
      const next = new Set(prev);
      for (const { globalIdx } of filteredItems) next.add(globalIdx);
      return next;
    });
  }, [filteredItems]);

  const deselectAllInTab = useCallback(() => {
    setCheckedIndices((prev) => {
      const next = new Set(prev);
      for (const { globalIdx } of filteredItems) next.delete(globalIdx);
      return next;
    });
  }, [filteredItems]);

  const deleteChecked = useCallback(() => {
    const toRemove = checkedIndices;
    const next = allLineItems.filter((_, i) => !toRemove.has(i));
    setManagedItems(next);
    setCheckedIndices(new Set());
  }, [allLineItems, checkedIndices]);

  const handleAddItem = (catalogItem: CatalogItem) => {
    const newItem: LineItem = {
      color: catalogItem.color,
      name: catalogItem.name,
      detail: catalogItem.detail,
      qty: `1 ${catalogItem.defaultUnit}`,
      unitPrice: `$${catalogItem.defaultUnitPrice.toLocaleString()}`,
      total: `$${catalogItem.defaultUnitPrice.toLocaleString()}`,
      category: catalogItem.category,
    };
    setManagedItems([...allLineItems, newItem]);
  };

  const handleNext = () => {
    syncNow();
    navigate("/proposal");
  };

  return (
    <DarkLayout>
      {/* Nav */}
      <GlassNav>
        <Link to="/" className="shrink-0">
          <BrandMark size={32} />
        </Link>

        <NavDivider />
        <NavMeta label="PROPERTY" value={address ?? "No address selected"} />
        <NavDivider />
        <StepCrumbs current={2} />
        <NavDivider />
        <SavedIndicator isSyncing={isSyncing} lastSyncedAt={lastSyncedAt} />
        <NavDivider />
        <NavIconButton icon="save" tooltip="Save" onClick={syncNow} />
        <NavIconButton icon="arrow_forward" tooltip="Continue to Proposal" variant="primary" onClick={handleNext} />
      </GlassNav>

      {/* Body */}
      <main className="relative z-[2] max-w-[1240px] mx-auto px-6 pt-14 pb-20 grid gap-6" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        {/* ---- LEFT COLUMN ---- */}
        <div className="flex flex-col gap-5">
          {/* Eyebrow + title */}
          <div>
            <div className="text-[11px] font-mono text-white/55 uppercase tracking-wider">
              FINANCING &middot; STEP 4 OF 5
            </div>
            <h1 className="font-serif text-[52px] leading-[1.04] font-normal tracking-[-1.5px] text-white mt-1.5">
              Financing
            </h1>
          </div>

          {/* Line items card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(21,41,82,0.08)] overflow-hidden">
            <Tabs active={activeTab} onChange={setActiveTab} counts={tabCounts} />

            {/* Select all / Deselect all / Delete bar */}
            {filteredItems.length > 0 && (
              <div className="flex items-center gap-2 px-5 py-2 border-b border-hair bg-blue-soft/20">
                <button
                  onClick={selectAllInTab}
                  className="text-[11px] font-semibold text-blue cursor-pointer bg-transparent border-none hover:underline"
                >
                  Select all
                </button>
                <span className="text-[11px] text-muted">·</span>
                <button
                  onClick={deselectAllInTab}
                  className="text-[11px] font-semibold text-muted cursor-pointer bg-transparent border-none hover:underline"
                >
                  Deselect all
                </button>
                {checkedInTab.length > 0 && (
                  <>
                    <span className="text-[11px] text-muted">·</span>
                    <button
                      onClick={deleteChecked}
                      className="text-[11px] font-semibold cursor-pointer bg-transparent border-none hover:underline"
                      style={{ color: "#dc3c3c" }}
                    >
                      Delete {checkedIndices.size} selected
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Table header */}
            <div
              className="grid items-center px-5 py-2.5 text-[10px] font-mono text-muted uppercase tracking-wider border-b border-hair"
              style={{ gridTemplateColumns: "36px 1fr 92px 92px 110px" }}
            >
              <span />
              <span>ITEM</span>
              <span className="text-right">QTY</span>
              <span className="text-right">UNIT $</span>
              <span className="text-right">TOTAL</span>
            </div>

            {/* Rows */}
            {filteredItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-muted">
                No {tabLabels[activeTab].toLowerCase()} added yet
              </div>
            ) : (
              filteredItems.map(({ item, globalIdx }) => (
                <div
                  key={globalIdx}
                  className="grid items-center px-5 py-3 border-b border-hair/60 last:border-b-0 hover:bg-blue-soft/40 transition-colors"
                  style={{ gridTemplateColumns: "36px 1fr 92px 92px 110px" }}
                >
                  <span className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={checkedIndices.has(globalIdx)}
                      onChange={() => toggleCheck(globalIdx)}
                      className="w-4 h-4 accent-[#4C85E5] cursor-pointer"
                    />
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className="shrink-0 rounded-md"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: item.color,
                      }}
                    />
                    <div>
                      <div className="text-[13px] font-semibold text-ink leading-tight">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {item.detail}
                      </div>
                    </div>
                  </div>
                  <span className="text-[13px] font-mono text-ink text-right">
                    {item.qty}
                  </span>
                  <span className="text-[13px] font-mono text-ink text-right">
                    {item.unitPrice}
                  </span>
                  <span className="text-[13px] font-mono font-semibold text-ink text-right">
                    {item.total}
                  </span>
                </div>
              ))
            )}

            {/* Add line */}
            <button
              onClick={() => setShowModal(true)}
              className="w-full flex items-center gap-2 px-5 py-3.5 text-[13px] font-semibold text-blue cursor-pointer bg-transparent border-none hover:bg-blue-soft/30 transition-colors"
            >
              <span className="text-lg leading-none">+</span> Add line item
            </button>

            {/* Toggles */}
            <div className="border-t border-hair px-5 py-4 flex flex-col gap-3.5">
              {[
                { label: "Manufacturer warranty", init: true },
                { label: "GAF certified", init: true },
                { label: "Solar reflective", init: false },
              ].map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">{t.label}</span>
                  <Toggle on={toggles[i]} onChange={() => toggleAt(i)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- RIGHT COLUMN ---- */}
        <div className="flex flex-col gap-5">
          {/* Eyebrow + title */}
          <div>
            <div className="text-[11px] font-mono text-white/55 uppercase tracking-wider">
              SUMMARY
            </div>
            <h1 className="font-serif text-[44px] leading-[1.06] font-normal tracking-[-1px] text-white mt-1.5">
              Estimate total.
            </h1>
          </div>

          {/* Totals card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(21,41,82,0.08)] p-5 flex flex-col gap-4">
            {/* Subtotal rows */}
            {[
              { label: selectedMaterial ? `Materials · ${selectedMaterial.name} ${selectedMaterial.sub}` : "Materials", value: `$${materialCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
              { label: "Labor", value: `$${laborCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
              { label: "Disposal & permits", value: `$${disposalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
            ].map((r) => (
              <div
                key={r.label}
                className="flex justify-between text-[13px] text-ink"
              >
                <span>{r.label}</span>
                <span className="font-mono font-semibold">{r.value}</span>
              </div>
            ))}
            <div className="flex justify-between text-[14px] font-semibold text-ink border-t border-hair pt-3">
              <span>Subtotal</span>
              <span className="font-mono">${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>

            {/* Margin slider */}
            <div className="bg-blue-soft rounded-xl p-4 mt-1">
              <div className="flex justify-between items-baseline">
                <div>
                  <div className="text-[13px] font-semibold text-ink">
                    Target margin
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    Recommended 32-42%
                  </div>
                </div>
                <div className="text-[28px] font-mono font-bold text-ink leading-none">
                  {marginPct}%
                </div>
              </div>
              <input
                type="range"
                min={20}
                max={55}
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value))}
                className="w-full mt-3 accent-[#4C85E5] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted mt-1">
                <span>20%</span>
                <span>55%</span>
              </div>
              <div className="text-[12px] text-muted mt-2">
                Adds <span className="font-semibold text-ink">${grossProfit.toLocaleString()}</span> to subtotal
              </div>
            </div>

            {/* Sales tax */}
            <div className="flex justify-between text-[13px] text-ink">
              <span>
                Sales tax · 7.5%{" "}
                <span className="text-muted text-[11px]">labor exempt</span>
              </span>
              <span className="font-mono">$0.00</span>
            </div>

            {/* Grand total */}
            <div className="border-t border-hair pt-4 mt-1">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[13px] font-semibold text-ink">
                    Customer total
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {financing === 0 && "$0 down · 84mo"}
                    {financing === 1 && "$2,500 down · 60mo"}
                    {financing === 2 && "Same as cash · 18mo"}
                    {financing === 3 && "Pay in full · 3% discount"}
                  </div>
                </div>
                <div className="text-[36px] font-mono font-bold text-ink leading-none tracking-tight">
                  ${Math.round(financing === 3 ? customerTotal * 0.97 : customerTotal).toLocaleString()}
                </div>
              </div>
            </div>

            {/* CTA bar */}
            <div className="border-t border-hair pt-4 flex items-center justify-between">
              <span className="text-[11.5px] text-muted">
                All figures lock when you continue.
              </span>
              <button
                onClick={handleNext}
                className="py-2.5 px-5 bg-ink text-white rounded-xl text-[13px] font-semibold cursor-pointer border-none hover:bg-ink-2 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>

          {/* Financing card */}
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(21,41,82,0.08)] p-5">
            <div className="text-[15px] font-semibold text-ink mb-3">
              Financing
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <FinancingOption
                title="$0 down · 84 mo"
                sub={`9.99% APR · $${monthlyPayment(customerTotal, 0, 9.99, 84)}/mo`}
                selected={financing === 0}
                onClick={() => selectFinancing(0)}
              />
              <FinancingOption
                title="$2,500 down · 60 mo"
                sub={`7.99% APR · $${monthlyPayment(customerTotal, 2500, 7.99, 60)}/mo`}
                selected={financing === 1}
                onClick={() => selectFinancing(1)}
              />
              <FinancingOption
                title="Same as cash · 18 mo"
                sub={`0% promo · $${monthlyPayment(customerTotal, 0, 0, 18)}/mo`}
                selected={financing === 2}
                onClick={() => selectFinancing(2)}
              />
              <FinancingOption
                title="Pay in full"
                sub={`3% discount · $${Math.round(customerTotal * 0.97).toLocaleString()}`}
                selected={financing === 3}
                onClick={() => selectFinancing(3)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Add Item Modal */}
      {showModal && (
        <AddItemModal
          category={tabCategories[activeTab]}
          onAdd={handleAddItem}
          onClose={() => setShowModal(false)}
        />
      )}
    </DarkLayout>
  );
}
