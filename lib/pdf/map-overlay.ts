import type { Poi, TrackPoint } from "@/types/roadbook";
import { getElevationAtDistance } from "@/lib/gpx/elevation";
import {
  buildColoredTrackSegments,
  trackPolylinePositions,
} from "@/lib/gpx/map-track";
import { sortPoisByDistance } from "@/lib/gpx/poi";
import {
  latLngToProjectedPixel,
  pointsToPathD,
  type MapProjectionMeta,
  type PdfPoint,
} from "@/lib/pdf/geo-bounds";

function sampleTrack(track: TrackPoint[], maxPoints = 250): TrackPoint[] {
  if (track.length <= maxPoints) return track;
  const step = Math.ceil(track.length / maxPoints);
  return track.filter(
    (_, index) => index % step === 0 || index === track.length - 1,
  );
}

function densifyPoints(points: Array<{ x: number; y: number }>, maxGap = 6): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;

  const dense: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(distance / maxGap));

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      dense.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
    }
  }

  return dense;
}

export interface MapPoiMarker {
  id: string;
  number: number;
  name: string;
  distanceKm: number;
  elevationM?: number;
  description?: string;
  x: number;
  y: number;
}

export interface MapEndpointMarker {
  kind: "start" | "finish";
  distanceKm: number;
  elevationM: number;
  x: number;
  y: number;
}

export interface MapColoredSegment {
  color: string;
  d: string;
}

export interface MapOverlayData {
  /** White underlay — same sampling as the interactive map outline. */
  trackOutlinePath: string;
  /** Grade-colored segments aligned with GradientTrackLine / map-track. */
  trackSegments: MapColoredSegment[];
  trackPoints: Array<{ x: number; y: number }>;
  pois: MapPoiMarker[];
  markers: MapEndpointMarker[];
  width: number;
  height: number;
}

function latLngPositionsToPath(
  positions: [number, number][],
  projection: MapProjectionMeta,
): string {
  const points = densifyPoints(
    positions.map(([lat, lng]) => latLngToProjectedPixel(lat, lng, projection)),
  );
  return pointsToPathD(points);
}

function trackToDensePoints(track: TrackPoint[], projection: MapProjectionMeta): PdfPoint[] {
  return densifyPoints(
    sampleTrack(track).map((point) => latLngToProjectedPixel(point.lat, point.lng, projection)),
  );
}

export function buildMapOverlay(
  track: TrackPoint[],
  pois: Poi[],
  projection: MapProjectionMeta,
): MapOverlayData {
  const trackPoints = trackToDensePoints(track, projection);
  const trackOutlinePath = latLngPositionsToPath(trackPolylinePositions(track), projection);
  const trackSegments = buildColoredTrackSegments(track)
    .map((segment) => ({
      color: segment.color,
      d: latLngPositionsToPath(segment.positions, projection),
    }))
    .filter((segment) => segment.d.length > 0);

  const poiMarkers = sortPoisByDistance(pois).map((poi, index) => ({
    id: poi.id,
    number: index + 1,
    name: poi.name,
    distanceKm: poi.distanceFromStartM / 1000,
    elevationM: poi.ele ?? getElevationAtDistance(track, poi.distanceFromStartM),
    description: poi.description,
    ...latLngToProjectedPixel(poi.lat, poi.lng, projection),
  }));

  const markers: MapEndpointMarker[] = [];
  const start = track[0];
  const finish = track[track.length - 1];

  if (start) {
    markers.push({
      kind: "start",
      distanceKm: start.distanceM / 1000,
      elevationM: start.ele,
      ...latLngToProjectedPixel(start.lat, start.lng, projection),
    });
  }

  if (finish && finish !== start) {
    markers.push({
      kind: "finish",
      distanceKm: finish.distanceM / 1000,
      elevationM: finish.ele,
      ...latLngToProjectedPixel(finish.lat, finish.lng, projection),
    });
  }

  return {
    trackOutlinePath,
    trackSegments,
    trackPoints,
    pois: poiMarkers,
    markers,
    width: projection.outputWidth,
    height: projection.outputHeight,
  };
}
