# BikeBook

BikeBook transforms a GPX file into an exportable road book PDF for cyclists, bike travelers, and hikers.

## Features (MVP)

- Import GPX tracks via drag & drop or file picker
- Interactive route map (OpenStreetMap + Leaflet)
- Elevation profile with POI markers (Recharts)
- POI list from GPX waypoints
- PDF export with stats, map/profile overview, and POI table
- French / English interface (next-intl)
- Mobile-first responsive UI

## Tech stack

- Next.js 15+ App Router, TypeScript
- Tailwind CSS + shadcn-style UI components
- Leaflet + OSM tiles
- Recharts, @react-pdf/renderer
- Zustand (client state, localStorage persistence)
- Vitest (GPX parser unit tests)

## Local setup

```bash
cd ~/Projects/bikebook
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the app defaults to French (`/fr`). English is available at `/en`.

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Start development server |
| `npm run build`| Production build         |
| `npm run start`| Start production server  |
| `npm run test` | Run Vitest unit tests    |
| `npm run lint` | ESLint                   |

## Usage

1. Upload a `.gpx` file on the landing page
2. Review the map, elevation profile, and POI list
3. Click **Export PDF** to download your road book

## API

`POST /api/gpx/parse` — multipart form with `file` field (.gpx). Returns `{ roadbook }` JSON or `{ error: { code, message } }`.

## Test plan

- `tests/gpx/parser.test.ts` — GPX parsing, waypoint projection, error cases
- `tests/gpx/elevation.test.ts` — distance and elevation calculations

Run: `npm run test`

## v2 roadmap

- User authentication and cloud persistence (Prisma stub in `lib/db/prisma-stub.ts`)
- External POI sources
- MapLibre migration option
- Saved road books and sharing

## Limitations (MVP)

- No authentication or server-side storage
- POIs come from GPX waypoints only
- PDF map/profile are simplified vector representations (not raster map tiles)
- Large GPX files (>10 MB) are rejected client-side
