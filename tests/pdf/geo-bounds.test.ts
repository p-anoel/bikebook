import { describe, expect, it } from "vitest";
import type { RoadbookBounds } from "@/types/roadbook";
import {
  expandBounds,
  expandBoundsToAspect,
  pdfMapDisplaySize,
  pointsToPathD,
  latLngToWorldPixel,
} from "@/lib/pdf/geo-bounds";

describe("expandBounds", () => {
  it("adds margin around the track bounds", () => {
    const expanded = expandBounds([
      [45, 6],
      [45.1, 6.1],
    ]);

    expect(expanded.minLat).toBeLessThan(45);
    expect(expanded.maxLat).toBeGreaterThan(45.1);
  });
});

describe("expandBoundsToAspect", () => {
  it("widens square bounds to match a landscape frame", () => {
    const bounds: RoadbookBounds = [
      [45, 6],
      [45.1, 6.1],
    ];
    const expanded = expandBoundsToAspect(bounds, 499, 240, 0.05);
    const nw = latLngToWorldPixel(expanded.maxLat, expanded.minLng, 10);
    const se = latLngToWorldPixel(expanded.minLat, expanded.maxLng, 10);
    const aspect = (se.x - nw.x) / (se.y - nw.y);

    expect(aspect).toBeCloseTo(499 / 240, 1);
    expect(expanded.minLng).toBeLessThan(6);
    expect(expanded.maxLng).toBeGreaterThan(6.1);
  });
});

describe("pdfMapDisplaySize", () => {
  it("uses the full rectangular frame in the PDF layout", () => {
    const bounds = expandBounds([
      [45, 6],
      [45.1, 6.2],
    ]);
    const { width, height } = pdfMapDisplaySize(bounds, 499, 240);

    expect(width).toBe(499);
    expect(height).toBe(240);
  });
});

describe("pointsToPathD", () => {
  it("builds a valid SVG path command", () => {
    expect(pointsToPathD([{ x: 10, y: 20 }, { x: 30, y: 40 }])).toBe(
      "M 10 20 L 30 40",
    );
  });
});
