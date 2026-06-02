import { describe, expect, it } from "vitest";
import {
  LANDSCAPE_PROFILE_PAGE_MAX_KM,
  LANDSCAPE_PROFILE_STRIPS_PER_PAGE,
  buildLandscapeProfilePages,
  climbsInDistanceRange,
  endpointMarkersForChunk,
  formatProfileChunkLabel,
  landscapeStripHeightForPage,
  poisInDistanceRange,
} from "@/lib/pdf/profile-segments";
import type { ClimbSegment } from "@/lib/gpx/gradient";
import type { Poi, TrackPoint } from "@/types/roadbook";

function expectCloseKm(actual: number, expected: number) {
  expect(actual).toBeCloseTo(expected, 6);
}

describe("buildLandscapeProfilePages", () => {
  it("returns one page with four equal strips for short routes", () => {
    const pages = buildLandscapeProfilePages(42);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(LANDSCAPE_PROFILE_STRIPS_PER_PAGE);
    expectCloseKm(pages[0][0].startKm, 0);
    expectCloseKm(pages[0][0].endKm, 10.5);
    expectCloseKm(pages[0][3].startKm, 31.5);
    expectCloseKm(pages[0][3].endKm, 42);
  });

  it("splits 180 km into four 45 km strips on one page", () => {
    const pages = buildLandscapeProfilePages(180);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(4);
    expectCloseKm(pages[0][0].endKm, 45);
    expectCloseKm(pages[0][3].endKm, 180);
  });

  it("fits 250 km on one page as four 62.5 km strips", () => {
    const pages = buildLandscapeProfilePages(250);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(LANDSCAPE_PROFILE_STRIPS_PER_PAGE);
    expectCloseKm(pages[0][0].startKm, 0);
    expectCloseKm(pages[0][3].endKm, LANDSCAPE_PROFILE_PAGE_MAX_KM);
    expectCloseKm(pages[0][0].endKm, 62.5);
    expectCloseKm(pages[0][1].startKm, 62.5);
    expectCloseKm(pages[0][1].endKm, 125);
  });

  it("starts a new page after 250 km with equal strips per page", () => {
    const pages = buildLandscapeProfilePages(300);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(LANDSCAPE_PROFILE_STRIPS_PER_PAGE);
    expectCloseKm(pages[0][0].startKm, 0);
    expectCloseKm(pages[0][3].endKm, 250);
    expect(pages[1]).toHaveLength(LANDSCAPE_PROFILE_STRIPS_PER_PAGE);
    expectCloseKm(pages[1][0].startKm, 250);
    expectCloseKm(pages[1][3].endKm, 300);
    expectCloseKm(pages[1][0].endKm, 262.5);
  });

  it("splits long routes into 250 km landscape pages", () => {
    const pages = buildLandscapeProfilePages(900);
    expect(pages).toHaveLength(4);
    expect(pages.every((page) => page.length === LANDSCAPE_PROFILE_STRIPS_PER_PAGE)).toBe(
      true,
    );
    expectCloseKm(pages[0][0].startKm, 0);
    expectCloseKm(pages[0][3].endKm, 250);
    expectCloseKm(pages[3][0].startKm, 750);
    expectCloseKm(pages[3][3].endKm, 900);
    const flat = pages.flat();
    expect(flat[0].index).toBe(0);
    expect(flat[flat.length - 1].index).toBe(flat.length - 1);
  });

  it("handles zero distance", () => {
    expect(buildLandscapeProfilePages(0)).toEqual([
      [{ startKm: 0, endKm: 0, index: 0 }],
    ]);
  });
});

describe("formatProfileChunkLabel", () => {
  it("formats a km range label with absolute km", () => {
    expect(formatProfileChunkLabel(0, 62.5, "fr-FR")).toBe("Km 0 – 63");
    expect(formatProfileChunkLabel(250, 262.5, "en-US")).toBe("Km 250 – 263");
  });
});

describe("climbsInDistanceRange", () => {
  const climbs: ClimbSegment[] = [
    {
      id: 1,
      startDistanceM: 50_000,
      endDistanceM: 80_000,
      gainM: 400,
      lengthM: 30_000,
      avgGradePct: 1.3,
    },
    {
      id: 2,
      startDistanceM: 150_000,
      endDistanceM: 170_000,
      gainM: 300,
      lengthM: 20_000,
      avgGradePct: 1.5,
    },
  ];

  it("returns climbs overlapping the chunk", () => {
    expect(climbsInDistanceRange(climbs, 0, 50)).toEqual([]);
    expect(climbsInDistanceRange(climbs, 0, 100)).toEqual([climbs[0]]);
    expect(climbsInDistanceRange(climbs, 100, 200)).toEqual([climbs[1]]);
  });
});

describe("poisInDistanceRange", () => {
  const pois: Poi[] = [
    { id: "a", name: "Start", lat: 0, lng: 0, distanceFromStartM: 0 },
    { id: "b", name: "Mid", lat: 0, lng: 0, distanceFromStartM: 100_000 },
    { id: "c", name: "Far", lat: 0, lng: 0, distanceFromStartM: 150_000 },
  ];

  it("assigns boundary POIs to a single chunk", () => {
    expect(poisInDistanceRange(pois, 0, 50).map((p) => p.id)).toEqual(["a"]);
    expect(poisInDistanceRange(pois, 50, 100).map((p) => p.id)).toEqual(["b"]);
    expect(poisInDistanceRange(pois, 100, 200).map((p) => p.id)).toEqual(["c"]);
  });
});

describe("endpointMarkersForChunk", () => {
  const track: TrackPoint[] = [
    { lat: 0, lng: 0, ele: 0, distanceM: 0 },
    { lat: 1, lng: 1, ele: 0, distanceM: 250_000 },
  ];

  it("shows start only on the first chunk and finish on the last", () => {
    expect(endpointMarkersForChunk(track, 0, 62.5)).toEqual({
      showStart: true,
      showFinish: false,
    });
    expect(endpointMarkersForChunk(track, 187.5, 250)).toEqual({
      showStart: false,
      showFinish: true,
    });
  });
});

describe("landscapeStripHeightForPage", () => {
  it("shrinks each strip as more rows share the page", () => {
    const two = landscapeStripHeightForPage(2);
    const three = landscapeStripHeightForPage(3);
    const four = landscapeStripHeightForPage(4);
    expect(four).toBeLessThan(three);
    expect(three).toBeLessThan(two);
  });

  it("gives four full-page strips equal height with page safety margin", () => {
    const h = landscapeStripHeightForPage(4);
    expect(landscapeStripHeightForPage(4)).toBe(h);
    expect(h).toBe(86);
  });
});
