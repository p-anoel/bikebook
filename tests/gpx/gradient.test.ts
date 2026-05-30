import { describe, expect, it } from "vitest";
import {
  applyWheelZoom,
  applyHorizontalPan,
  buildGradientProfile,
  buildGradientProfileForRange,
  buildDistanceTicksForRange,
  climbZoomDomain,
  poiZoomDomain,
  clampZoomDomain,
  buildMapGradeLegendGradient,
  colorForGradePct,
  colorForMapGradePct,
  detectClimbs,
  getElevationAxisConfig,
  getProfileAtDistance,
  gradeBandForPct,
  instantGradeAtDistance,
  segmentGrades,
} from "@/lib/gpx/gradient";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";

describe("gradeBandForPct", () => {
  it("classifies flat, moderate and steep grades", () => {
    expect(gradeBandForPct(0)).toBe("flat");
    expect(gradeBandForPct(2.9)).toBe("flat");
    expect(gradeBandForPct(3)).toBe("moderate");
    expect(gradeBandForPct(5.9)).toBe("moderate");
    expect(gradeBandForPct(6)).toBe("steep");
  });
});

describe("instantGradeAtDistance", () => {
  it("measures grade over a distance window", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.001, lng: 6, ele: 106 },
      { lat: 45.002, lng: 6, ele: 112 },
      { lat: 45.003, lng: 6, ele: 118 },
    ]);

    const grade = instantGradeAtDistance(track, track[2].distanceM, 50);
    expect(grade).toBeGreaterThan(3);
  });
});

describe("detectClimbs", () => {
  it("detects a sustained climb above the minimum length", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.001, lng: 6, ele: 110 },
      { lat: 45.002, lng: 6, ele: 120 },
      { lat: 45.003, lng: 6, ele: 130 },
      { lat: 45.004, lng: 6, ele: 140 },
    ]);

    const climbs = detectClimbs(track);

    expect(climbs.length).toBeGreaterThanOrEqual(1);
    expect(climbs[0].gainM).toBeGreaterThanOrEqual(30);
    expect(climbs[0].avgGradePct).toBeGreaterThan(2.5);
  });

  it("detects multiple climbs separated by a descent", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.004, lng: 6, ele: 130 },
      { lat: 45.008, lng: 6, ele: 110 },
      { lat: 45.012, lng: 6, ele: 150 },
    ]);

    const climbs = detectClimbs(track);
    expect(climbs.length).toBeGreaterThanOrEqual(2);
  });

  it("ignores short climbs below the minimum length", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.00005, lng: 6, ele: 110 },
      { lat: 45.0001, lng: 6, ele: 100 },
    ]);

    const climbs = detectClimbs(track);
    expect(climbs).toHaveLength(0);
  });
});

describe("colorForGradePct", () => {
  it("interpolates from flat blue to steep red", () => {
    expect(colorForGradePct(0)).toBe("#93c5fd");
    expect(colorForGradePct(4)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colorForGradePct(10)).toBe("#ef4444");
  });

  it("uses lighter blue for descents", () => {
    expect(colorForGradePct(-5)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colorForGradePct(-5)).not.toBe(colorForGradePct(6));
  });
});

describe("colorForMapGradePct", () => {
  it("uses the saturated map palette", () => {
    expect(colorForMapGradePct(0)).toBe("#06b6d4");
    expect(colorForMapGradePct(10)).toBe("#ef4444");
    expect(colorForMapGradePct(0)).not.toBe(colorForGradePct(0));
  });
});

describe("buildMapGradeLegendGradient", () => {
  it("builds a css linear gradient from map stops", () => {
    expect(buildMapGradeLegendGradient()).toContain("linear-gradient(to right");
    expect(buildMapGradeLegendGradient()).toContain("#06b6d4");
  });
});

describe("buildGradientProfile", () => {
  it("assigns grade per point", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.001, lng: 6, ele: 110 },
      { lat: 45.002, lng: 6, ele: 120 },
    ]);

    const { profile } = buildGradientProfile(track);

    expect(profile).toHaveLength(3);
    expect(profile.every((point) => typeof point.gradePct === "number")).toBe(true);
  });

  it("returns precise tooltip data from the full track", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.002, lng: 6, ele: 130 },
      { lat: 45.004, lng: 6, ele: 160 },
      { lat: 45.006, lng: 6, ele: 190 },
    ]);

    const { climbs } = buildGradientProfile(track);
    const sample = getProfileAtDistance(track, track[2].distanceM / 1000, climbs);

    expect(sample).not.toBeNull();
    expect(sample!.elevation).toBeGreaterThan(120);
    expect(sample!.gradePct).not.toBe(0);
  });
});

