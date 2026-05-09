# Tech Stack

> AI-powered roofing estimation platform — from satellite imagery to signed proposal.

---

## Backend

| Technology | Purpose |
|---|---|
| **Python 3.14** | Runtime |
| **FastAPI** | REST API framework |
| **Pydantic v2** | Data validation & settings |
| **httpx** | Async HTTP client for all API integrations |
| **SQLite 3** | Lightweight relational database (8 tables) |
| **uv** | Fast Python package manager (Astral) |
| **pytest + pytest-asyncio** | Test suite with async support |
| **NumPy** | Numerical computation for roof measurements |
| **tifffile** | GeoTIFF parsing for solar/elevation data |

## Frontend

| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **TypeScript 6** | Type safety |
| **Vite 8** | Build tool & dev server |
| **Tailwind CSS 4** | Utility-first styling |
| **TanStack Query 5** | Server state & data fetching |
| **Zustand** | Client-side state management |
| **Zod 4** | Runtime schema validation at API boundaries |
| **React Router 7** | Page routing |
| **deck.gl** | Satellite map & geospatial visualization |
| **Three.js + React Three Fiber** | 3D roof model rendering |
| **pnpm** | Package manager |

## APIs & External Services

### Google Maps Platform
| API | What it does |
|---|---|
| **Solar API** | Building insights, roof segment analysis, pitch angles, area calculations |
| **Geocoding API** | Address to lat/lng resolution |
| **Places API** | Location search & autocomplete |
| **Aerial Imagery API** | High-res satellite images of properties |
| **Data Layers API** | DSM & mask GeoTIFFs for solar/elevation analysis |
| **Street View API** | Street-level property photos |

### AI / ML
| Service | What it does |
|---|---|
| **Anthropic Claude API** | AI-powered analysis and content generation |
| **Replicate** (Hunyuan 3D) | Generate 3D house models from satellite and street view images |
| **Tripo3D API** | Image-to-3D model generation with part segmentation |

### Roofing Industry
| Service | What it does |
|---|---|
| **EagleView** | Professional aerial roof measurement reports (Premium Residential) |

### Communication
| Service | What it does |
|---|---|
| **Resend** | Transactional email delivery for proposals & estimates |

## Infrastructure

| Technology | Purpose |
|---|---|
| **Docker + Docker Compose** | Containerized local dev & deployment |
| **1Password CLI** | Secrets management — all API keys stored in shared vault |
| **Taskfile** | Task runner for build, test, deploy, and env workflows |

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  deck.gl maps ┃ Three.js 3D viewer ┃ Estimator UI   │
└──────────────────────┬──────────────────────────────┘
                       │ /api/*
┌──────────────────────▼──────────────────────────────┐
│                   Backend (FastAPI)                   │
│                                                      │
│  Routers ─► Services ─► Providers ─► External APIs   │
│                  │                                    │
│                  ▼                                    │
│              SQLite DB                               │
│   (properties, estimates, measurements, catalog)     │
└──────────────────────────────────────────────────────┘
         │              │              │
    Google Maps    EagleView     Replicate/Tripo3D
    Solar API      Measurements   3D Generation
```

## Key Design Decisions

- **Slanted roof area** — all measurements use pitch-adjusted area, not projected footprint
- **Layered architecture** — Provider (API wrapper) → Service (business logic) → DAO (database) → Router (HTTP endpoint)
- **Async everywhere** — all external API calls are non-blocking via httpx
- **Structured logging** — JSON-formatted logs for observability
- **Schema validation at every boundary** — Pydantic on the backend, Zod on the frontend
