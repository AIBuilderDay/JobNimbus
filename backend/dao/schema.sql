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
