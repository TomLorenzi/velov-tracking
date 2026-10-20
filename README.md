# Vélo'v Tracking

Track individual bike trips on Lyon's [Vélo'v](https://velov.grandlyon.com/) bike-sharing network, then explore them on an interactive map and a statistics page.

The public APIs only expose *where bikes are right now*. This project polls them every 10 seconds, notices when a bike leaves a station (status `RENTED`) and when it reappears at another one, and records that as a **trip** (`Travel`) from station A to station B.

## Features

- **Tracker daemon** (`index.ts`): a long-running Node process that polls the Cyclocity bikes API and JCDecaux stations API and writes stations, bikes and trips to Postgres. It sends Discord notifications on start, stop and crash, plus a daily recap.
- **Interactive map** (`/map`): a Google Maps base map with deck.gl layers on top:
  - a heatmap of departures and/or arrivals per station,
  - animated trip arcs (all trips, or only trips touching the selected station),
  - clickable station pins with details,
  - filters for date range (max 2 days), time of day and departure/arrival.
- **Statistics** (`/statistics`): precomputed stats (longest trip, most used bike, busiest stations, peak hour, most common route…), refreshed by a daily cron.
- **Home page** (`/`): live counts of trips, bikes and stations.

The UI is in French.

## Architecture

```
                ┌───────────────────────────┐
 Cyclocity API ─▶                           │
 (bikes, 10 s)  │   Tracker daemon          │
                │   index.ts (Docker)       ├──▶ Discord webhook
 JCDecaux API  ─▶                           │
 (stations,12h) └─────────────┬─────────────┘
                              │ Prisma (DIRECT_URL)
                              ▼
                    ┌───────────────────┐
                    │ Postgres          │
                    │ (Supabase)        │
                    └─────────▲─────────┘
                              │ Prisma (DATABASE_URL, pooled)
                ┌─────────────┴─────────────┐
 Browser ◀──────│  Next.js app (Vercel)     │◀── Vercel cron (01:00 UTC)
 Google Maps +  │  /, /map, /statistics     │    GET /api/statistics/recompute
 deck.gl        └───────────────────────────┘
```

These are two separate deployables that share the same database and Prisma schema:

| Part | Entry point | Runs on | DB connection |
|---|---|---|---|
| Tracker daemon | `index.ts` (+ `class/`, `lib/`, `types/`) | Docker (`Dockerfile`) | `DIRECT_URL` (no pooler) |
| Web app | `app/` (Next.js App Router) | Vercel | `DATABASE_URL` (pooled) |

## Tech stack

- **Next.js 15** (App Router, Server Components, Server Actions, Turbopack in dev), **React 19**, **TypeScript**
- **Prisma 6** + **PostgreSQL** (hosted on Supabase)
- **Google Maps JS API** through [`@vis.gl/react-google-maps`](https://visgl.github.io/react-google-maps/), with **deck.gl 9** layers (`HeatmapLayer`, `TripsLayer`, `IconLayer`)
- **Tailwind CSS 4** + **shadcn/ui** (Radix primitives), `lucide-react` icons, `next-themes` for dark mode

## Project structure

```
.
├── index.ts                     # Tracker daemon: polling loops, trip detection, Discord notifications
├── class/RequestHandler.ts      # Cyclocity API client (token fetch/refresh, 401 retry)
├── types/bike.ts                # Cyclocity bike payload types
├── lib/
│   ├── prisma.ts                # Shared PrismaClient (singleton in dev)
│   └── utils.ts                 # cn() helper for Tailwind classes
├── prisma/
│   ├── schema.prisma            # Station, Bike, Travel, Statistic
│   └── migrations/              # Prisma migrations (applied on `npm run build`)
├── app/
│   ├── page.tsx                 # Home page with quick counts
│   ├── map/
│   │   ├── page.tsx             # Server component: loads stations (cached 12 h)
│   │   ├── actions.ts           # Server action fetchTravels() (Paris-timezone filtering, 5 min cache)
│   │   └── components/
│   │       ├── mapClient.tsx    # UI controls and state (filters, toggles, selected station)
│   │       ├── map.tsx          # DeckGL + Google Map, builds all deck.gl layers
│   │       ├── heatmap.ts       # Aggregates trips into weighted heatmap points
│   │       └── datepicker.tsx
│   ├── statistics/page.tsx      # Reads precomputed Statistic rows (cached 5 min)
│   └── api/statistics/recompute/route.ts  # Recomputes all statistics (cron target)
├── components/                  # shadcn/ui components + theme provider
├── providers/map-provider.tsx   # Google Maps APIProvider
├── public/map/pin.svg           # Station icon
├── supabase/                    # Supabase CLI config (local stack)
├── Dockerfile                   # Image for the tracker daemon only
└── vercel.json                  # Cron schedule for statistics recompute
```

## Data model

| Model | Key | Notes |
|---|---|---|
| `Station` | `number` | From JCDecaux. `position` is stored as a `"lat,lng"` string. |
| `Bike` | `number` | From Cyclocity. `stationNumber` is the last station it was docked at. |
| `Travel` | `id` (cuid) | A trip: `stationFrom` → `stationTo`, `startDateTime` → `endDateTime` (both `timestamptz`). `stationToNumber`/`endDateTime` are `null` while the trip is in progress. |
| `Statistic` | `key` | Precomputed key/value/label rows rendered by `/statistics`. |

### How trips are detected

Every 10 seconds the daemon fetches all bikes:

1. A known bike that becomes `RENTED` starts a `Travel` from its last station.
2. When a tracked bike shows up again at a *different* station, the trip is closed with that station and the current time.
3. Unfinished trips older than **6 hours** are deleted as stale. All unfinished trips are also deleted when the daemon starts, because the in-memory tracking state is lost on restart.

Trip times are therefore accurate to roughly the polling interval (10 s).

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Supabase or any Postgres)
- A Google Maps JavaScript API key and a **Map ID** (vector map, needed by deck.gl)
- A JCDecaux API key and a Cyclocity client key (only needed by the tracker daemon)

### Environment variables

Create a `.env` file at the root (all `.env*` files are git-ignored):

```dotenv
# Web app (browser)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # Google Maps JS API key
NEXT_PUBLIC_GOOGLE_MAP_ID=         # Google Maps Map ID

# Database
DATABASE_URL=                      # Pooled connection string (used by the web app)
DIRECT_URL=                        # Direct connection (migrations + tracker daemon)

# Tracker daemon
VELOV_API_KEY=                     # JCDecaux API key (stations)
CLICLOCITY_API_KEY=                # Cyclocity client key (bikes)
DISCORD_WEBHOOK_URL=               # Optional: start/stop/crash/daily-recap notifications

# Statistics endpoint
CRON_SECRET=                       # Optional: if set, /api/statistics/recompute requires
                                   # "Authorization: Bearer <CRON_SECRET>" (sent by Vercel cron) or ?token=<CRON_SECRET>
```

### Install and run the web app

```bash
npm install          # also runs `prisma generate`
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The statistics page stays empty until you compute the statistics once:

```bash
curl "http://localhost:3000/api/statistics/recompute?token=$CRON_SECRET"
```

### Run the tracker daemon

Locally:

```bash
npx tsx index.ts
```

With Docker (the image copies your local `.env` into it, see the warning below):

```bash
docker build -t velov-tracking .
docker run -d --name velov-tracking --restart unless-stopped velov-tracking
```

> ⚠️ The `Dockerfile` currently runs `COPY .env ./`, which bakes your secrets into the image. Don't push that image to a public registry. A safer option is to remove that line and pass `--env-file .env` to `docker run`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | `prisma migrate deploy`, then `next build` (**applies migrations to the target DB**) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (`next/core-web-vitals` + `next/typescript`) |
| `npx tsx index.ts` | Run the tracker daemon |
| `npx prisma migrate dev --name <name>` | Create a new migration after editing `schema.prisma` |
| `npx prisma studio` | Browse the database |

## Deployment

- **Web app**: Vercel. The build runs `prisma migrate deploy`, so migrations go out with each deploy. `vercel.json` schedules `GET /api/statistics/recompute` daily at 01:00 UTC. Set `CRON_SECRET` in the Vercel project: Vercel then sends it as a Bearer token with each cron call, and the endpoint rejects anyone without it.
- **Tracker daemon**: any host that can run a long-lived Docker container. It must keep running all the time, otherwise trips are missed.
- **Database**: Supabase Postgres. The web app uses the pooled `DATABASE_URL`; the daemon and migrations use `DIRECT_URL`.

## Notes

- `data.json` is a sample dump of the Cyclocity bikes API, kept as a reference for the payload shape. The code doesn't use it.
- The heatmap uses deck.gl's `HeatmapLayer`. Google removed `google.maps.visualization.HeatmapLayer` in Maps JS API 3.65, so don't add it back.

## License

[GPL-3.0](LICENSE)