describe("buildDistanceTicksForRange", () => {
  it("uses finer ticks when zoomed in", () => {
    const ticks = buildDistanceTicksForRange(10, 12);
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks[0]).toBeLessThanOrEqual(10);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(11.9);
  });

  it("does not emit duplicate tick values", () => {
    const ticks = buildDistanceTicksForRange(0, 97.17412414267346);
    const keys = ticks.map((tick) => Math.round(tick * 1000));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("applyWheelZoom", () => {
  it("zooms in with negative wheel delta", () => {
    const result = applyWheelZoom([0, 20], [0, 90], 10, -120);
    expect(result).not.toBeNull();
    expect(result![1] - result![0]).toBeLessThan(20);
  });

  it("returns null when zoomed out to full extent", () => {
    const result = applyWheelZoom([0, 90], [0, 90], 45, 400);
    expect(result).toBeNull();
  });
});

describe("applyHorizontalPan", () => {
  it("shifts the visible domain and clamps to route bounds", () => {
    const panned = applyHorizontalPan([10, 30], [0, 90], 5);
    expect(panned).toEqual([15, 35]);

    const clamped = applyHorizontalPan([80, 90], [0, 90], 5);
    expect(clamped[1]).toBe(90);
    expect(clamped[1] - clamped[0]).toBe(10);
  });
});

describe("climbZoomDomain", () => {
  it("zooms around a climb with padding and clamps to the route", () => {
    const climb = {
      id: 1,
      startDistanceM: 10_000,
      endDistanceM: 15_000,
      gainM: 200,
      lengthM: 5000,
      avgGradePct: 4,
    };

    expect(climbZoomDomain(climb, [0, 90])).toEqual([9.6, 15.4]);
  });
});

describe("poiZoomDomain", () => {
  it("zooms around a POI with padding and clamps to the route", () => {
    expect(poiZoomDomain(45, [0, 90])).toEqual([44.5, 46.5]);
  });
});

describe("clampZoomDomain", () => {
  it("keeps zoom within the full route bounds", () => {
    const clamped = clampZoomDomain([5, 50], [0, 90]);
    expect(clamped[0]).toBeGreaterThanOrEqual(0);
    expect(clamped[1]).toBeLessThanOrEqual(90);
  });

  it("does not zoom in closer than 2 km", () => {
    const clamped = clampZoomDomain([10, 10.5], [0, 90]);
    expect(clamped[1] - clamped[0]).toBeGreaterThanOrEqual(2);
  });
});

describe("getElevationAxisConfig", () => {
  it("includes sea level when the route crosses zero", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: -5 },
      { lat: 45.001, lng: 6, ele: 10 },
      { lat: 45.002, lng: 6, ele: 30 },
    ]);
    const config = getElevationAxisConfig(track);
    expect(config.showSeaLevel).toBe(true);
    expect(config.yDomain[0]).toBeLessThanOrEqual(0);
    expect(config.areaBaseline).toBe(0);
  });

  it("shows sea level reference for coastal routes near zero", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 3 },
      { lat: 45.001, lng: 6, ele: 12 },
    ]);
    const config = getElevationAxisConfig(track);
    expect(config.showSeaLevel).toBe(true);
    expect(config.yDomain[0]).toBeLessThanOrEqual(0);
  });
});

describe("buildGradientProfileForRange", () => {
  it("returns more detail for a short zoom window", () => {
    const track = buildTrackWithDistances(
      Array.from({ length: 40 }, (_, index) => ({
        lat: 45 + index * 0.001,
        lng: 6,
        ele: 100 + index * 2,
      })),
    );
    const { climbs } = buildGradientProfile(track);
    const profile = buildGradientProfileForRange(track, 0, 2, climbs);
    expect(profile.length).toBeGreaterThan(5);
  });
});

describe("segmentGrades", () => {
  it("computes raw segment grades", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.001, lng: 6, ele: 110 },
    ]);
    expect(segmentGrades(track).length).toBe(1);
  });
});
