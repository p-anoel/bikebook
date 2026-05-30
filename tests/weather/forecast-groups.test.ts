import { describe, expect, it } from "vitest";
import { groupForecastPlans } from "@/lib/weather/forecast-groups";

describe("groupForecastPlans", () => {
  it("merges nearby segments into one location bucket", () => {
    const groups = groupForecastPlans([
      {
        geometry: {
          id: 1,
          startDistanceM: 0,
          endDistanceM: 8000,
          centerLat: 48.123,
          centerLng: 2.456,
          bearingDeg: 90,
        },
        arrivalIso: "2026-05-30T08:00:00.000Z",
      },
      {
        geometry: {
          id: 2,
          startDistanceM: 8000,
          endDistanceM: 16000,
          centerLat: 48.127,
          centerLng: 2.461,
          bearingDeg: 90,
        },
        arrivalIso: "2026-05-30T09:00:00.000Z",
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].plans).toHaveLength(2);
    expect(groups[0].lat).toBe(48.1);
    expect(groups[0].lng).toBe(2.5);
  });

  it("keeps distant segments in separate groups", () => {
    const groups = groupForecastPlans([
      {
        geometry: {
          id: 1,
          startDistanceM: 0,
          endDistanceM: 8000,
          centerLat: 48.1,
          centerLng: 2.3,
          bearingDeg: 0,
        },
        arrivalIso: "2026-05-30T08:00:00.000Z",
      },
      {
        geometry: {
          id: 2,
          startDistanceM: 8000,
          endDistanceM: 16000,
          centerLat: 49.2,
          centerLng: 3.4,
          bearingDeg: 0,
        },
        arrivalIso: "2026-05-30T10:00:00.000Z",
      },
    ]);

    expect(groups).toHaveLength(2);
  });
});
