import { describe, expect, it } from "vitest";
import { buildMapOverlay } from "@/lib/pdf/map-overlay";
import type { MapProjectionMeta } from "@/lib/pdf/geo-bounds";
import type { Poi, TrackPoint } from "@/types/roadbook";

const projection: MapProjectionMeta = {
  zoom: 12,
  originWorldX: 1000,
  originWorldY: 2000,
  pixelWidth: 400,
  pixelHeight: 300,
  outputWidth: 499,
  outputHeight: 240,
  contentWidth: 499,
  contentHeight: 240,
  contentOffsetX: 0,
  contentOffsetY: 0,
};

const track: TrackPoint[] = [
  { lat: 45, lng: 6, ele: 100, distanceM: 0 },
  { lat: 45.02, lng: 6.02, ele: 150, distanceM: 2000 },
];

const pois: Poi[] = [
  {
    id: "poi-1",
    name: "Refuge",
    description: "Pause café",
    lat: 45.01,
    lng: 6.01,
    distanceFromStartM: 1000,
  },
];

describe("buildMapOverlay", () => {
  it("includes POI metadata and start/finish markers", () => {
    const overlay = buildMapOverlay(track, pois, projection);

    expect(overlay.pois).toHaveLength(1);
    expect(overlay.pois[0].name).toBe("Refuge");
    expect(overlay.pois[0].distanceKm).toBe(1);
    expect(overlay.pois[0].description).toBe("Pause café");
    expect(overlay.markers).toHaveLength(2);
    expect(overlay.markers[0].kind).toBe("start");
    expect(overlay.markers[1].kind).toBe("finish");
  });

  it("builds grade-colored track segments and a white outline path", () => {
    const overlay = buildMapOverlay(track, pois, projection);

    expect(overlay.trackOutlinePath).toMatch(/^M /);
    expect(overlay.trackSegments.length).toBeGreaterThan(0);
    expect(overlay.trackSegments.every((segment) => /^#[0-9a-f]{6}$/i.test(segment.color))).toBe(
      true,
    );
    expect(overlay.trackSegments.every((segment) => segment.d.startsWith("M "))).toBe(true);
  });

  it("uses map grade colors for uphill segments", () => {
    const steepTrack: TrackPoint[] = [
      { lat: 45, lng: 6, ele: 100, distanceM: 0 },
      { lat: 45.001, lng: 6.001, ele: 120, distanceM: 200 },
      { lat: 45.002, lng: 6.002, ele: 150, distanceM: 400 },
    ];
    const overlay = buildMapOverlay(steepTrack, [], projection);
    const colors = new Set(overlay.trackSegments.map((segment) => segment.color));

    expect(colors.has("#f97316") || colors.has("#ea580c") || colors.has("#ef4444")).toBe(true);
  });
});
