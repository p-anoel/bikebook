import { getElevationAtDistance, haversineDistanceM } from "@/lib/gpx/elevation";
import { sortPoisByDistance } from "@/lib/gpx/poi";
import type { Poi, PoiSource, TrackPoint } from "@/types/roadbook";

export interface SnappedTrackPoint {
  lat: number;
  lng: number;
  ele: number;
  distanceM: number;
}

function interpolateTrackPoint(
  track: TrackPoint[],
  segmentIndex: number,
  ratio: number,
): SnappedTrackPoint {
  const from = track[segmentIndex];
  const to = track[segmentIndex + 1];
  const distanceM = from.distanceM + (to.distanceM - from.distanceM) * ratio;

  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
    ele: getElevationAtDistance(track, distanceM),
    distanceM,
  };
}

/** Snap a map click to the nearest point on the track polyline. */
export function snapLatLngToTrack(
  track: TrackPoint[],
  lat: number,
  lng: number,
): SnappedTrackPoint | null {
  if (track.length === 0) return null;
  if (track.length === 1) {
    return {
      lat: track[0].lat,
      lng: track[0].lng,
      ele: track[0].ele,
      distanceM: track[0].distanceM,
    };
  }

  let best: SnappedTrackPoint | null = null;
  let bestDistance = Infinity;

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

    const candidate = interpolateTrackPoint(track, index, ratio);
    const distance = haversineDistanceM(lat, lng, candidate.lat, candidate.lng);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

export function generatePoiId(existing: Poi[]): string {
  const used = new Set(existing.map((poi) => poi.id));
  let index = existing.length + 1;

  while (used.has(`poi-custom-${index}`)) {
    index += 1;
  }

  return `poi-custom-${index}`;
}

export function createPoiAtDistance(
  track: TrackPoint[],
  distanceKm: number,
  name: string,
  description?: string,
  existing: Poi[] = [],
): Poi | null {
  if (track.length === 0) return null;

  const totalM = track[track.length - 1].distanceM;
  const distanceM = Math.min(Math.max(0, distanceKm * 1000), totalM);

  let lat = track[0].lat;
  let lng = track[0].lng;

  if (distanceM > 0) {
    for (let index = 0; index < track.length - 1; index += 1) {
      const from = track[index];
      const to = track[index + 1];
      if (distanceM >= from.distanceM && distanceM <= to.distanceM) {
        const span = to.distanceM - from.distanceM;
        const ratio = span === 0 ? 0 : (distanceM - from.distanceM) / span;
        const point = interpolateTrackPoint(track, index, ratio);
        lat = point.lat;
        lng = point.lng;
        break;
      }
    }
  }

  return {
    id: generatePoiId(existing),
    name: name.trim() || `POI ${existing.length + 1}`,
    description: description?.trim() || undefined,
    lat,
    lng,
    ele: getElevationAtDistance(track, distanceM),
    distanceFromStartM: distanceM,
  };
}

export function createPoiFromMapClick(
  track: TrackPoint[],
  lat: number,
  lng: number,
  name: string,
  description?: string,
  existing: Poi[] = [],
): Poi | null {
  const snapped = snapLatLngToTrack(track, lat, lng);
  if (!snapped) return null;

  return {
    id: generatePoiId(existing),
    name: name.trim() || `POI ${existing.length + 1}`,
    description: description?.trim() || undefined,
    lat: snapped.lat,
    lng: snapped.lng,
    ele: snapped.ele,
    distanceFromStartM: snapped.distanceM,
  };
}

export function mergePois(pois: Poi[]): Poi[] {
  return sortPoisByDistance(pois);
}

export function isOsmWaterAlreadyAdded(pois: Poi[], osmId: string): boolean {
  return pois.some((poi) => poi.osmId === osmId && poi.source === "osm");
}

export function isOsmCityLimitAlreadyAdded(pois: Poi[], osmId: string): boolean {
  return pois.some((poi) => poi.osmId === osmId && poi.source === "osm-city-limit");
}

export function findPoiByOsmId(pois: Poi[], osmId: string, source: PoiSource): Poi | undefined {
  return pois.find((poi) => poi.osmId === osmId && poi.source === source);
}

export function createPoiFromOsmCityLimit(
  track: TrackPoint[],
  sign: {
    lat: number;
    lng: number;
    name?: string;
    description?: string;
    osmId: string;
  },
  defaultName: string,
  existing: Poi[] = [],
): Poi | null {
  const snapped = snapLatLngToTrack(track, sign.lat, sign.lng);
  if (!snapped) return null;

  const trimmedName = sign.name?.trim();
  const trimmedDescription = sign.description?.trim();

  return {
    id: generatePoiId(existing),
    name: trimmedName || defaultName,
    description: trimmedDescription || undefined,
    lat: snapped.lat,
    lng: snapped.lng,
    ele: snapped.ele,
    distanceFromStartM: snapped.distanceM,
    source: "osm-city-limit",
    osmId: sign.osmId,
  };
}

export function createPoiFromOsmWater(
  track: TrackPoint[],
  water: {
    lat: number;
    lng: number;
    name?: string;
    description?: string;
    osmId: string;
  },
  defaultName: string,
  existing: Poi[] = [],
): Poi | null {
  const snapped = snapLatLngToTrack(track, water.lat, water.lng);
  if (!snapped) return null;

  const trimmedName = water.name?.trim();
  const trimmedDescription = water.description?.trim();

  return {
    id: generatePoiId(existing),
    name: trimmedName || defaultName,
    description: trimmedDescription || undefined,
    lat: snapped.lat,
    lng: snapped.lng,
    ele: snapped.ele,
    distanceFromStartM: snapped.distanceM,
    source: "osm",
    osmId: water.osmId,
  };
}
