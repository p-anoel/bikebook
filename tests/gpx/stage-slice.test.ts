import { describe, expect, it } from "vitest";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import {
  buildStageView,
  getStageStartDistanceM,
  sliceTrackSegment,
} from "@/lib/gpx/stage-slice";
import { createDefaultStage } from "@/lib/gpx/stage-split";
import type { Multitour, Poi } from "@/types/roadbook";

function makeTrack(distancesM: number[]) {
  const points = distancesM.map((distanceM, index) => ({
    lat: 45 + index * 0.001,
    lng: 6 + index * 0.001,
    ele: 100 + index * 10,
  }));
  const track = buildTrackWithDistances(points);
  return track.map((pt, index) => ({
    ...pt,
    distanceM: distancesM[index] ?? pt.distanceM,
  }));
}

function makeMultitour(
  distancesM: number[],
  stageEnds: number[],
  pois: Poi[] = [],
): Multitour {
  const track = makeTrack(distancesM);
  const stages = stageEnds.map((endDistanceM) => ({
    id: crypto.randomUUID(),
    endDistanceM,
  }));

  return {
    id: "tour-1",
    name: "Test tour",
    uploadedAt: new Date().toISOString(),
    stats: {
      distanceKm: distancesM[distancesM.length - 1] / 1000,
      elevationGainM: 100,
      elevationLossM: 50,
      minElevationM: 100,
      maxElevationM: 200,
    },
    track,
    pois,
    bounds: [
      [45, 6],
      [45.01, 6.01],
    ],
    stages,
  };
}

describe("getStageStartDistanceM", () => {
  it("returns 0 for the first stage", () => {
    const stages = createDefaultStage(makeTrack([0, 5000, 10000]));
    expect(getStageStartDistanceM(stages, 0)).toBe(0);
  });

  it("returns previous stage end for later stages", () => {
    const stages = [
      { id: "1", endDistanceM: 5000 },
      { id: "2", endDistanceM: 10000 },
    ];
    expect(getStageStartDistanceM(stages, 1)).toBe(5000);
  });
});

describe("sliceTrackSegment", () => {
  it("resets distanceM to 0 at stage start", () => {
    const track = makeTrack([0, 2500, 5000, 7500, 10000]);
    const slice = sliceTrackSegment(track, 2500, 7500);

    expect(slice.length).toBeGreaterThanOrEqual(2);
    expect(slice[0].distanceM).toBe(0);
    expect(slice[slice.length - 1].distanceM).toBeCloseTo(5000, -1);
  });
});

describe("buildStageView", () => {
  it("filters POIs to the active stage with relative distances", () => {
    const multitour = makeMultitour(
      [0, 5000, 10000],
      [5000, 10000],
      [
        {
          id: "a",
          name: "Start POI",
          lat: 45,
          lng: 6,
          distanceFromStartM: 100,
        },
        {
          id: "b",
          name: "Mid POI",
          lat: 45.005,
          lng: 6.005,
          distanceFromStartM: 5500,
        },
        {
          id: "c",
          name: "End POI",
          lat: 45.01,
          lng: 6.01,
          distanceFromStartM: 9900,
        },
      ],
    );

    const stage1 = buildStageView(multitour, 0);
    expect(stage1.pois).toHaveLength(1);
    expect(stage1.pois[0].id).toBe("a");

    const stage2 = buildStageView(multitour, 1);
    expect(stage2.pois).toHaveLength(2);
    expect(stage2.pois.map((p) => p.id)).toEqual(["b", "c"]);
    expect(stage2.pois[0].distanceFromStartM).toBeCloseTo(500, -1);
  });

  it("computes stage stats from the sliced track", () => {
    const multitour = makeMultitour([0, 5000, 10000], [5000, 10000]);
    const view = buildStageView(multitour, 0);
    expect(view.stats.distanceKm).toBe(5);
    expect(view.track[0].distanceM).toBe(0);
  });
});
