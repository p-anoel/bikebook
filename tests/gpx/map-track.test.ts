import { describe, expect, it } from "vitest";
import {
  buildColoredTrackSegments,
  densifyTrackForMapDisplay,
  trackPolylinePositions,
} from "@/lib/gpx/map-track";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";

describe("buildColoredTrackSegments", () => {
  it("colors segments by grade using the profile palette", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.001, lng: 6, ele: 130 },
      { lat: 45.002, lng: 6, ele: 130 },
    ]);

    const segments = buildColoredTrackSegments(track);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(segments[0].positions[0]).toEqual([45, 6]);
  });

  it("merges consecutive segments with the same color", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.00002, lng: 6, ele: 100 },
      { lat: 45.00004, lng: 6, ele: 100 },
      { lat: 45.00006, lng: 6, ele: 100 },
    ]);

    const segments = buildColoredTrackSegments(track);
    expect(segments).toHaveLength(1);
    expect(segments[0].positions.length).toBe(4);
  });

  it("smooths spurious steep grades on flat bridge-like hops", () => {
    const track = buildTrackWithDistances([
      { lat: 48.2, lng: -2.4, ele: 42 },
      { lat: 48.2004, lng: -2.4, ele: 42.5 },
      { lat: 48.2008, lng: -2.4, ele: 42.2 },
      { lat: 48.2012, lng: -2.4, ele: 42.6 },
      { lat: 48.2016, lng: -2.4, ele: 42.3 },
      { lat: 48.202, lng: -2.4, ele: 42.4 },
    ]);

    const segments = buildColoredTrackSegments(track);
    const steepRed = "#b91c1c";
    const hotRed = "#ef4444";

    for (const segment of segments) {
      expect([steepRed, hotRed]).not.toContain(segment.color);
    }
  });
});

describe("trackPolylinePositions", () => {
  it("returns lat/lng pairs for dense track outline", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.00002, lng: 6.00002, ele: 110 },
    ]);

    expect(trackPolylinePositions(track)).toEqual([
      [45, 6],
      [45.00002, 6.00002],
    ]);
  });

  it("interpolates sparse route segments for smoother map display", () => {
    const track = buildTrackWithDistances([
      { lat: 48.0, lng: -2.0, ele: 40 },
      { lat: 48.0045, lng: -2.0, ele: 40 },
    ]);

    const positions = trackPolylinePositions(track);

    expect(positions.length).toBeGreaterThan(10);
    expect(positions[0]).toEqual([48, -2]);
    expect(positions.at(-1)).toEqual([48.0045, -2]);
  });
});

describe("densifyTrackForMapDisplay", () => {
  it("leaves already-dense GPS tracks unchanged", () => {
    const track = buildTrackWithDistances([
      { lat: 48.0, lng: -2.0, ele: 40 },
      { lat: 48.00002, lng: -2.0, ele: 40 },
      { lat: 48.00004, lng: -2.0, ele: 40 },
    ]);

    expect(densifyTrackForMapDisplay(track)).toHaveLength(3);
  });

  it("adds points along long sparse segments", () => {
    const track = buildTrackWithDistances([
      { lat: 48.0, lng: -2.0, ele: 40 },
      { lat: 48.0045, lng: -2.0, ele: 40 },
    ]);

    const dense = densifyTrackForMapDisplay(track);

    expect(dense.length).toBeGreaterThan(50);
    expect(dense[0].lat).toBe(48);
    expect(dense.at(-1)?.lat).toBeCloseTo(48.0045, 4);
  });
});

describe("prepareTrackForMap sampling", () => {
  it("keeps full densified track when under the threshold", () => {
    const track = buildTrackWithDistances([
      { lat: 48.0, lng: -2.0, ele: 40 },
      { lat: 48.0045, lng: -2.0, ele: 40 },
    ]);

    const dense = densifyTrackForMapDisplay(track);
    const outline = trackPolylinePositions(track);

    expect(outline.length).toBe(dense.length);
  });
});
