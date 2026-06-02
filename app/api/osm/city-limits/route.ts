import { NextResponse } from "next/server";
import { getCityLimitSignsNearTrack } from "@/lib/osm/city-limit-signs";
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
        { error: { code: "INVALID_REQUEST", message: "Invalid city limits request" } },
        { status: 400 },
      );
    }

    const cityLimitSigns = await getCityLimitSignsNearTrack(track);
    return NextResponse.json({ cityLimitSigns });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "City limit signs fetch failed";
    const message =
      raw.startsWith("Overpass") ||
      raw.startsWith("Impossible de joindre Overpass") ||
      raw.startsWith("Les serveurs OpenStreetMap")
        ? raw
        : `Panneaux de commune OSM indisponibles : ${raw}`;
    return NextResponse.json(
      { error: { code: "CITY_LIMITS_FETCH_FAILED", message } },
      { status: 502 },
    );
  }
}
