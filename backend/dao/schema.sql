CREATE TABLE IF NOT EXISTS properties (
    id                  TEXT PRIMARY KEY,
    address             TEXT NOT NULL UNIQUE,
    formatted_address   TEXT,
    lat                 REAL NOT NULL,
    lng                 REAL NOT NULL,
    place_id            TEXT,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estimates (
    id                  TEXT PRIMARY KEY,
    property_id         TEXT NOT NULL,
    payload_json        TEXT NOT NULL,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE TABLE IF NOT EXISTS eagleview_cache (
    address_normalized  TEXT PRIMARY KEY,
    job_id              TEXT,
    status              TEXT NOT NULL,
    raw_response_json   TEXT,
    measurements_json   TEXT,
    requested_at        TEXT NOT NULL,
    completed_at        TEXT
);

-- ── Estimate list view (presentation-ready) ──────────────────────────
CREATE TABLE IF NOT EXISTS estimate_listings (
    id              TEXT PRIMARY KEY,
    version         TEXT NOT NULL,
    name            TEXT NOT NULL,
    address         TEXT NOT NULL,
    city_state      TEXT NOT NULL,
    owner           TEXT NOT NULL,
    parcel          TEXT NOT NULL,
    total_display   TEXT,
    margin_display  TEXT,
    sq              TEXT,
    sq_ft           TEXT NOT NULL,
    status          TEXT NOT NULL CHECK(status IN ('sent','signed','draft','expired')),
    progress_current INTEGER,
    progress_total   INTEGER,
    updated         TEXT NOT NULL,
    updated_sub     TEXT NOT NULL,
    stale_days      INTEGER,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Line items per estimate listing ──────────────────────────────────
CREATE TABLE IF NOT EXISTS estimate_line_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    estimate_id  TEXT NOT NULL,
    color        TEXT NOT NULL,
    name         TEXT NOT NULL,
    detail       TEXT NOT NULL,
    qty          TEXT NOT NULL,
    unit_price   TEXT NOT NULL,
    total        TEXT NOT NULL,
    category     TEXT NOT NULL CHECK(category IN ('materials','labor','addons','disposal')),
    sort_order   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (estimate_id) REFERENCES estimate_listings(id)
);

-- ── Roofing catalog (materials, labor, add-ons, disposal) ────────────
CREATE TABLE IF NOT EXISTS catalog_items (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    detail          TEXT NOT NULL,
    color           TEXT NOT NULL,
    default_unit    TEXT NOT NULL,
    default_unit_price REAL NOT NULL,
    category        TEXT NOT NULL CHECK(category IN ('materials','labor','addons','disposal')),
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ── Material swatches (shingle / metal / membrane) ───────────────────
CREATE TABLE IF NOT EXISTS materials (
    id           TEXT PRIMARY KEY,
    tab          TEXT NOT NULL CHECK(tab IN ('shingle','metal','membrane')),
    name         TEXT NOT NULL,
    sub          TEXT NOT NULL,
    price_display TEXT NOT NULL,
    price_per_sf REAL NOT NULL,
    swatch       TEXT NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0
);
