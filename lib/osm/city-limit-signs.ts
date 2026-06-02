import { snapLatLngToTrack } from "@/lib/gpx/poi-manage";
import {
  delayBetweenOverpassChunks,
  fetchOverpassElements,
  OVERPASS_QL_TIMEOUT_S,
  type OverpassElement,
} from "@/lib/osm/overpass-client";
import type { RoadbookBounds, TrackPoint } from "@/types/roadbook";
import {
  boundsFromTrack,
  distancePointToTrackM,
  MAX_OVERPASS_BBOX_DIAGONAL_M,
  queryBoundsChunksFromTrack,
  trackCacheKey,
} from "@/lib/osm/water-points";

/** Overpass bbox buffer around the track (candidate search). */
export const CITY_LIMIT_BBOX_BUFFER_M = 200;

/** Max distance from the route to include a sign in results (GPS tolerance). */
export const CITY_LIMIT_ON_TRACK_MAX_M = 5;

export interface OsmCityLimitSign {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  tags: Record<string, string>;
  distanceToTrackM: number;
}

const cityLimitCache = new Map<string, OsmCityLimitSign[]>();

/** Parse display name from OSM tags (name, traffic_sign:city_limit, ref). */
export function parseCityLimitSignName(tags: Record<string, string> | undefined): string | undefined {
  if (!tags) return undefined;

  const name = tags.name ?? tags["name:fr"] ?? tags["name:en"];
  if (name?.trim()) return name.trim();

  const cityLimitTag = tags["traffic_sign:city_limit"];
  if (cityLimitTag?.trim()) return cityLimitTag.trim();

  const ref = tags.ref;
  if (ref?.trim()) return ref.trim();

  return undefined;
}

export function filterCityLimitSignsNearTrack(
  signs: Omit<OsmCityLimitSign, "distanceToTrackM">[],
  track: TrackPoint[],
  maxDistanceM = CITY_LIMIT_ON_TRACK_MAX_M,
): OsmCityLimitSign[] {
  return signs
    .map((sign) => ({
      ...sign,
      distanceToTrackM: distancePointToTrackM(sign.lat, sign.lng, track),
    }))
    .filter((sign) => sign.distanceToTrackM <= maxDistanceM);
}

function normalizeCommuneName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed || undefined;
}

/**
 * OSM tags that unambiguously mark entry/exit without way geometry.
 *
 * `traffic_sign:direction`, `direction`, and `traffic_sign:forward` are only
 * meaningful relative to the parent way's direction; we do not use them here.
 */
export function osmExplicitCityLimitRole(
  tags: Record<string, string>,
): "entry" | "exit" | null {
  const cityLimit = tags.city_limit?.trim().toLowerCase();
  if (cityLimit === "begin") return "entry";
  if (cityLimit === "end") return "exit";
  return null;
}

export interface FilterEntryCityLimitSignsOptions {
  /** Commune already entered before the first on-track sign (mid-route GPX starts). */
  initialCommune?: string | null;
}

/** Max track distance between paired exit/entry signs at a commune boundary (France). */
export const CITY_LIMIT_PAIR_LOOKAHEAD_M = 2000;

function distanceAlongTrackM(track: TrackPoint[], lat: number, lng: number): number {
  const snapped = snapLatLngToTrack(track, lat, lng);
  return snapped?.distanceM ?? Infinity;
}

function signCommuneName(sign: OsmCityLimitSign): string | undefined {
  return normalizeCommuneName(sign.name ?? parseCityLimitSignName(sign.tags));
}

function findNextNamedSignWithin(
  sorted: OsmCityLimitSign[],
  fromIndex: number,
  track: TrackPoint[],
  maxDistanceM: number,
): OsmCityLimitSign | undefined {
  const fromDistanceM = distanceAlongTrackM(track, sorted[fromIndex].lat, sorted[fromIndex].lng);

  for (let index = fromIndex + 1; index < sorted.length; index += 1) {
    const candidate = sorted[index];
    const candidateDistanceM = distanceAlongTrackM(track, candidate.lat, candidate.lng);
    if (candidateDistanceM - fromDistanceM > maxDistanceM) break;

    if (signCommuneName(candidate)) return candidate;
  }

  return undefined;
}

/**
 * When `currentCommune` is unknown, classify a sign using French rally convention:
 * exit signs show the commune being left (A), entry signs show the commune being
 * entered (B). At a boundary the exit sign (A) is immediately followed by the
 * entry sign (B) with a different name.
 */
function classifySignWhenCommuneUnknown(
  sign: OsmCityLimitSign,
  signIndex: number,
  sorted: OsmCityLimitSign[],
  track: TrackPoint[],
): "entry" | "exit" {
  const name = signCommuneName(sign);
  if (!name) return "entry";

  const nextSign = findNextNamedSignWithin(
    sorted,
    signIndex,
    track,
    CITY_LIMIT_PAIR_LOOKAHEAD_M,
  );
  const nextName = nextSign ? signCommuneName(nextSign) : undefined;

  if (nextName && nextName !== name) {
    return "exit";
  }

  return "entry";
}

