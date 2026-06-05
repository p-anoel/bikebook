import { describe, expect, it } from "vitest";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import {
  createDefaultStage,
  isLongRoute,
  normalizeStages,
  splitStagesByTargetKm,
} from "@/lib/gpx/stage-split";

function makeTrack(totalM: number, points = 5) {
  const raw = Array.from({ length: points }, (_, index) => ({
    lat: 45 + index * 0.001,
    lng: 6 + index * 0.001,
    ele: 100,
  }));
  const track = buildTrackWithDistances(raw);
  const last = track[track.length - 1];
  const scale = totalM / last.distanceM;
  return track.map((pt) => ({
    ...pt,
    distanceM: pt.distanceM * scale,
  }));
}

describe("createDefaultStage", () => {
  it("creates one stage ending at track distance", () => {
    const track = makeTrack(42_000);
    const stages = createDefaultStage(track);
    expect(stages).toHaveLength(1);
    expect(stages[0].endDistanceM).toBeCloseTo(42_000, 0);
  });
});

describe("splitStagesByTargetKm", () => {
  it("splits a long route into roughly equal stages", () => {
    const track = makeTrack(360_000);
    const stages = splitStagesByTargetKm(track, 120);
    expect(stages.length).toBeGreaterThanOrEqual(3);
    expect(stages[stages.length - 1].endDistanceM).toBeCloseTo(360_000, 0);
  });

  it("returns a single stage when route is shorter than target", () => {
    const track = makeTrack(50_000);
    const stages = splitStagesByTargetKm(track, 120);
    expect(stages).toHaveLength(1);
  });
});

describe("normalizeStages", () => {
  it("forces the last stage to end at total distance", () => {
    const stages = normalizeStages(
      [
        { id: "1", endDistanceM: 40_000 },
        { id: "2", endDistanceM: 80_000 },
      ],
      95_000,
    );
    expect(stages[stages.length - 1].endDistanceM).toBe(95_000);
  });
});

describe("isLongRoute", () => {
  it("detects routes above threshold", () => {
    expect(isLongRoute(200)).toBe(true);
    expect(isLongRoute(100)).toBe(false);
  });
});
