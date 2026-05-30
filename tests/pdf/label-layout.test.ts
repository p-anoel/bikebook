import { describe, expect, it } from "vitest";
import {
  assertLabelsValid,
  layoutLabels,
  leaderAttachPoint,
  leftForAnchor,
  measureLabelBox,
  verticalLeaderAttach,
} from "@/lib/pdf/label-layout";

function overlaps(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
): boolean {
  return !(
    a.left + a.width <= b.left ||
    b.left + b.width <= a.left ||
    a.top + a.height <= b.top ||
    b.top + b.height <= a.top
  );
}

describe("measureLabelBox", () => {
  it("sizes two-line labels compactly", () => {
    const size = measureLabelBox({
      title: "eau",
      subtitle: "58,4 km · 8 m",
    });

    expect(size.width).toBeGreaterThan(40);
    expect(size.height).toBeLessThan(30);
  });

  it("uses a smaller max width in compact mode", () => {
    const normal = measureLabelBox({
      title: "Relais Allaire",
      subtitle: "82,6 km · 64 m",
    });
    const compact = measureLabelBox(
      {
        title: "Relais Allaire",
        subtitle: "82,6 km · 64 m",
      },
      true,
    );

    expect(compact.width).toBeLessThanOrEqual(normal.width);
  });
});

describe("leftForAnchor", () => {
  it("keeps labels inside bounds near the left edge", () => {
    const bounds = { minX: 14, minY: 14, maxX: 486, maxY: 226 };
    const left = leftForAnchor(22, 80, bounds);

    expect(left).not.toBeNull();
    expect(left!).toBeGreaterThanOrEqual(bounds.minX);
    expect(left! + 80).toBeLessThanOrEqual(bounds.maxX);
  });
});

describe("layoutLabels", () => {
  it("avoids overlapping labels for nearby anchors", () => {
    const bounds = { minX: 18, minY: 18, maxX: 482, maxY: 222 };
    const placed = layoutLabels(
      [
        {
          id: "a",
          anchorX: 80,
          anchorY: 120,
          sortKey: 1,
          content: { title: "Refuge", subtitle: "12,0 km · 800 m" },
        },
        {
          id: "b",
          anchorX: 95,
          anchorY: 118,
          sortKey: 2,
          content: { title: "Eau", subtitle: "12,5 km · 780 m" },
        },
        {
          id: "c",
          anchorX: 210,
          anchorY: 90,
          sortKey: 3,
          content: { title: "Col", subtitle: "24,0 km · 1200 m" },
        },
      ],
      bounds,
      { compact: true },
    );

    expect(placed).toHaveLength(3);
    expect(assertLabelsValid(placed, bounds)).toBe(true);
  });

  it("separates crowded finish labels like Arrivée and Redon", () => {
    const bounds = { minX: 18, minY: 18, maxX: 482, maxY: 222 };
    const placed = layoutLabels(
      [
        {
          id: "redon",
          anchorX: 72,
          anchorY: 52,
          sortKey: 75.5,
          content: { title: "Redon", subtitle: "75,5 km · 6 m" },
        },
        {
          id: "relais",
          anchorX: 58,
          anchorY: 44,
          sortKey: 82.6,
          content: { title: "Relais Allaire", subtitle: "82,6 km · 64 m" },
        },
        {
          id: "finish",
          anchorX: 40,
          anchorY: 38,
          sortKey: 89.6,
          markerKind: "finish",
          content: { title: "Arrivée", subtitle: "89,6 km · 77 m" },
        },
      ],
      bounds,
      { compact: true },
    );

    expect(placed).toHaveLength(3);
    expect(assertLabelsValid(placed, bounds)).toBe(true);
  });

  it("keeps labels off the track when avoid points are provided", () => {
    const bounds = { minX: 14, minY: 14, maxX: 200, maxY: 120 };
    const track = Array.from({ length: 20 }, (_, index) => ({ x: index * 10, y: 60 }));

    const placed = layoutLabels(
      [
        {
          id: "poi",
          anchorX: 100,
          anchorY: 60,
          content: { title: "Test", subtitle: "10,0 km · 100 m" },
        },
      ],
      bounds,
      { avoidPoints: track },
    );

    expect(placed[0].top + placed[0].height).toBeLessThan(54);
  });
});

describe("verticalLeaderAttach", () => {
  it("uses a vertical connector on the bottom edge when above", () => {
    const attach = verticalLeaderAttach({
      left: 40,
      top: 20,
      width: 60,
      height: 22,
      anchorX: 70,
      side: "above",
    });

    expect(attach.leaderY).toBe(42);
    expect(attach.leaderX).toBe(70);
  });

  it("matches legacy leaderAttachPoint helper", () => {
    const attach = leaderAttachPoint({
      left: 40,
      top: 20,
      width: 60,
      height: 22,
      anchorX: 70,
      anchorY: 60,
      side: "above",
    });

    expect(attach.x).toBe(70);
    expect(attach.y).toBe(42);
  });
});
