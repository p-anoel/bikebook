import { getElevationAtDistance } from "@/lib/gpx/elevation";
import { bearingDeg } from "@/lib/weather/bearing";
import type { RouteSegmentGeometry } from "@/lib/weather/types";
import type { TrackPoint } from "@/types/roadbook";

export const DEFAULT_SEGMENT_LENGTH_KM = 8;
export const DEFAULT_AVG_SPEED_KMH = 20;
export const MAX_WEATHER_SEGMENTS = 28;

function pointAtDistance(track: TrackPoint[], distanceM: number): TrackPoint {
  if (track.length === 0) {
    return { lat: 0, lng: 0, ele: 0, distanceM: 0 };
  }
  if (distanceM <= track[0].distanceM) return track[0];

  const last = track[track.length - 1];
  if (distanceM >= last.distanceM) return last;

  for (let index = 1; index < track.length; index += 1) {
    const curr = track[index];
    if (curr.distanceM >= distanceM) {
      const prev = track[index - 1];
      const span = curr.distanceM - prev.distanceM;
      if (span <= 0) return curr;
      const ratio = (distanceM - prev.distanceM) / span;
      return {
        lat: prev.lat + (curr.lat - prev.lat) * ratio,
        lng: prev.lng + (curr.lng - prev.lng) * ratio,
        ele: getElevationAtDistance(track, distanceM),
        distanceM,
      };
    }
  }

  return last;
}

function segmentBearing(track: TrackPoint[], startM: number, endM: number): number {
  const from = pointAtDistance(track, startM);
  const to = pointAtDistance(track, endM);
  if (Math.hypot(to.lat - from.lat, to.lng - from.lng) < 1e-8) {
    return 0;
  }
  return bearingDeg(from.lat, from.lng, to.lat, to.lng);
}

/** Split the route into ~segmentLengthKm chunks for weather sampling. */
export function buildRouteWeatherSegments(
  track: TrackPoint[],
  segmentLengthKm = DEFAULT_SEGMENT_LENGTH_KM,
): RouteSegmentGeometry[] {
  if (track.length < 2) return [];

  const totalM = track[track.length - 1].distanceM;
  const segmentLengthM = Math.max(segmentLengthKm * 1000, 1000);
  const segments: RouteSegmentGeometry[] = [];

  let startM = 0;
  let id = 1;

  while (startM < totalM - 1) {
    const endM = Math.min(startM + segmentLengthM, totalM);
    const centerM = (startM + endM) / 2;
    const center = pointAtDistance(track, centerM);

    segments.push({
      id,
      startDistanceM: startM,
      endDistanceM: endM,
      centerLat: center.lat,
      centerLng: center.lng,
      bearingDeg: segmentBearing(track, startM, endM),
    });

    if (endM >= totalM) break;
    startM = endM;
    id += 1;

    if (segments.length >= MAX_WEATHER_SEGMENTS) break;
  }

  return segments;
}

/** Estimated arrival ISO time at a distance from departure (pauses spread along the route). */
export function estimatedArrivalAtDistance(
  departureAt: string,
  distanceM: number,
  avgSpeedKmh = DEFAULT_AVG_SPEED_KMH,
  pauseMinutes = 0,
  totalDistanceM?: number,
): string {
  const departureMs = new Date(departureAt).getTime();
  if (Number.isNaN(departureMs) || avgSpeedKmh <= 0) {
    return departureAt;
  }

  const totalM = totalDistanceM ?? distanceM;
  const ratio = totalM > 0 ? Math.min(1, Math.max(0, distanceM / totalM)) : 0;
  const pauseMs = Math.max(0, pauseMinutes) * 60_000 * ratio;
  const ridingMs = (distanceM / 1000 / avgSpeedKmh) * 3_600_000;
  return new Date(departureMs + pauseMs + ridingMs).toISOString();
}
