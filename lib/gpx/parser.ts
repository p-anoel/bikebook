import { XMLParser } from "fast-xml-parser";
import { computeBounds } from "@/lib/gpx/bounds";
import {
  buildTrackWithDistances,
  computeElevationStats,
} from "@/lib/gpx/elevation";
import { projectPoisOnTrack, type RawWaypoint } from "@/lib/gpx/poi";
import { createDefaultStage } from "@/lib/gpx/stage-split";
import type { GpxParseError, Roadbook, RoadbookBounds } from "@/types/roadbook";

type GpxPoint = {
  "@_lat": string;
  "@_lon": string;
  ele?: string | number;
  name?: string;
  desc?: string;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseCoordinate(value: string): number {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) {
    throw new Error("Invalid coordinate");
  }
  return num;
}

function parseElevation(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isNaN(num) ? 0 : num;
}

function extractTrackPoints(gpx: Record<string, unknown>): Array<{
  lat: number;
  lng: number;
  ele: number;
}> {
  const tracks = asArray(
    (gpx.trk as Record<string, unknown> | Record<string, unknown>[] | undefined),
  );

  const points: Array<{ lat: number; lng: number; ele: number }> = [];

  for (const track of tracks) {
    const segments = asArray(
      track.trkseg as Record<string, unknown> | Record<string, unknown>[] | undefined,
    );
    for (const segment of segments) {
      for (const pt of asArray(segment.trkpt as GpxPoint | GpxPoint[] | undefined)) {
        points.push({
          lat: parseCoordinate(pt["@_lat"]),
          lng: parseCoordinate(pt["@_lon"]),
          ele: parseElevation(pt.ele),
        });
      }
    }
  }

  if (points.length > 0) return points;

  const routes = asArray(
    (gpx.rte as Record<string, unknown> | Record<string, unknown>[] | undefined),
  );

  for (const route of routes) {
    for (const pt of asArray(route.rtept as GpxPoint | GpxPoint[] | undefined)) {
      points.push({
        lat: parseCoordinate(pt["@_lat"]),
        lng: parseCoordinate(pt["@_lon"]),
        ele: parseElevation(pt.ele),
      });
    }
  }

  return points;
}

function extractWaypoints(gpx: Record<string, unknown>): RawWaypoint[] {
  return asArray(gpx.wpt as GpxPoint | GpxPoint[] | undefined).map((wpt) => ({
    lat: parseCoordinate(wpt["@_lat"]),
    lng: parseCoordinate(wpt["@_lon"]),
    name: typeof wpt.name === "string" ? wpt.name : undefined,
    description: typeof wpt.desc === "string" ? wpt.desc : undefined,
    ele: wpt.ele !== undefined ? parseElevation(wpt.ele) : undefined,
  }));
}

function extractTrackName(gpx: Record<string, unknown>): string | undefined {
  const tracks = asArray(
    (gpx.trk as Record<string, unknown> | Record<string, unknown>[] | undefined),
  );
  const firstTrackName = tracks[0]?.name;
  if (typeof firstTrackName === "string" && firstTrackName.trim()) {
    return firstTrackName.trim();
  }

  const routes = asArray(
    (gpx.rte as Record<string, unknown> | Record<string, unknown>[] | undefined),
  );
  const firstRouteName = routes[0]?.name;
  if (typeof firstRouteName === "string" && firstRouteName.trim()) {
    return firstRouteName.trim();
  }

  const metadata = gpx.metadata as Record<string, unknown> | undefined;
  if (typeof metadata?.name === "string" && metadata.name.trim()) {
    return metadata.name.trim();
  }

  return undefined;
}

function computeBoundsForTrack(
  track: Array<{ lat: number; lng: number }>,
): RoadbookBounds {
  return computeBounds(track);
}

export function parseGpxContent(
  content: string,
  fileName = "track.gpx",
): Roadbook {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(content) as Record<string, unknown>;
  } catch {
    throw createParseError("INVALID_XML", "The GPX file is not valid XML.");
  }

  const gpx = parsed.gpx as Record<string, unknown> | undefined;
  if (!gpx) {
    throw createParseError("INVALID_XML", "Missing GPX root element.");
  }

  const rawPoints = extractTrackPoints(gpx);
  if (rawPoints.length === 0) {
    throw createParseError(
      "NO_TRACK",
      "No track or route points found in the GPX file.",
    );
  }

  const track = buildTrackWithDistances(rawPoints);
  if (track.length < 2) {
    throw createParseError(
      "EMPTY_TRACK",
      "The track must contain at least two points.",
    );
  }

  const elevation = computeElevationStats(track);
  const waypoints = extractWaypoints(gpx);
  const pois = projectPoisOnTrack(waypoints, track);
  const totalDistanceM = track[track.length - 1].distanceM;

  const baseName = fileName.replace(/\.gpx$/i, "");

  return {
    id: crypto.randomUUID(),
    name: extractTrackName(gpx) ?? baseName,
    uploadedAt: new Date().toISOString(),
    stats: {
      distanceKm: Math.round((totalDistanceM / 1000) * 10) / 10,
      ...elevation,
    },
    track,
    pois,
    bounds: computeBoundsForTrack(track),
    stages: createDefaultStage(track),
  };
}

function createParseError(code: GpxParseError["code"], message: string): Error {
  const error = new Error(message) as Error & { code: GpxParseError["code"] };
  error.code = code;
  return error;
}

export function isGpxParseError(error: unknown): error is Error & {
  code: GpxParseError["code"];
} {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
