import { haversineDistanceM } from "@/lib/gpx/elevation";
import {
  delayBetweenOverpassChunks,
  fetchOverpassElements,
  OVERPASS_QL_TIMEOUT_S,
  type OverpassElement,
} from "@/lib/osm/overpass-client";
import type { RoadbookBounds, TrackPoint } from "@/types/roadbook";

export {
  OVERPASS_ENDPOINTS,
  OVERPASS_FETCH_TIMEOUT_MS,
  OVERPASS_QL_TIMEOUT_S,
  OVERPASS_USER_AGENT,
  OVERPASS_USER_FACING_HINT,
  parseOverpassErrorBody,
} from "@/lib/osm/overpass-client";

export const WATER_POINT_MAX_DISTANCE_M = 200;
/** Buffer around each query bbox; filtering still uses {@link WATER_POINT_MAX_DISTANCE_M}. */
export const WATER_POINT_BBOX_BUFFER_M = 200;

/** Split Overpass queries when the track bbox diagonal exceeds this (meters). */
export const MAX_OVERPASS_BBOX_DIAGONAL_M = 50_000;

export interface OsmWaterPoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  tags: Record<string, string>;
  distanceToTrackM: number;
}

const waterPointsCache = new Map<string, OsmWaterPoint[]>();

export function trackCacheKey(track: Pick<TrackPoint, "lat" | "lng">[]): string {
  if (track.length === 0) return "empty";
  const step = Math.max(1, Math.floor(track.length / 40));
  const sample = track.filter((_, index) => index % step === 0 || index === track.length - 1);
  return sample.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join("|");
}

export function boundsFromTrack(
  track: Pick<TrackPoint, "lat" | "lng">[],
): RoadbookBounds | null {
  if (track.length === 0) return null;

  let swLat = track[0].lat;
  let swLng = track[0].lng;
  let neLat = track[0].lat;
  let neLng = track[0].lng;

  for (const point of track) {
    swLat = Math.min(swLat, point.lat);
    swLng = Math.min(swLng, point.lng);
    neLat = Math.max(neLat, point.lat);
    neLng = Math.max(neLng, point.lng);
  }

  return [
    [swLat, swLng],
    [neLat, neLng],
  ];
}

export function expandBounds(bounds: RoadbookBounds, bufferM: number): RoadbookBounds {
  const [[swLat, swLng], [neLat, neLng]] = bounds;
  const midLat = (swLat + neLat) / 2;
  const latDelta = bufferM / 111_320;
  const lngDelta = bufferM / (111_320 * Math.cos((midLat * Math.PI) / 180));

  return [
    [swLat - latDelta, swLng - lngDelta],
    [neLat + latDelta, neLng + lngDelta],
  ];
}

export function bboxDiagonalM(bounds: RoadbookBounds): number {
  const [[south, west], [north, east]] = bounds;
  return haversineDistanceM(south, west, north, east);
}

/**
 * One or more bboxes for Overpass — recursively bisects long tracks so each query stays small.
 */
export function queryBoundsChunksFromTrack(
  track: TrackPoint[],
  bufferM: number,
  maxDiagonalM: number,
): RoadbookBounds[] {
  const base = boundsFromTrack(track);
  if (!base) return [];

  const expanded = expandBounds(base, bufferM);
  if (bboxDiagonalM(expanded) <= maxDiagonalM || track.length <= 2) {
    return [expanded];
  }

  const mid = Math.floor(track.length / 2);
  return [
    ...queryBoundsChunksFromTrack(track.slice(0, mid), bufferM, maxDiagonalM),
    ...queryBoundsChunksFromTrack(track.slice(mid), bufferM, maxDiagonalM),
  ];
}

/** Minimum distance from a lat/lng to the track polyline (meters). */
export function distancePointToTrackM(
  lat: number,
  lng: number,
  track: TrackPoint[],
): number {
  if (track.length === 0) return Infinity;
  if (track.length === 1) {
    return haversineDistanceM(lat, lng, track[0].lat, track[0].lng);
  }

  let best = Infinity;

  for (let index = 0; index < track.length - 1; index += 1) {
    const from = track[index];
    const to = track[index + 1];
    const dx = to.lat - from.lat;
    const dy = to.lng - from.lng;
    const lengthSq = dx * dx + dy * dy;

    const ratio =
      lengthSq === 0
        ? 0
        : Math.min(1, Math.max(0, ((lat - from.lat) * dx + (lng - from.lng) * dy) / lengthSq));

    const projLat = from.lat + dx * ratio;
    const projLng = from.lng + dy * ratio;
    const distance = haversineDistanceM(lat, lng, projLat, projLng);

    if (distance < best) {
      best = distance;
    }
  }

  return best;
}

export function filterWaterPointsNearTrack(
  points: Omit<OsmWaterPoint, "distanceToTrackM">[],
  track: TrackPoint[],
  maxDistanceM = WATER_POINT_MAX_DISTANCE_M,
): OsmWaterPoint[] {
  return points
    .map((point) => ({
      ...point,
      distanceToTrackM: distancePointToTrackM(point.lat, point.lng, track),
    }))
    .filter((point) => point.distanceToTrackM <= maxDistanceM)
    .sort((a, b) => {
      const distanceDelta = a.distanceToTrackM - b.distanceToTrackM;
      if (distanceDelta !== 0) return distanceDelta;
      return waterPointTagPreferenceScore(b.tags) - waterPointTagPreferenceScore(a.tags);
    });
}

function displayName(tags: Record<string, string> | undefined): string | undefined {
  if (!tags) return undefined;
  const name = tags.name ?? tags["name:fr"] ?? tags["name:en"];
  return name?.trim() || undefined;
}

