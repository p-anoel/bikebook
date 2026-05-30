import { describe, expect, it } from "vitest";
import {
  buildTrackWithDistances,
  computeElevationStats,
  elevationGainBetween,
  haversineDistanceM,
} from "@/lib/gpx/elevation";

describe("elevation utilities", () => {
  it("computes haversine distance between two close points", () => {
    const distance = haversineDistanceM(45, 6, 45.001, 6.001);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(200);
  });

  it("builds cumulative distances along a track", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 1000 },
      { lat: 45.001, lng: 6.001, ele: 1010 },
      { lat: 45.002, lng: 6.002, ele: 1020 },
    ]);

    expect(track[0].distanceM).toBe(0);
    expect(track[2].distanceM).toBeGreaterThan(track[1].distanceM);
  });

  it("computes elevation gain and loss", () => {
    const track = buildTrackWithDistances([
      { lat: 0, lng: 0, ele: 100 },
      { lat: 0, lng: 0.001, ele: 150 },
      { lat: 0, lng: 0.002, ele: 120 },
    ]);

    const stats = computeElevationStats(track);
    expect(stats.elevationGainM).toBe(50);
    expect(stats.elevationLossM).toBe(30);
    expect(stats.minElevationM).toBe(100);
    expect(stats.maxElevationM).toBe(150);
  });

  it("computes elevation gain between two distances", () => {
    const track = buildTrackWithDistances([
      { lat: 0, lng: 0, ele: 100 },
      { lat: 0, lng: 0.001, ele: 150 },
      { lat: 0, lng: 0.002, ele: 120 },
      { lat: 0, lng: 0.003, ele: 180 },
    ]);

    expect(elevationGainBetween(track, 0, track[1].distanceM)).toBe(50);
    expect(elevationGainBetween(track, track[1].distanceM, track[2].distanceM)).toBe(0);
    expect(elevationGainBetween(track, track[1].distanceM, track[3].distanceM)).toBe(60);
    expect(elevationGainBetween(track, 0, track[track.length - 1].distanceM)).toBe(110);
  });
});
