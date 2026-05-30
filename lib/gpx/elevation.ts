import type { TrackPoint } from "@/types/roadbook";

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function computeElevationStats(track: TrackPoint[]) {
  if (track.length === 0) {
    return {
      elevationGainM: 0,
      elevationLossM: 0,
      minElevationM: 0,
      maxElevationM: 0,
    };
  }

  let elevationGainM = 0;
  let elevationLossM = 0;
  let minElevationM = track[0].ele;
  let maxElevationM = track[0].ele;

  for (let i = 1; i < track.length; i++) {
    const delta = track[i].ele - track[i - 1].ele;
    if (delta > 0) elevationGainM += delta;
    else elevationLossM += Math.abs(delta);

    minElevationM = Math.min(minElevationM, track[i].ele);
    maxElevationM = Math.max(maxElevationM, track[i].ele);
  }

  return {
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    minElevationM: Math.round(minElevationM),
    maxElevationM: Math.round(maxElevationM),
  };
}

/** Positive elevation gain between two distances along the track (m). */
export function elevationGainBetween(
  track: TrackPoint[],
  fromDistanceM: number,
  toDistanceM: number,
): number {
  if (track.length < 2 || toDistanceM <= fromDistanceM) return 0;

  const from = Math.max(0, fromDistanceM);
  const to = Math.min(track[track.length - 1].distanceM, toDistanceM);
  if (to <= from) return 0;

  let gain = 0;
  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1];
    const curr = track[i];
    const segStart = prev.distanceM;
    const segEnd = curr.distanceM;

    if (segEnd <= from || segStart >= to) continue;

    const delta = curr.ele - prev.ele;
    if (delta <= 0) continue;

    if (segStart >= from && segEnd <= to) {
      gain += delta;
      continue;
    }

    const overlapStart = Math.max(segStart, from);
    const overlapEnd = Math.min(segEnd, to);
    const overlap = overlapEnd - overlapStart;
    const segLen = segEnd - segStart;
    if (segLen > 0 && overlap > 0) {
      gain += delta * (overlap / segLen);
    }
  }

  return Math.round(gain);
}

export function buildTrackWithDistances(
  points: Array<{ lat: number; lng: number; ele: number }>,
): TrackPoint[] {
  let cumulative = 0;
  return points.map((point, index) => {
    if (index > 0) {
      const prev = points[index - 1];
      cumulative += haversineDistanceM(prev.lat, prev.lng, point.lat, point.lng);
    }
    return {
      lat: point.lat,
      lng: point.lng,
      ele: point.ele,
      distanceM: cumulative,
    };
  });
}

/** Interpolated track elevation at a given distance from the start. */
export function getElevationAtDistance(
  track: TrackPoint[],
  distanceM: number,
): number {
  if (track.length === 0) return 0;
  if (distanceM <= track[0].distanceM) return track[0].ele;
  const last = track[track.length - 1];
  if (distanceM >= last.distanceM) return last.ele;

  for (let i = 1; i < track.length; i++) {
    const curr = track[i];
    if (curr.distanceM >= distanceM) {
      const prev = track[i - 1];
      const span = curr.distanceM - prev.distanceM;
      if (span === 0) return curr.ele;
      const ratio = (distanceM - prev.distanceM) / span;
      return prev.ele + ratio * (curr.ele - prev.ele);
    }
  }

  return last.ele;
}
