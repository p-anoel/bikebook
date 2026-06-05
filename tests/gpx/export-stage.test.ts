import { describe, expect, it } from "vitest";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import {
  buildStageGpxDocument,
  buildStageGpxExport,
  stageGpxFilename,
} from "@/lib/gpx/export";
import type { Multitour } from "@/types/roadbook";

function makeMultitour(): Multitour {
  const track = buildTrackWithDistances([
    { lat: 45, lng: 6, ele: 100 },
    { lat: 45.005, lng: 6.005, ele: 150 },
    { lat: 45.01, lng: 6.01, ele: 200 },
  ]).map((pt, index) => ({
    ...pt,
    distanceM: index * 5000,
  }));

  return {
    id: "1",
    name: "Alpine Loop",
    uploadedAt: new Date().toISOString(),
    stats: {
      distanceKm: 10,
      elevationGainM: 100,
      elevationLossM: 0,
      minElevationM: 100,
      maxElevationM: 200,
    },
    track,
    pois: [
      {
        id: "poi-1",
        name: "Summit",
        lat: 45.01,
        lng: 6.01,
        distanceFromStartM: 10_000,
      },
    ],
    bounds: [
      [45, 6],
      [45.01, 6.01],
    ],
    stages: [
      { id: "s1", endDistanceM: 5000 },
      { id: "s2", endDistanceM: 10_000 },
    ],
  };
}

describe("buildStageGpxExport", () => {
  it("exports only the selected stage track and POIs", () => {
    const multitour = makeMultitour();
    const exported = buildStageGpxExport(multitour, 0, "Stage 1");

    expect(exported.name).toContain("Stage 1");
    expect(exported.track[0].distanceM).toBe(0);
    expect(exported.track[exported.track.length - 1].distanceM).toBeCloseTo(5000, 0);
    expect(exported.pois).toHaveLength(0);
  });

  it("includes POIs belonging to the stage", () => {
    const multitour = makeMultitour();
    const exported = buildStageGpxExport(multitour, 1, "Stage 2");

    expect(exported.pois).toHaveLength(1);
    expect(exported.pois[0].distanceFromStartM).toBeCloseTo(5000, 0);
  });
});

describe("buildStageGpxDocument", () => {
  it("produces valid GPX XML for a stage", () => {
    const xml = buildStageGpxDocument(makeMultitour(), 0, "Stage 1");
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<trkseg>");
    expect(xml).toContain("Stage 1");
  });
});

describe("stageGpxFilename", () => {
  it("includes stage number in filename", () => {
    expect(stageGpxFilename("Alpine Loop", 1, "Stage 2")).toBe(
      "Alpine_Loop_stage_2_Stage_2.gpx",
    );
  });
});
