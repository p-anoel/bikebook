import { describe, expect, it } from "vitest";
import {
  computeRidePlan,
  defaultArrivalFromDeparture,
  ridePlanErrorKey,
} from "@/lib/weather/ride-plan";

describe("computeRidePlan", () => {
  it("derives arrival from average speed and pauses", () => {
    const plan = computeRidePlan({
      mode: "speed",
      distanceKm: 100,
      departureAt: "2026-05-30T08:00:00.000Z",
      avgSpeedKmh: 20,
      pauseMinutes: 60,
    });

    expect(plan.avgSpeedKmh).toBe(20);
    expect(plan.ridingMinutes).toBe(300);
    expect(plan.pauseMinutes).toBe(60);
    expect(new Date(plan.arrivalAt).getTime()).toBe(
      new Date("2026-05-30T14:00:00.000Z").getTime(),
    );
  });

  it("derives average speed from target arrival and pauses", () => {
    const plan = computeRidePlan({
      mode: "arrival",
      distanceKm: 100,
      departureAt: "2026-05-30T08:00:00.000Z",
      arrivalAt: "2026-05-30T14:00:00.000Z",
      pauseMinutes: 60,
    });

    expect(plan.avgSpeedKmh).toBe(20);
    expect(plan.ridingMinutes).toBe(300);
  });

  it("rejects arrival before departure", () => {
    expect(() =>
      computeRidePlan({
        mode: "arrival",
        distanceKm: 50,
        departureAt: "2026-05-30T10:00:00.000Z",
        arrivalAt: "2026-05-30T09:00:00.000Z",
        pauseMinutes: 0,
      }),
    ).toThrow("ARRIVAL_BEFORE_DEPARTURE");
  });
});

describe("defaultArrivalFromDeparture", () => {
  it("adds riding and pause time", () => {
    const arrival = defaultArrivalFromDeparture(
      "2026-05-30T08:00:00.000Z",
      40,
      20,
      30,
    );
    expect(new Date(arrival).getTime()).toBe(new Date("2026-05-30T10:30:00.000Z").getTime());
  });
});

describe("ridePlanErrorKey", () => {
  it("maps known error codes", () => {
    expect(ridePlanErrorKey("ARRIVAL_BEFORE_DEPARTURE")).toBe(
      "planErrors.arrivalBeforeDeparture",
    );
  });
});
