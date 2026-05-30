import { describe, expect, it } from "vitest";
import { getElevationAtDistance } from "@/lib/gpx/elevation";
import {
  buildElevationPoiPoints,
  buildStartFinishMarkers,
  buildPdfElevationChartModel,
  buildPdfClimbHighlights,
  elevationMarkerPoints,
  elevationPoiPoints,
  elevationProfilePathD,
  getElevationChartDomain,
  smoothPathFromPoints,
} from "@/lib/pdf/elevation-chart";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import { detectClimbs } from "@/lib/gpx/gradient";
import type { TrackPoint } from "@/types/roadbook";

const track: TrackPoint[] = [
  { lat: 45, lng: 6, ele: 100, distanceM: 0 },
  { lat: 45.01, lng: 6.01, ele: 200, distanceM: 1000 },
  { lat: 45.02, lng: 6.02, ele: 150, distanceM: 2000 },
];

describe("getElevationAtDistance", () => {
  it("interpolates elevation between two track points", () => {
    expect(getElevationAtDistance(track, 500)).toBe(150);
  });

  it("returns endpoints outside the track range", () => {
    expect(getElevationAtDistance(track, 0)).toBe(100);
    expect(getElevationAtDistance(track, 5000)).toBe(150);
  });
});

describe("buildElevationPoiPoints", () => {
  it("places POIs on the profile at interpolated elevation", () => {
    const pois = buildElevationPoiPoints(track, [
      {
        id: "poi-1",
        name: "Mid",
        lat: 45.005,
        lng: 6.005,
        distanceFromStartM: 500,
      },
    ]);

    expect(pois[0].distanceKm).toBe(0.5);
    expect(pois[0].elevation).toBe(150);
    expect(pois[0].name).toBe("Mid");
    expect(pois[0].number).toBe(1);
  });
});

describe("buildStartFinishMarkers", () => {
  it("returns start and finish markers", () => {
    const markers = buildStartFinishMarkers(track);
    expect(markers).toHaveLength(2);
    expect(markers[0].kind).toBe("start");
    expect(markers[1].kind).toBe("finish");
    expect(markers[1].distanceKm).toBe(2);
  });
});

describe("elevationMarkerPoints", () => {
  it("positions start and finish on the chart", () => {
    const markers = elevationMarkerPoints(track, 200, 100, 10);
    expect(markers).toHaveLength(2);
    expect(markers[0].kind).toBe("start");
    expect(markers[0].x).toBe(10);
  });
});

describe("elevationPoiPoints", () => {
  it("aligns POI x position with distance ratio on the chart", () => {
    const width = 200;
    const height = 100;
    const padding = 10;
    const [point] = elevationPoiPoints(
      track,
      [
        {
          id: "poi-1",
          name: "Halfway",
          lat: 45.01,
          lng: 6.01,
          distanceFromStartM: 1000,
        },
      ],
      width,
      height,
      padding,
    );

    expect(point.x).toBe(100);
    expect(point.y).toBeGreaterThanOrEqual(padding);
    expect(point.y).toBeLessThanOrEqual(height - padding);
  });
});

describe("getElevationChartDomain", () => {
  it("spans from 0 to total track distance", () => {
    expect(getElevationChartDomain(track)).toEqual([0, 2]);
  });
});

describe("smoothPathFromPoints", () => {
  it("uses cubic curves for multi-point paths", () => {
    const path = smoothPathFromPoints([
      { x: 0, y: 10 },
      { x: 20, y: 30 },
      { x: 40, y: 15 },
      { x: 60, y: 25 },
    ]);

    expect(path).toContain(" C ");
    expect(path.startsWith("M 0 10")).toBe(true);
  });
});

describe("elevationProfilePathD", () => {
  it("returns a smooth profile path", () => {
    const path = elevationProfilePathD(track, 200, 100, 10);
    expect(path).toContain(" C ");
  });
});

describe("buildPdfElevationChartModel", () => {
  it("builds grade-colored segments and a linear profile line", () => {
    const model = buildPdfElevationChartModel(track, 200, 100, "fr");

    expect(model.gradeSegments.length).toBeGreaterThan(0);
    expect(model.profileLinePath).toContain("L ");
    expect(model.profileLinePath).not.toContain(" C ");
    expect(model.xTicks.length).toBeGreaterThan(0);
    expect(model.xGridLines.length).toBeGreaterThan(0);
    expect(model.yTicks.length).toBeGreaterThan(0);
    expect(model.layout.yDomain[0]).toBeLessThanOrEqual(100);
    expect(model.layout.yDomain[1]).toBeGreaterThanOrEqual(200);
  });

  it("uses a dense km grid in strip mode", () => {
    const model = buildPdfElevationChartModel(track, 200, 40, "fr", undefined, undefined, undefined, undefined, {
      variant: "strip",
    });

    expect(model.variant).toBe("strip");
    expect(model.xGridLines.length).toBe(3);
    expect(model.layout.plotBottom - model.layout.plotTop).toBeLessThan(30);
  });
});

describe("buildPdfClimbHighlights", () => {
  it("maps climb spans to full-height chart bands with numbered badges", () => {
    const climbTrack = buildTrackWithDistances(
      Array.from({ length: 40 }, (_, index) => ({
        lat: 45 + index * 0.001,
        lng: 6,
        ele: 100 + index * 4,
      })),
    );
    const climbs = detectClimbs(climbTrack);
    const model = buildPdfElevationChartModel(climbTrack, 200, 100, "fr");
    const highlights = buildPdfClimbHighlights(climbs, model.layout);

    expect(climbs.length).toBeGreaterThan(0);
    expect(highlights.length).toBe(climbs.length);
    expect(highlights[0].number).toBe(1);
    expect(highlights[0].width).toBeGreaterThan(0);
    expect(highlights[0].height).toBe(model.layout.plotBottom - model.layout.plotTop);
    expect(highlights[0].badgeX).toBeGreaterThan(highlights[0].x);
  });
});
