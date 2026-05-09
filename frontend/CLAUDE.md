# frontend/CLAUDE.md

Frontend conventions. Read this before editing anything under `frontend/`. Repo-level conventions live in [../CLAUDE.md](../CLAUDE.md).

Stack: React 19, Vite 8, TypeScript, Tailwind v4, TanStack Query, Zustand, Zod, react-router-dom v7, deck.gl for the satellite map. `pnpm` for packages.

## Env vars — only via `import.meta.env.VITE_*`

```ts
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
```

- Vite only exposes vars prefixed `VITE_`. Never reach for `process.env` — it doesn't exist in the browser.
- `frontend/.env.local` (and `.env.prod`) are **generated** from 1Password by [../scripts/generate-env.sh](../scripts/generate-env.sh). The generator pulls vault items prefixed `vite-` from the `AIBuilderDay` vault — `vite-google-maps-api-key` becomes `VITE_GOOGLE_MAPS_API_KEY`. Backend secrets in the same vault never leak in.
- Workflow: `task env:setup` (one-time) → `task env:generate` (regenerates `.env.local`) → `task frontend:dev` (runs Vite). The `.env.local` files are gitignored.
- Adding a new frontend secret: create a vault item titled `vite-<thing>`, then re-run `task env:generate`. Do not hand-edit `.env.local`.
- Don't read env vars at the top of random modules. Read them once at the boundary (the component or hook that uses the API), and pass values down.

## Talking to the backend — `/api/*` only

- Vite proxies `/api/*` to `http://localhost:8000` in dev (see [vite.config.ts](vite.config.ts)). In prod, the same path lands on the deployed FastAPI host.
- Always use relative paths: `fetch("/api/estimate/start", …)`. Never hardcode `localhost:8000`.
- CORS on the backend currently allows `http://localhost:5173`. When deploying to Vercel, add the new origin to backend CORS — don't disable it.

## Validate untrusted JSON at the boundary with Zod

Backend responses are not part of the TypeScript type system — Zod is how we make them safe. See [src/types/solar.ts](src/types/solar.ts) for the canonical pattern:

```ts
const parsed = BuildingInsightsSchema.safeParse(data.solar);
if (parsed.success) {
  buildingInsights = parsed.data;
} else {
  console.error("Solar response validation failed:", data.solar);
}
```

- One schema per response shape, exported alongside its inferred TS type (`type Foo = z.infer<typeof FooSchema>`).
- Use `.safeParse` at API boundaries; let Zod's TS types flow downstream. Don't re-declare the same shape as a hand-written `interface`.
- For optional/nullable upstream fields, prefer `.nullable().optional()` over `?:` — Zod's runtime check is the contract, not your assumption.

## Server state via TanStack Query, client state via Zustand

- **Server state** (anything that comes from `/api/*`): `useQuery` / `useMutation`. Put fetchers in [src/api/](src/api/), hooks in [src/hooks/](src/hooks/). Set a sensible `staleTime` per query (see [src/hooks/useEstimates.ts](src/hooks/useEstimates.ts)). Don't manually mirror server data into Zustand.
- **Client state** (the user's in-progress estimator flow, selected segment, modal state): Zustand. The estimator store is `sessionStorage`-persisted ([src/store/estimatorStore.ts](src/store/estimatorStore.ts)) — keep it there.
- Don't add a third state library.

## Error handling — throw at the API layer, catch at the component

Pattern from [src/api/estimate.ts](src/api/estimate.ts):

```ts
const res = await fetch("/api/estimate/start", { … });
if (res.status === 404) throw new Error("Address not found. Please check and try again.");
if (!res.ok) throw new Error(`Estimate request failed: ${res.status}`);
```

- API functions throw `Error` with a user-facing message. The calling component / mutation surfaces it via `try/catch` or react-query's `error` field.
- 4xx that the user can act on (404 = bad address) gets a friendly message. 5xx falls back to a generic "something went wrong".
- Don't show raw fetch error objects. Use `err instanceof Error ? err.message : "An error occurred."`.

## TypeScript hygiene

- `strict` is on. Don't reach for `any` — `unknown` + a Zod schema is almost always the right move.
- Component prop types live next to the component, not in a global `types/` file. `src/types/` is for shared API/domain shapes only.
- Imports use relative paths (`../api/estimate`). No path aliases configured yet.

## Running the app

```bash
task frontend:dev    # op run --env-file=.env.local -- pnpm dev
task env:generate    # regenerate .env.local from 1Password
task env:status      # which .env files exist locally
```

Backend must be up at `localhost:8000` for `/api/*` calls to succeed in dev — see [../backend/CLAUDE.md](../backend/CLAUDE.md).
