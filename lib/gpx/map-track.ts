import { colorForMapGradePct, instantGradeAtDistance } from "@/lib/gpx/gradient";
import type { TrackPoint } from "@/types/roadbook";

export interface MapTrackSegment {
  color: string;
  positions: [number, number][];
}

/** Same half-window as the profile tooltip — avoids GPS spikes on short hops (bridges, etc.). */
const MAP_GRADE_HALF_WINDOW_M = 30;
const OUTLINE_MAX_POINTS = 500;
const COLOR_MAX_POINTS = 1200;

function sampleTrack(track: TrackPoint[], maxPoints: number): TrackPoint[] {
  if (track.length <= maxPoints) return track;
  const step = Math.ceil(track.length / maxPoints);
  return track.filter(
    (_, index) => index % step === 0 || index === track.length - 1,
  );
}

function segmentColor(track: TrackPoint[], from: TrackPoint, to: TrackPoint): string {
  const midDistance = (from.distanceM + to.distanceM) / 2;
  const grade = instantGradeAtDistance(track, midDistance, MAP_GRADE_HALF_WINDOW_M);
  return colorForMapGradePct(Math.round(grade * 10) / 10);
}

/** Colored track segments for the map — windowed grade, aligned with the elevation profile. */
export function buildColoredTrackSegments(track: TrackPoint[]): MapTrackSegment[] {
  const points = sampleTrack(track, COLOR_MAX_POINTS);
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
  return sampleTrack(track, OUTLINE_MAX_POINTS).map(
    (point) => [point.lat, point.lng] as [number, number],
  );
}
