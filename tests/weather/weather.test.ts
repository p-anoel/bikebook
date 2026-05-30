import { describe, expect, it } from "vitest";
import { bearingDeg, shortestAngleDiff } from "@/lib/weather/bearing";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import { buildRouteWeatherSegments, estimatedArrivalAtDistance } from "@/lib/weather/segments";
import {
  classifyWindRelative,
  windComponentKmh,
  dominantWindRelative,
} from "@/lib/weather/wind-relative";
import { buildRouteWeatherSummary } from "@/lib/weather/summary";

describe("bearingDeg", () => {
  it("returns north for due north travel", () => {
    expect(Math.round(bearingDeg(45, 6, 46, 6))).toBe(0);
  });
});

describe("classifyWindRelative", () => {
  it("detects headwind when riding into the wind", () => {
    expect(classifyWindRelative(0, 0)).toBe("headwind");
  });

  it("detects tailwind when wind comes from behind", () => {
    expect(classifyWindRelative(0, 180)).toBe("tailwind");
  });

  it("detects crosswind for perpendicular wind", () => {
    expect(classifyWindRelative(0, 90)).toBe("crosswind");
  });
});

describe("windComponentKmh", () => {
  it("returns negative component for headwind", () => {
    expect(windComponentKmh(0, 0, 20)).toBeLessThan(0);
  });

  it("returns positive component for tailwind", () => {
    expect(windComponentKmh(0, 180, 20)).toBeGreaterThan(0);
  });
});

describe("buildRouteWeatherSegments", () => {
  it("splits a long track into multiple segments", () => {
    const track = buildTrackWithDistances(
      Array.from({ length: 80 }, (_, index) => ({
        lat: 48 + index * 0.001,
        lng: 2,
        ele: 100,
      })),
    );

    const segments = buildRouteWeatherSegments(track, 8);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0].id).toBe(1);
    expect(segments[0].bearingDeg).toBeGreaterThanOrEqual(0);
    expect(segments[0].bearingDeg).toBeLessThan(360);
  });
});

describe("buildRouteWeatherSummary", () => {
  it("aggregates segment stats", () => {
    const summary = buildRouteWeatherSummary([
      {
        id: 1,
        startDistanceM: 0,
        endDistanceM: 8000,
        centerLat: 48,
        centerLng: 2,
        bearingDeg: 0,
        passageAt: "2026-05-30T08:00",
        windSpeedKmh: 10,
        windDirectionDeg: 0,
        windRelative: "headwind",
        windComponentKmh: -10,
        temperatureC: 12,
        precipitationMm: 0,
        weatherCode: 0,
        forecastTime: "2026-05-30T08:00",
      },
      {
        id: 2,
        startDistanceM: 8000,
        endDistanceM: 16000,
        centerLat: 48.05,
        centerLng: 2,
        bearingDeg: 90,
        passageAt: "2026-05-30T09:00",
        windSpeedKmh: 20,
        windDirectionDeg: 180,
        windRelative: "tailwind",
        windComponentKmh: 15,
        temperatureC: 18,
        precipitationMm: 1.2,
        weatherCode: 61,
        forecastTime: "2026-05-30T09:00",
      },
    ]);

    expect(summary.avgWindSpeedKmh).toBe(15);
    expect(summary.minTempC).toBe(12);
    expect(summary.maxTempC).toBe(18);
    expect(summary.totalPrecipitationMm).toBe(1.2);
    expect(dominantWindRelative(["headwind", "tailwind"])).toBe("headwind");
  });
});

describe("estimatedArrivalAtDistance", () => {
  it("offsets departure by travel time", () => {
    const arrival = estimatedArrivalAtDistance("2026-05-30T08:00:00.000Z", 20_000, 20);
    expect(new Date(arrival).getTime()).toBeGreaterThan(
      new Date("2026-05-30T08:00:00.000Z").getTime(),
    );
  });
});

describe("shortestAngleDiff", () => {
  it("wraps angles across 360", () => {
    expect(shortestAngleDiff(350, 10)).toBe(20);
  });
});