/**
 * Keeps entry city-limit signs along GPX travel direction.
 *
 * Signs are sorted by projected distance along the track, then filtered with a
 * state machine: `currentCommune` is the municipality the rider is inside.
 * - Name N = currentCommune → leaving N (skip)
 * - Name N ≠ currentCommune and currentCommune is set → entering N (keep)
 * - currentCommune unknown → pair lookahead (exit A then entry B) or lone entry
 * - After a kept entry or explicit OSM `city_limit=begin`, currentCommune = N
 * - After a skipped exit or explicit OSM `city_limit=end`, currentCommune = null
 *
 * Signs without a commune name are kept (cannot classify). Explicit OSM
 * `city_limit=begin|end` overrides the state machine when tagged.
 */
export function filterEntryCityLimitSigns(
  track: TrackPoint[],
  signs: OsmCityLimitSign[],
  options: FilterEntryCityLimitSignsOptions = {},
): OsmCityLimitSign[] {
  if (signs.length === 0 || track.length === 0) return [];

  const sorted = [...signs].sort(
    (a, b) => distanceAlongTrackM(track, a.lat, a.lng) - distanceAlongTrackM(track, b.lat, b.lng),
  );

  const result: OsmCityLimitSign[] = [];
  let currentCommune = normalizeCommuneName(options.initialCommune ?? undefined) ?? null;

  for (let index = 0; index < sorted.length; index += 1) {
    const sign = sorted[index];
    const name = signCommuneName(sign);
    const explicitRole = osmExplicitCityLimitRole(sign.tags);

    if (explicitRole === "exit") {
      if (name && currentCommune === name) {
        currentCommune = null;
      }
      continue;
    }

    if (explicitRole === "entry") {
      result.push(sign);
      if (name) currentCommune = name;
      continue;
    }

    if (!name) {
      result.push(sign);
      continue;
    }

    if (currentCommune === name) {
      currentCommune = null;
      continue;
    }

    if (currentCommune === null) {
      const role = classifySignWhenCommuneUnknown(sign, index, sorted, track);
      if (role === "exit") {
        continue;
      }

      result.push(sign);
      currentCommune = name;
      continue;
    }

    result.push(sign);
    currentCommune = name;
  }

  return result;
}

export function buildCityLimitOverpassQuery(bounds: RoadbookBounds): string {
  const [[south, west], [north, east]] = bounds;
  const bbox = `${south},${west},${north},${east}`;

  return `[out:json][timeout:${OVERPASS_QL_TIMEOUT_S}];
node["traffic_sign"="city_limit"](${bbox});
out;`;
}

export function parseCityLimitOverpassElements(
  elements: OverpassElement[],
): Omit<OsmCityLimitSign, "distanceToTrackM">[] {
  const seen = new Set<string>();
  const results: Omit<OsmCityLimitSign, "distanceToTrackM">[] = [];

  for (const element of elements) {
    if (element.type !== "node" || element.lat === undefined || element.lon === undefined) {
      continue;
    }

    const id = `node/${element.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const tags = element.tags ?? {};
    results.push({
      id,
      lat: element.lat,
      lng: element.lon,
      name: parseCityLimitSignName(tags),
      tags,
    });
  }

  return results;
}

function mergeCityLimitElements(chunks: OverpassElement[][]): OverpassElement[] {
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

export async function fetchOverpassCityLimitSigns(bounds: RoadbookBounds): Promise<OverpassElement[]> {
  const query = buildCityLimitOverpassQuery(bounds);
  return fetchOverpassElements(query);
}

async function fetchOverpassCityLimitSignsForBoundsList(
  boundsList: RoadbookBounds[],
): Promise<OverpassElement[]> {
  if (boundsList.length === 0) return [];

  const chunkResults: OverpassElement[][] = [];

  for (let index = 0; index < boundsList.length; index += 1) {
    if (index > 0) {
      await delayBetweenOverpassChunks();
    }
    chunkResults.push(await fetchOverpassCityLimitSigns(boundsList[index]));
  }

  return mergeCityLimitElements(chunkResults);
}

export async function getCityLimitSignsNearTrack(track: TrackPoint[]): Promise<OsmCityLimitSign[]> {
  const cacheKey = trackCacheKey(track);
  const cached = cityLimitCache.get(cacheKey);
  if (cached) return cached;

  const baseBounds = boundsFromTrack(track);
  if (!baseBounds) return [];

  const queryBoundsList = queryBoundsChunksFromTrack(
    track,
    CITY_LIMIT_BBOX_BUFFER_M,
    MAX_OVERPASS_BBOX_DIAGONAL_M,
  );
  const elements = await fetchOverpassCityLimitSignsForBoundsList(queryBoundsList);
  const raw = parseCityLimitOverpassElements(elements);
  const onTrack = filterCityLimitSignsNearTrack(raw, track, CITY_LIMIT_ON_TRACK_MAX_M);
  const filtered = filterEntryCityLimitSigns(track, onTrack);

  cityLimitCache.set(cacheKey, filtered);
  return filtered;
}

export function clearCityLimitSignsCache(): void {
  cityLimitCache.clear();
}

/** Client-side fetch via the app API route. */
export async function fetchCityLimitSignsForTrack(track: TrackPoint[]): Promise<OsmCityLimitSign[]> {
  const response = await fetch("/api/osm/city-limits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message ?? "City limit signs fetch failed");
  }

  const data = (await response.json()) as { cityLimitSigns: OsmCityLimitSign[] };
  return data.cityLimitSigns;
}
