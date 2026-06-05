import { describe, expect, it } from "vitest";
import {
  formatWindDirection,
  getWindDirectionParts,
  windDirectionToCompass8,
} from "@/lib/weather/wind-direction";

describe("windDirectionToCompass8", () => {
  it("maps north to N", () => {
    expect(windDirectionToCompass8(0)).toBe("N");
    expect(windDirectionToCompass8(360)).toBe("N");
  });

  it("maps northeast to NE", () => {
    expect(windDirectionToCompass8(45)).toBe("NE");
  });

  it("maps south to S", () => {
    expect(windDirectionToCompass8(180)).toBe("S");
  });

  it("maps northwest to NW", () => {
    expect(windDirectionToCompass8(315)).toBe("NW");
  });
});

describe("getWindDirectionParts", () => {
  it("normalizes negative and overflow degrees", () => {
    expect(getWindDirectionParts(-10).deg).toBe(350);
    expect(getWindDirectionParts(400).deg).toBe(40);
  });
});

describe("formatWindDirection", () => {
  it("combines compass label and degrees", () => {
    const label = formatWindDirection(
      225,
      (key) => ({ "compass.SW": "Sud-Ouest" })[key] ?? key,
      ({ direction, deg }) => `${direction} (${deg}°)`,
    );
    expect(label).toBe("Sud-Ouest (225°)");
  });
});
