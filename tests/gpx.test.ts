import { describe, expect, it } from "vitest";
import {
  buildTrackWithDistances,
  computeElevationStats,
  haversineDistanceM,
} from "@/lib/gpx/elevation";
import { isGpxParseError, parseGpxContent } from "@/lib/gpx/parser";
import { projectPoisOnTrack, sortPoisByDistance } from "@/lib/gpx/poi";
import {
  NO_TRACK_GPX,
  ROUTE_GPX,
  SAMPLE_GPX,
  SINGLE_POINT_GPX,
} from "./fixtures/gpx";

describe("haversineDistanceM", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceM(45, 6, 45, 6)).toBe(0);
  });

  it("computes a positive distance between two distinct points", () => {
    const d = haversineDistanceM(45, 6, 45.01, 6.01);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(2000);
  });
});

describe("computeElevationStats", () => {
  it("calculates gain, loss, min and max elevation", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.01, lng: 6.01, ele: 150 },
      { lat: 45.02, lng: 6.02, ele: 120 },
    ]);

    const stats = computeElevationStats(track);
    expect(stats.elevationGainM).toBe(50);
    expect(stats.elevationLossM).toBe(30);
    expect(stats.minElevationM).toBe(100);
    expect(stats.maxElevationM).toBe(150);
  });
});

describe("buildTrackWithDistances", () => {
  it("starts at 0 and accumulates distance", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 0 },
      { lat: 45.01, lng: 6.01, ele: 0 },
    ]);

    expect(track[0].distanceM).toBe(0);
    expect(track[1].distanceM).toBeGreaterThan(0);
  });
});

describe("projectPoisOnTrack", () => {
  it("projects waypoints onto nearest track point", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.01, lng: 6.01, ele: 110 },
    ]);

    const pois = projectPoisOnTrack(
      [{ lat: 45.005, lng: 6.005, name: "Test POI" }],
      track,
    );

    expect(pois).toHaveLength(1);
    expect(pois[0].name).toBe("Test POI");
    expect(pois[0].distanceFromStartM).toBeGreaterThanOrEqual(0);
  });

  it("returns POIs sorted by distance from start", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.05, lng: 6.05, ele: 110 },
      { lat: 45.1, lng: 6.1, ele: 120 },
    ]);

    const pois = projectPoisOnTrack(
      [
        { lat: 45.09, lng: 6.09, name: "Far" },
        { lat: 45.01, lng: 6.01, name: "Near" },
      ],
      track,
    );

    expect(pois[0].name).toBe("Near");
    expect(pois[1].name).toBe("Far");
    expect(pois[0].distanceFromStartM).toBeLessThanOrEqual(
      pois[1].distanceFromStartM,
    );
  });
});

describe("sortPoisByDistance", () => {
  it("sorts without mutating the original array", () => {
    const pois = [
      {
        id: "b",
        name: "B",
        lat: 0,
        lng: 0,
        distanceFromStartM: 5000,
      },
      {
        id: "a",
        name: "A",
        lat: 0,
        lng: 0,
        distanceFromStartM: 1000,
      },
    ];

    const sorted = sortPoisByDistance(pois);
    expect(sorted[0].name).toBe("A");
    expect(pois[0].name).toBe("B");
  });
});

describe("parseGpxContent", () => {
  it("parses a valid GPX track with waypoints", () => {
    const roadbook = parseGpxContent(SAMPLE_GPX, "ride.gpx");

    expect(roadbook.name).toBe("Alpine Loop");
    expect(roadbook.track.length).toBe(4);
    expect(roadbook.pois).toHaveLength(1);
    expect(roadbook.pois[0].name).toBe("Refuge");
    expect(roadbook.stats.distanceKm).toBeGreaterThan(0);
    expect(roadbook.stats.elevationGainM).toBeGreaterThan(0);
    expect(roadbook.bounds[0][0]).toBeLessThan(roadbook.bounds[1][0]);
  });

  it("falls back to route points when no track is present", () => {
    const roadbook = parseGpxContent(ROUTE_GPX, "route.gpx");
    expect(roadbook.track.length).toBe(2);
    expect(roadbook.name).toBe("Route only");
  });

  it("throws NO_TRACK for GPX without track or route", () => {
    try {
      parseGpxContent(NO_TRACK_GPX);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(isGpxParseError(error)).toBe(true);
      if (isGpxParseError(error)) {
        expect(error.code).toBe("NO_TRACK");
      }
    }
  });

  it("throws EMPTY_TRACK for single-point tracks", () => {
    try {
      parseGpxContent(SINGLE_POINT_GPX);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(isGpxParseError(error)).toBe(true);
      if (isGpxParseError(error)) {
        expect(error.code).toBe("EMPTY_TRACK");
      }
    }
  });

  it("throws INVALID_XML for malformed content", () => {
    try {
      parseGpxContent("not xml at all");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(isGpxParseError(error)).toBe(true);
    }
  });
});
