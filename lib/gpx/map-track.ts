import { colorForMapGradePct, instantGradeAtDistance } from "@/lib/gpx/gradient";
import { haversineDistanceM } from "@/lib/gpx/elevation";
import type { TrackPoint } from "@/types/roadbook";

export interface MapTrackSegment {
  color: string;
  positions: [number, number][];
}

/** Same half-window as the profile tooltip — avoids GPS spikes on short hops (bridges, etc.). */
const MAP_GRADE_HALF_WINDOW_M = 30;
/** Insert display points along sparse GPX segments (route planners, exported routes). */
export const MAP_DISPLAY_GAP_M = 5;
/** Below this, use the full densified track — no thinning. */
const MAP_TRACK_FULL_THRESHOLD = 8000;
/** Cap for very long tours (e.g. 800 km) where densified tracks exceed the threshold. */
const OUTLINE_MAX_POINTS = 12000;
const COLOR_MAX_POINTS = 12000;

function interpolateSegmentPoint(from: TrackPoint, to: TrackPoint, ratio: number): TrackPoint {
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
    ele: from.ele + (to.ele - from.ele) * ratio,
    distanceM: from.distanceM + (to.distanceM - from.distanceM) * ratio,
  };
}

/**
 * Densify sparse track segments for map display only.
 * GPX route exports often have turn-by-turn waypoints hundreds of meters apart;
 * Leaflet draws straight chords between them unless we interpolate.
 */
export function densifyTrackForMapDisplay(
  track: TrackPoint[],
  maxGapM = MAP_DISPLAY_GAP_M,
): TrackPoint[] {
  if (track.length < 2 || maxGapM <= 0) return track;

  const dense: TrackPoint[] = [track[0]];

  for (let index = 0; index < track.length - 1; index += 1) {
    const from = track[index];
    const to = track[index + 1];
    const segmentLengthM = haversineDistanceM(from.lat, from.lng, to.lat, to.lng);

    if (segmentLengthM <= maxGapM) {
      dense.push(to);
      continue;
    }

    const steps = Math.ceil(segmentLengthM / maxGapM);
    for (let step = 1; step <= steps; step += 1) {
      dense.push(interpolateSegmentPoint(from, to, step / steps));
    }
  }

  return dense;
}

function sampleTrack(track: TrackPoint[], maxPoints: number): TrackPoint[] {
  if (track.length <= maxPoints) return track;
  const step = Math.ceil(track.length / maxPoints);
  return track.filter(
    (_, index) => index % step === 0 || index === track.length - 1,
  );
}

function prepareTrackForMap(track: TrackPoint[], maxPoints: number): TrackPoint[] {
  const densified = densifyTrackForMapDisplay(track);
  if (densified.length <= MAP_TRACK_FULL_THRESHOLD) return densified;
  return sampleTrack(densified, maxPoints);
}

function segmentColor(track: TrackPoint[], from: TrackPoint, to: TrackPoint): string {
  const midDistance = (from.distanceM + to.distanceM) / 2;
  const grade = instantGradeAtDistance(track, midDistance, MAP_GRADE_HALF_WINDOW_M);
  return colorForMapGradePct(Math.round(grade * 10) / 10);
}

/** Colored track segments for the map — windowed grade, aligned with the elevation profile. */
export function buildColoredTrackSegments(track: TrackPoint[]): MapTrackSegment[] {
  const points = prepareTrackForMap(track, COLOR_MAX_POINTS);
  if (points.length < 2) return [];

  const segments: MapTrackSegment[] = [];
  let current: MapTrackSegment | null = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const color = segmentColor(track, from, to);
    const toPosition: [number, number] = [to.lat, to.lng];

    if (current !== null && current.color === color) {
      current.positions.push(toPosition);
      continue;
    }

    if (current !== null) segments.push(current);
    current = {
      color,
      positions: [[from.lat, from.lng], toPosition],
    };
  }

  if (current) segments.push(current);
  return segments;
}

export function trackPolylinePositions(track: TrackPoint[]): [number, number][] {
  return prepareTrackForMap(track, OUTLINE_MAX_POINTS).map(
    (point) => [point.lat, point.lng] as [number, number],
  );
}
