import { describe, expect, it } from "vitest";
import {
  buildTrackWithDistances,
  computeElevationStats,
  computeThresholdGainLoss,
  ELEVATION_GAIN_THRESHOLD_M,
  elevationGainBetween,
  haversineDistanceM,
  smoothElevations,
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

  it("ignores GPS noise on flat terrain (naive sum would inflate D+)", () => {
    const noisyFlat = buildTrackWithDistances(
      [
        1000, 1003, 998, 1002, 999, 1004, 1001, 997, 1003, 1000,
      ].map((ele, i) => ({ lat: 45, lng: 6 + i * 0.0001, ele })),
    );

    const stats = computeElevationStats(noisyFlat);
    expect(stats.elevationGainM).toBe(0);
    expect(stats.elevationLossM).toBe(0);
  });

  it("counts real climbs while filtering sub-threshold oscillations", () => {
    const noisyClimb = buildTrackWithDistances(
      [
        1000, 1003, 1020, 1017, 1040, 1038, 1070, 1068, 1100,
      ].map((ele, i) => ({ lat: 45, lng: 6 + i * 0.001, ele })),
    );

    const stats = computeElevationStats(noisyClimb);
    const naiveGain = noisyClimb
      .slice(1)
      .reduce((sum, p, i) => sum + Math.max(0, p.ele - noisyClimb[i].ele), 0);

    expect(naiveGain).toBeGreaterThan(stats.elevationGainM);
    expect(stats.elevationGainM).toBe(100);
    expect(stats.elevationLossM).toBe(0);
  });

  it("smoothElevations reduces high-frequency noise when enabled", () => {
    const raw = [1000, 1003, 998, 1002];
    const smoothed = smoothElevations(raw, 3);
    expect(smoothed[1]).toBeCloseTo((1000 + 1003 + 998) / 3);

    const { elevationGainM } = computeThresholdGainLoss(smoothed, ELEVATION_GAIN_THRESHOLD_M);
    expect(elevationGainM).toBe(0);
  });

  it("POI cumulative gain uses the same filtered logic as track stats", () => {
    const track = buildTrackWithDistances(
      [
        1000, 1003, 1020, 1017, 1040, 1038, 1070, 1068, 1100,
      ].map((ele, i) => ({ lat: 45, lng: 6 + i * 0.001, ele })),
    );

    const totalGain = computeElevationStats(track).elevationGainM;
    const poiGain = elevationGainBetween(track, 0, track[track.length - 1].distanceM);
    expect(poiGain).toBe(totalGain);
  });
});
