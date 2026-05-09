import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DarkLayout from "../components/layout/DarkLayout";
import BrandMark from "../components/ui/BrandMark";
import GlassNav, {
  NavDivider,
  NavMeta,
  NavPrimaryButton,
} from "../components/ui/GlassNav";
import StatusPill from "../components/ui/StatusPill";
import { useEstimates } from "../hooks/useEstimates";
import type { Estimate, EstimateStatus } from "../types/estimate";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FilterKey = "all" | EstimateStatus;

interface FilterChip {
  key: FilterKey;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Stat Cards                                                         */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}

function StatCard({ label, value, sub, accent = false }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        accent
          ? "bg-blue-bright/16 border-blue-bright/30"
          : "bg-white/6 border-white/10"
      }`}
    >
      <div className="text-[9.5px] font-mono text-white/50 uppercase tracking-wider mb-1.5">
        {label}
      </div>
      <div className="text-[28px] font-semibold text-white leading-none tracking-tight">
        {value}
      </div>
      <div className="text-[11.5px] font-mono text-white/45 mt-1.5">{sub}</div>
    </div>
  );
}

function StatCards() {
  return (
    <div className="grid grid-cols-4 gap-4 mb-7">
      <StatCard
        label="PIPELINE VALUE"
        value="$184,210"
        sub="7 active · avg $26,316"
        accent
      />
      <StatCard
        label="SIGNED · 90 DAYS"
        value="12"
        sub="$298,640 closed · 41% win rate"
      />
      <StatCard label="DRAFTS OPEN" value="5" sub="3 stalled > 7 days" />
      <StatCard
        label="AVG TIME TO SEND"
        value="4:12"
        sub="capture → proposal sent"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter Bar                                                         */
/* ------------------------------------------------------------------ */

const FILTERS: FilterChip[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "sent", label: "Sent" },
  { key: "signed", label: "Signed" },
  { key: "expired", label: "Expired" },
];

interface FilterBarProps {
  active: FilterKey;
  counts: Record<string, number>;
  onFilterChange: (key: FilterKey) => void;
}

function FilterBar({ active, counts, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {FILTERS.map((f) => {
        const isActive = f.key === active;
        return (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`py-2 px-3.5 rounded-lg text-[12.5px] font-semibold font-sans border-none cursor-pointer transition-colors ${
              isActive
                ? "bg-white text-ink"
                : "bg-white/6 text-white/70 hover:bg-white/10"
            }`}
          >
            {f.label}{" "}
            <span className={isActive ? "text-ink/60" : "text-white/40"}>
              {counts[f.key] ?? 0}
            </span>
          </button>
        );
      })}

      <div className="flex-1" />

      <select className="bg-white/6 border border-white/10 rounded-lg py-2 px-3 text-[12.5px] text-white/70 font-sans cursor-pointer outline-none appearance-none">
        <option>Sort: Updated</option>
        <option>Sort: Total</option>
        <option>Sort: Name</option>
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Estimate Row                                                       */
/* ------------------------------------------------------------------ */

const thumbnailGradient: Record<EstimateStatus, string> = {
  sent: "from-[#5a7aa8] to-[#3d5f8a]",
  signed: "from-[#3aa676] to-[#2d8760]",
  draft: "from-[#c49a5c] to-[#a87f44]",
  expired: "from-[#6b7a96] to-[#525f73]",
};

const progressColor: Record<EstimateStatus, string> = {
  draft: "bg-amber",
  sent: "bg-blue",
  signed: "bg-green",
  expired: "bg-muted-2",
};

function EstimateRow({
  estimate,
  isLast,
}: {
  estimate: Estimate;
  isLast: boolean;
}) {
  const grad = thumbnailGradient[estimate.status];

  return (
    <div
      className={`grid items-center gap-3.5 px-3.5 py-[14px] hover:bg-blue-100 transition-colors cursor-pointer ${
        isLast ? "" : "border-b border-hair/40"
      }`}
      style={{
        gridTemplateColumns: "50px 1fr 110px 110px 100px 130px 130px 60px",
      }}
    >
      {/* Thumbnail */}
      <div
        className={`w-[42px] h-[42px] rounded-lg bg-linear-to-br ${grad} flex items-center justify-center`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          <path d="M3 11 L10 4 L17 11 L17 16 L12 16 L12 12 L8 12 L8 16 L3 16 Z" />
        </svg>
      </div>

      {/* Property */}
      <div className="min-w-0">
        <div className="text-[13.5px] font-bold text-ink truncate">
          {estimate.name}
        </div>
        <div className="text-[11.5px] font-mono text-muted truncate">
          {estimate.address} · {estimate.cityState}
        </div>
      </div>

      {/* EST ID */}
      <div>
        <div className="text-[13px] font-mono text-ink">{estimate.id}</div>
        <div className="text-[11px] font-mono text-muted">{estimate.version}</div>
      </div>

      {/* Total / margin */}
      <div>
        {estimate.total ? (
          <>
            <div className="text-[13px] font-semibold text-ink">
              {estimate.total}
            </div>
            <div className="text-[11px] font-mono text-muted">
              {estimate.margin}
            </div>
          </>
        ) : (
          <>
            <div className="text-[13px] text-muted">&mdash; pending</div>
            <div className="text-[11px] font-mono text-muted-2">
              no margin set
            </div>
          </>
        )}
      </div>

      {/* SQ */}
      <div>
        <div className="text-[13px] font-mono text-ink">
          {estimate.sq ? `${estimate.sq} sq` : "--"}
        </div>
        <div className="text-[11px] font-mono text-muted">{estimate.sqFt}</div>
      </div>

      {/* Status + progress */}
      <div className="flex flex-col gap-1.5">
        <StatusPill status={estimate.status} />
        {estimate.progress && (
          <div className="w-[60px] h-[5px] rounded-full bg-ink/8 overflow-hidden">
            <div
              className={`h-full rounded-full ${progressColor[estimate.status]}`}
              style={{
                width: `${(estimate.progress.current / estimate.progress.total) * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Updated */}
      <div>
        <div
          className={`text-[12.5px] font-mono ${
            estimate.staleDays ? "text-amber" : "text-muted"
          }`}
        >
          {estimate.updated}
        </div>
        <div className="text-[11px] font-mono text-muted-2">
          {estimate.updatedSub}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center justify-center text-muted-2 text-lg">
        &rarr;
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pagination                                                         */
/* ------------------------------------------------------------------ */

interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (p: number) => void;
  onPerPageChange: (pp: number) => void;
}

function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const pageNumbers: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i <= 3 || i === totalPages || Math.abs(i - page) <= 1) {
      pageNumbers.push(i);
    } else if (pageNumbers[pageNumbers.length - 1] !== "...") {
      pageNumbers.push("...");
    }
  }

  const btnBase =
    "w-8 h-8 flex items-center justify-center rounded-lg text-[12.5px] font-semibold border-none cursor-pointer transition-colors";

  return (
    <div
      className="grid items-center px-5 py-3 bg-paper-2 border-t border-hair/60 rounded-b-2xl"
      style={{ gridTemplateColumns: "1fr auto 1fr" }}
    >
      <div className="text-[12px] font-mono text-muted">
        Showing {start}&ndash;{end} of {total} estimates
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className={`${btnBase} bg-transparent text-muted ${page === 1 ? "opacity-40 cursor-default" : "hover:bg-hair"}`}
        >
          &lsaquo;
        </button>
        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-1 text-muted text-xs">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`${btnBase} ${
                p === page
                  ? "bg-ink text-white"
                  : "bg-transparent text-muted hover:bg-hair"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className={`${btnBase} bg-transparent text-muted ${page === totalPages ? "opacity-40 cursor-default" : "hover:bg-hair"}`}
        >
          &rsaquo;
        </button>
      </div>

      <div className="flex justify-end">
        <select
          value={perPage}
          onChange={(e) => {
            onPerPageChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="bg-white border border-hair rounded-lg py-1.5 px-2.5 text-[12px] font-mono text-muted cursor-pointer outline-none"
        >
          <option value={9}>9 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function EstimatesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(9);

  const { data, isLoading } = useEstimates(filter);
  const estimates = data?.estimates ?? [];
  const counts = data?.counts ?? { all: 0, draft: 0, sent: 0, signed: 0, expired: 0 };
  const total = data?.total ?? 0;

  const paged = estimates.slice((page - 1) * perPage, page * perPage);

  const handleFilterChange = (key: FilterKey) => {
    setFilter(key);
    setPage(1);
  };

  /* ---- table header columns ---- */
  const columns = [
    "", // thumbnail
    "Property",
    "Estimate",
    "Total",
    "Area",
    "Status",
    "Updated",
    "", // arrow
  ];

  return (
    <DarkLayout>
      {/* ---- Nav ---- */}
      <GlassNav variant="dark">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <BrandMark size={32} />
          <div className="flex flex-col gap-px">
            <span className="text-[13px] font-semibold text-white tracking-tight font-sans">
              Delgado Roofing Co.
            </span>
            <span className="text-[9.5px] font-mono text-white/45 tracking-wider">
              FL CCC #1331204
            </span>
          </div>
        </Link>
        <NavDivider />
        <NavMeta label="WORKSPACE" value="Tampa Bay · 4 crew" />
        <NavDivider />
        <NavMeta label="VIEWING" value="All estimates · last 90 days" />
        <NavDivider />
        <NavPrimaryButton onClick={() => navigate("/address")}>
          + New estimate
        </NavPrimaryButton>
      </GlassNav>

      {/* ---- Content ---- */}
      <main className="relative z-[2] max-w-[1320px] mx-auto px-6 pt-14 pb-20">
        {/* Header */}
        <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-mono text-white/55 uppercase tracking-wider">
              ESTIMATE LIBRARY
            </div>
            <h1 className="font-serif text-[52px] leading-[1.02] font-normal tracking-[-1.4px] text-white mt-1.5">
              Every roof{" "}
              <em className="italic text-[#94b6f0]">you've measured.</em>
            </h1>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2.5 py-2.5 px-3.5 bg-white/8 border border-white/12 rounded-xl min-w-[360px]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1.6"
            >
              <circle cx="6" cy="6" r="4.2" />
              <path d="M9.2 9.2 L12 12" strokeLinecap="round" />
            </svg>
            <input
              className="flex-1 bg-transparent border-none outline-none text-white font-sans text-[13px] placeholder:text-white/40"
              placeholder="Search by address, parcel, homeowner, or EST-id..."
            />
            <kbd className="font-mono text-[10.5px] text-white/55 bg-white/6 py-0.5 px-1.5 rounded-[5px] border border-white/10">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Stat cards */}
        <StatCards />

        {/* Filter bar */}
        <FilterBar
          active={filter}
          counts={counts}
          onFilterChange={handleFilterChange}
        />

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(21,41,82,0.08),0_0_0_1px_rgba(21,41,82,0.06)] overflow-hidden">
          {/* Table header */}
          <div
            className="grid items-center gap-3.5 px-3.5 py-3 bg-paper-2 border-b border-hair/60"
            style={{
              gridTemplateColumns: "50px 1fr 110px 110px 100px 130px 130px 60px",
            }}
          >
            {columns.map((col, i) => (
              <div
                key={i}
                className="text-[10px] font-mono text-muted uppercase tracking-wider"
              >
                {col}
              </div>
            ))}
          </div>

          {/* Rows */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted text-sm font-mono">
              Loading estimates...
            </div>
          ) : paged.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted text-sm font-mono">
              No estimates found.
            </div>
          ) : (
            paged.map((est, i) => (
              <EstimateRow
                key={est.id}
                estimate={est}
                isLast={i === paged.length - 1}
              />
            ))
          )}

          {/* Pagination */}
          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        </div>
      </main>
    </DarkLayout>
  );
}
