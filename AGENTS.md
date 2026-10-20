# AGENTS.md

Guidance for AI coding agents working in this repository. See [README.md](README.md) for the human-facing overview.

## What this project is

Vélo'v Tracking records bike trips on Lyon's Vélo'v network and visualises them. It is **two programs sharing one Postgres database and one Prisma schema**:

1. **Tracker daemon**: `index.ts`, plus `class/RequestHandler.ts`, `lib/prisma.ts` and `types/bike.ts`. A long-running Node process (run with `tsx`, shipped via `Dockerfile`) that polls the Cyclocity bikes API every 10 s and the JCDecaux stations API every 12 h, and writes `Station`, `Bike` and `Travel` rows.
2. **Web app**: `app/`, `components/` and `providers/`. Next.js 15 App Router, deployed on Vercel, read-only on trip data. It writes only the `Statistic` table, via `/api/statistics/recompute`.

Before changing anything shared (`lib/`, `types/`, `prisma/schema.prisma`), check whether the change breaks the other program.

## Commands

```bash
npm install                 # postinstall runs `prisma generate`
npm run dev                 # Next.js dev server (Turbopack) on :3000
npm run lint                # ESLint (next/core-web-vitals + next/typescript)
npx tsc --noEmit            # Type-check everything, including index.ts
npx next build              # Build WITHOUT running migrations (prefer this for verification)
npx tsx index.ts            # Run the tracker daemon (needs real API keys + DB)
npx prisma migrate dev --name <name>   # After editing schema.prisma
```

There is **no test suite**. Verify changes with `npx tsc --noEmit`, `npm run lint` and `npx next build`.

⚠️ **Do not run `npm run build` to verify changes.** It runs `prisma migrate deploy` against whatever `DATABASE_URL`/`DIRECT_URL` points to, which may be production. Use `npx next build` instead.

## Environment

Secrets live in `.env`, which is git-ignored. Never commit it, print its values, or copy them into code or docs. The variables are listed in the README. Browser-exposed values must be prefixed with `NEXT_PUBLIC_` (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`).

The daemon overrides `DATABASE_URL` with `DIRECT_URL` at startup to skip the Supabase pooler. Keep that override at the top of `index.ts`, before Prisma is imported.

## Code map

| Path | Role |
|---|---|
| `index.ts` | Daemon: bootstrap, polling loops, trip start/end detection, in-memory caches, Discord notifications, graceful shutdown |
| `class/RequestHandler.ts` | Cyclocity auth (client token, refresh, single 401 retry) |
| `prisma/schema.prisma` | `Station`, `Bike`, `Travel`, `Statistic` |
| `app/map/page.tsx` | Server component, loads all stations (`unstable_cache`, 12 h, tag `stations`) |
| `app/map/actions.ts` | `'use server'` `fetchTravels()`: date range clamped to 2 days, Europe/Paris time-of-day filtering, 5 min in-memory cache |
| `app/map/components/mapClient.tsx` | Client UI state: toggles, filters, selected station |
| `app/map/components/map.tsx` | `DeckGL` wrapping a Google `Map`. Builds every layer (`HeatmapLayer`, `TripsLayer`, `IconLayer`) |
| `app/map/components/heatmap.ts` | Pure helper that aggregates trips into weighted points per station |
| `app/api/statistics/recompute/route.ts` | Raw-SQL aggregations, upserted into `Statistic`. Target of the Vercel cron |
| `app/statistics/page.tsx` | Renders `Statistic` rows (cached 5 min) |
| `components/ui/*` | shadcn/ui components (style `new-york`). Prefer adding new ones with the shadcn CLI over writing them by hand |
| `data.json` | Sample Cyclocity payload, for reference only. Not imported anywhere, so don't load it in code |

Import alias: `@/*` → repo root.

## Conventions

- **TypeScript strict**. Match the existing style: 4-space indent in `app/`, `components/`, `class/` and `lib/`; 2-space indent in `index.ts`. Use semicolons and named React function components.
- **UI text is in French** (labels, tooltips, error messages shown to users). Code identifiers and comments are in English.
- **Times**: DB columns are `timestamptz`. Anything user-facing or "per day/hour" must use **Europe/Paris** (`AT TIME ZONE 'Europe/Paris'` in SQL, the `Intl` helpers in `app/map/actions.ts` in TS). Never rely on the server's local timezone, because Vercel runs in UTC.
- **Station coordinates** are stored as a `"lat,lng"` string in `Station.position`. Parse them once with `useMemo`, as `map.tsx` does. deck.gl positions are `[lng, lat]`, so mind the order.
- Styling uses Tailwind 4 utility classes plus `cn()` from `lib/utils.ts`. Floating map panels use `bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border`.
- Server data access goes through the shared `prisma` from `@/lib/prisma`. Never instantiate `PrismaClient` anywhere else.

## Map rendering rules

- All data overlays are **deck.gl layers** built in `map.tsx`'s `layers` `useMemo`. Layer order follows push order, so the heatmap goes first (bottom) and station icons last (top).
- **Do not use `google.maps.visualization` (`HeatmapLayer`)**. Google removed it in Maps JS API 3.65, and it throws at runtime in production. Use `@deck.gl/aggregation-layers` `HeatmapLayer`.
- Avoid other deprecated Google Maps APIs (e.g. legacy `google.maps.Marker`). If something must live inside the Google map itself, use `AdvancedMarker` from `@vis.gl/react-google-maps`. Otherwise prefer a deck.gl layer.
- `map.tsx` is loaded with `next/dynamic` and `ssr: false`. Keep it client-only, because deck.gl needs WebGL.
- The `ResizeObserver` patch in `map.tsx` works around a luma.gl initialisation race. Don't remove it unless you've confirmed the bug is fixed upstream.
- `TripsLayer` is recreated every animation frame (`currentTime`). Keep heavy computation in separate `useMemo`s keyed on data, never inside the `layers` memo.

## Tracker daemon rules

- The daemon must **never crash on a transient API or DB error**. Each loop catches its own errors and continues. Keep this pattern.
- The DB is the source of truth, but `bikeCache`, `trackingBikes` and `unfinishedTravelCache` are in-memory mirrors. Any new write path must keep them in sync, and must update tracking state only **after** a successful DB write (see `startTravel`/`endTravel` and the persist blocks).
- Batch DB writes once per cycle (`createMany`, `createManyAndReturn`, `UPDATE … FROM (VALUES …)`). Never query the DB per bike inside the loop: there are thousands of bikes and the loop runs every 10 s.
- On startup, all unfinished trips are deleted (`cleanUnfinishedTravels`), and unfinished trips older than 6 h are pruned every cycle.
- The `Dockerfile` copies only the daemon files (`index.ts`, `class/`, `lib/`, `types/`, `prisma/`). If the daemon starts importing another folder, add it to the `Dockerfile`, and check that `.dockerignore` doesn't exclude it.

## Database changes

1. Edit `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name <descriptive_name>` against a **local or dev** database, never prod.
3. Commit the generated folder under `prisma/migrations/`. Never edit a migration that has already been applied.
4. Migrations are applied in production automatically by the Vercel build (`prisma migrate deploy`). Design them to be backward-compatible, because the daemon may still be running the old code.

## Before you finish

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npx next build` passes (for changes under `app/`, `components/` or `providers/`)
- If you added or changed an env var, a script or the architecture, update both `README.md` and this file
