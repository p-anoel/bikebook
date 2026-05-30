import type { RouteSegmentGeometry } from "@/lib/weather/types";

export const LOCATION_BUCKET_DECIMALS = 1;

export interface SegmentForecastPlan {
  geometry: RouteSegmentGeometry;
  arrivalIso: string;
}

export interface ForecastLocationGroup {
  lat: number;
  lng: number;
  startIso: string;
  endIso: string;
  plans: SegmentForecastPlan[];
}

export function bucketCoord(value: number, decimals = LOCATION_BUCKET_DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function expandWindow(iso: string, hoursBefore: number, hoursAfter: number): { start: string; end: string } {
  const center = new Date(iso);
  const start = new Date(center);
  start.setUTCHours(start.getUTCHours() - hoursBefore);
  const end = new Date(center);
  end.setUTCHours(end.getUTCHours() + hoursAfter);
  return { start: start.toISOString(), end: end.toISOString() };
}

function mergeWindows(
  current: { startIso: string; endIso: string },
  arrivalIso: string,
): { startIso: string; endIso: string } {
  const window = expandWindow(arrivalIso, 1, 2);
  const startMs = Math.min(new Date(current.startIso).getTime(), new Date(window.start).getTime());
  const endMs = Math.max(new Date(current.endIso).getTime(), new Date(window.end).getTime());
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

/** Group segment plans by ~11 km location buckets and merged hourly windows. */
export function groupForecastPlans(plans: SegmentForecastPlan[]): ForecastLocationGroup[] {
  const byLocation = new Map<string, ForecastLocationGroup>();

  for (const plan of plans) {
    const lat = bucketCoord(plan.geometry.centerLat);
    const lng = bucketCoord(plan.geometry.centerLng);
    const key = `${lat},${lng}`;
    const window = expandWindow(plan.arrivalIso, 1, 2);

    const existing = byLocation.get(key);
    if (!existing) {
      byLocation.set(key, {
        lat,
        lng,
        startIso: window.start,
        endIso: window.end,
        plans: [plan],
      });
      continue;
    }

    const merged = mergeWindows(
      { startIso: existing.startIso, endIso: existing.endIso },
      plan.arrivalIso,
    );
    existing.startIso = merged.startIso;
    existing.endIso = merged.endIso;
    existing.plans.push(plan);
  }

  return [...byLocation.values()];
}