/** Positive `drinking_water=*` subtypes (not `no`). */
export const DRINKING_WATER_ACCEPTED_SUBTYPES = new Set([
  "yes",
  "fountain",
  "water_tap",
  "spring_box",
  "hand_pump",
  "bottle_refill",
  "jug",
]);

const DRINKING_WATER_REJECTED_ACCESS = new Set(["no", "private", "customers"]);

function normalizeTag(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || undefined;
}

/**
 * Keeps `amenity=drinking_water` nodes whose tags do not contradict potable,
 * public, bottle-friendly water when those tags are present.
 */
export function acceptsWaterPointTags(tags: Record<string, string> | undefined): boolean {
  if (!tags) return false;

  const amenity = normalizeTag(tags.amenity);
  if (amenity !== "drinking_water") return false;

  const drinkingWater = normalizeTag(tags.drinking_water);
  if (drinkingWater === "no") return false;
  if (drinkingWater && !DRINKING_WATER_ACCEPTED_SUBTYPES.has(drinkingWater)) {
    return false;
  }

  const access = normalizeTag(tags.access);
  if (access && DRINKING_WATER_REJECTED_ACCESS.has(access)) {
    return false;
  }

  const bottle = normalizeTag(tags.bottle);
  if (bottle === "no") return false;

  const drinkable = normalizeTag(tags.drinkable);
  if (drinkable === "no") return false;

  return true;
}

/** Higher score = closer to ideal `drinking_water=yes`, `bottle=yes`, `access=yes`. */
export function waterPointTagPreferenceScore(tags: Record<string, string>): number {
  let score = 0;

  const drinkingWater = normalizeTag(tags.drinking_water);
  if (drinkingWater === "yes") score += 4;
  else if (drinkingWater && DRINKING_WATER_ACCEPTED_SUBTYPES.has(drinkingWater)) score += 2;

  if (normalizeTag(tags.bottle) === "yes") score += 2;
  if (normalizeTag(tags.access) === "yes") score += 1;

  return score;
}

export function buildOverpassQuery(bounds: RoadbookBounds): string {
  const [[south, west], [north, east]] = bounds;
  const bbox = `${south},${west},${north},${east}`;

  return `[out:json][timeout:${OVERPASS_QL_TIMEOUT_S}];
(
  node["amenity"="drinking_water"]["drinking_water"="yes"](${bbox});
  node["amenity"="drinking_water"]["bottle"="yes"](${bbox});
  node["amenity"="drinking_water"]["access"="yes"](${bbox});
  node["amenity"="drinking_water"]["drinking_water"!~"."](${bbox});
);
out;`;
}

function parseOverpassElements(elements: OverpassElement[]): Omit<OsmWaterPoint, "distanceToTrackM">[] {
  const seen = new Set<string>();
  const results: Omit<OsmWaterPoint, "distanceToTrackM">[] = [];

  for (const element of elements) {
    if (element.type !== "node" || element.lat === undefined || element.lon === undefined) {
      continue;
    }

    const tags = element.tags ?? {};
    if (!acceptsWaterPointTags(tags)) continue;

    const id = `node/${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    results.push({
      id,
      lat: element.lat,
      lng: element.lon,
      name: displayName(element.tags),
      tags,
    });
  }

  return results;
}

function mergeOverpassElements(chunks: OverpassElement[][]): OverpassElement[] {
  const seen = new Set<string>();
  const merged: OverpassElement[] = [];

  for (const elements of chunks) {
    for (const element of elements) {
      const key = `${element.type}/${element.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(element);
    }
  }

  return merged;
}

export async function fetchOverpassWaterPoints(bounds: RoadbookBounds): Promise<OverpassElement[]> {
  const query = buildOverpassQuery(bounds);
  return fetchOverpassElements(query);
}

export async function fetchOverpassWaterPointsForBoundsList(
  boundsList: RoadbookBounds[],
): Promise<OverpassElement[]> {
  if (boundsList.length === 0) return [];

  const chunkResults: OverpassElement[][] = [];

  for (let index = 0; index < boundsList.length; index += 1) {
    if (index > 0) {
      await delayBetweenOverpassChunks();
    }
    chunkResults.push(await fetchOverpassWaterPoints(boundsList[index]));
  }

  return mergeOverpassElements(chunkResults);
}

export async function getWaterPointsNearTrack(track: TrackPoint[]): Promise<OsmWaterPoint[]> {
  const cacheKey = trackCacheKey(track);
  const cached = waterPointsCache.get(cacheKey);
  if (cached) return cached;

  const baseBounds = boundsFromTrack(track);
  if (!baseBounds) return [];

  const queryBoundsList = queryBoundsChunksFromTrack(
    track,
    WATER_POINT_BBOX_BUFFER_M,
    MAX_OVERPASS_BBOX_DIAGONAL_M,
  );
  const elements = await fetchOverpassWaterPointsForBoundsList(queryBoundsList);
  const raw = parseOverpassElements(elements);
  const filtered = filterWaterPointsNearTrack(raw, track);

  waterPointsCache.set(cacheKey, filtered);
  return filtered;
}

export function clearWaterPointsCache(): void {
  waterPointsCache.clear();
}

/** Client-side fetch via the app API route. */
export async function fetchWaterPointsForTrack(track: TrackPoint[]): Promise<OsmWaterPoint[]> {
  const response = await fetch("/api/osm/water-points", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message ?? "Water points fetch failed");
  }

  const data = (await response.json()) as { waterPoints: OsmWaterPoint[] };
  return data.waterPoints;
}
