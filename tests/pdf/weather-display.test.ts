import { describe, expect, it } from "vitest";
import {
  buildPdfWeatherRows,
  formatPdfPassageTime,
  formatPdfDateTime,
  hasWeatherContent,
  segmentSkyLabel,
} from "@/lib/pdf/weather-display";
import type { RouteWeatherSnapshot } from "@/lib/weather/types";

const labels = {
  kmUnit: "km",
  windSpeed: (speed: number) => `${speed} km/h`,
  windComponent: (value: number) => `${value} km/h`,
  temperature: (value: number) => `${value} °C`,
  precipitation: (value: number) => `${value} mm`,
  windRelative: {
    headwind: "Face",
    tailwind: "Arrière",
    crosswind: "Travers",
  },
  weatherCode: {
    clear: "Ciel dégagé",
    unknown: "Inconnu",
  },
};

describe("formatPdfDateTime", () => {
  it("formats a valid ISO date", () => {
    const result = formatPdfDateTime("2026-06-03T08:00:00.000Z", "fr-FR");
    expect(result).not.toBe("—");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns dash for invalid date", () => {
    expect(formatPdfDateTime("invalid", "fr-FR")).toBe("—");
  });
});

describe("formatPdfPassageTime", () => {
  it("formats hour and minute", () => {
    const result = formatPdfPassageTime("2026-06-03T14:30:00.000Z", "fr-FR");
    expect(result).toMatch(/\d/);
  });
});

describe("segmentSkyLabel", () => {
  it("includes emoji and label for clear sky", () => {
    const label = segmentSkyLabel(0, labels.weatherCode);
    expect(label).toContain("☀️");
    expect(label).toContain("Ciel dégagé");
  });
});

describe("buildPdfWeatherRows", () => {
  it("maps segment fields", () => {
    const rows = buildPdfWeatherRows(
      [
        {
          id: 1,
          startDistanceM: 5000,
          endDistanceM: 10000,
          centerLat: 48,
          centerLng: 2,
          bearingDeg: 90,
          passageAt: "2026-06-03T10:00:00.000Z",
          windSpeedKmh: 12,
          windDirectionDeg: 180,
          windRelative: "tailwind",
          windComponentKmh: 8,
          temperatureC: 18,
          precipitationMm: 0,
          weatherCode: 0,
          forecastTime: "2026-06-03T09:00:00.000Z",
        },
      ],
      "fr-FR",
      labels,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
    expect(rows[0].windRelative).toBe("Arrière");
    expect(rows[0].precipitation).toBe("—");
    expect(rows[0].km).toContain("km");
  });
});

describe("hasWeatherContent", () => {
  it("is false when snapshot is null", () => {
    expect(hasWeatherContent(null)).toBe(false);
  });

  it("is true when segments exist", () => {
    const snapshot = {
      departureAt: "2026-06-03T08:00:00.000Z",
      segments: [{ id: 1 } as RouteWeatherSnapshot["segments"][0]],
      summary: {} as RouteWeatherSnapshot["summary"],
      ridePlan: {} as RouteWeatherSnapshot["ridePlan"],
    };
    expect(hasWeatherContent(snapshot)).toBe(true);
  });
});
