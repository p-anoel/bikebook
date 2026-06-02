import { NextResponse } from "next/server";
import { getWaterPointsNearTrack } from "@/lib/osm/water-points";
import type { TrackPoint } from "@/types/roadbook";

function isTrackPoint(value: unknown): value is TrackPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as TrackPoint;
  return (
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng)
  );
}

function validateTrack(body: unknown): TrackPoint[] | null {
  if (!body || typeof body !== "object") return null;
  const track = (body as { track?: unknown }).track;
  if (!Array.isArray(track) || track.length === 0) return null;
  if (!track.every(isTrackPoint)) return null;
  return track as TrackPoint[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const track = validateTrack(body);

    if (!track) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Invalid water points request" } },
        { status: 400 },
      );
    }

    const waterPoints = await getWaterPointsNearTrack(track);
    return NextResponse.json({ waterPoints });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Water points fetch failed";
    const message =
      raw.startsWith("Overpass") ||
      raw.startsWith("Impossible de joindre Overpass") ||
      raw.startsWith("Les serveurs OpenStreetMap")
        ? raw
        : `Points d'eau OSM indisponibles : ${raw}`;
    return NextResponse.json(
      { error: { code: "WATER_POINTS_FETCH_FAILED", message } },
      { status: 502 },
    );
  }
}
