import type { TrackPoint } from "@/types/roadbook";

const EARTH_RADIUS_M = 6_371_000;

/**
 * Moving-average window (points) applied before D+ / D− summation.
 * Reduces high-frequency GPS / barometric noise on dense tracks. Use 1 to
 * disable (recommended for sparse route points where smoothing would
 * attenuate real climbs).
 */
export const ELEVATION_SMOOTHING_WINDOW = 1;

/**
 * Minimum vertical change (m) before a climb or descent is counted.
 * Komoot, Strava and Garmin typically ignore smaller oscillations (~7–10 m)
 * so that cumulative gain reflects real climbs, not sensor noise.
 */
export const ELEVATION_GAIN_THRESHOLD_M = 7;

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

/** Centered moving average of elevation values along the track. */
export function smoothElevations(
  elevations: number[],
  windowSize = ELEVATION_SMOOTHING_WINDOW,
): number[] {
  if (windowSize <= 1 || elevations.length === 0) return [...elevations];

  const half = Math.floor(windowSize / 2);
  return elevations.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(elevations.length - 1, i + half); j++) {
      sum += elevations[j];
      count++;
    }
    return sum / count;
  });
}

/**
 * Threshold-based gain/loss (hysteresis on a reference elevation).
 * Only changes ≥ thresholdM from the last reference update the running totals.
 */
export function computeThresholdGainLoss(
  elevations: number[],
  thresholdM = ELEVATION_GAIN_THRESHOLD_M,
): { elevationGainM: number; elevationLossM: number; cumulativeGainM: number[] } {
  if (elevations.length === 0) {
    return { elevationGainM: 0, elevationLossM: 0, cumulativeGainM: [] };
  }

  let elevationGainM = 0;
  let elevationLossM = 0;
  const cumulativeGainM: number[] = [0];
  let ref = elevations[0];

  for (let i = 1; i < elevations.length; i++) {
    const ele = elevations[i];
    const diff = ele - ref;

    if (diff >= thresholdM) {
      elevationGainM += diff;
      ref = ele;
    } else if (diff <= -thresholdM) {
      elevationLossM += -diff;
      ref = ele;
    }

    cumulativeGainM[i] = elevationGainM;
  }

  return { elevationGainM, elevationLossM, cumulativeGainM };
}

function buildFilteredElevationModel(track: TrackPoint[]) {
  const rawEle = track.map((p) => p.ele);
  const smoothedEle = smoothElevations(rawEle);
  return computeThresholdGainLoss(smoothedEle);
}

function cumulativeGainAtDistance(
  track: TrackPoint[],
  cumulativeGainM: number[],
  distanceM: number,
): number {
  if (track.length === 0 || cumulativeGainM.length === 0) return 0;
  if (distanceM <= track[0].distanceM) return 0;

  const last = track[track.length - 1];
  if (distanceM >= last.distanceM) return cumulativeGainM[cumulativeGainM.length - 1];

  for (let i = 1; i < track.length; i++) {
    const curr = track[i];
    if (curr.distanceM >= distanceM) {
      const prev = track[i - 1];
      const span = curr.distanceM - prev.distanceM;
      if (span === 0) return cumulativeGainM[i];
      const ratio = (distanceM - prev.distanceM) / span;
      return cumulativeGainM[i - 1] + ratio * (cumulativeGainM[i] - cumulativeGainM[i - 1]);
    }
  }

  return cumulativeGainM[cumulativeGainM.length - 1];
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

  const { elevationGainM, elevationLossM } = buildFilteredElevationModel(track);

  let minElevationM = track[0].ele;
  let maxElevationM = track[0].ele;
  for (let i = 1; i < track.length; i++) {
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

  const { cumulativeGainM } = buildFilteredElevationModel(track);
  const gain =
    cumulativeGainAtDistance(track, cumulativeGainM, to) -
    cumulativeGainAtDistance(track, cumulativeGainM, from);

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
