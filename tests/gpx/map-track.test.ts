import { describe, expect, it } from "vitest";
import { buildColoredTrackSegments, trackPolylinePositions } from "@/lib/gpx/map-track";
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
      { lat: 45.001, lng: 6, ele: 100 },
      { lat: 45.002, lng: 6, ele: 100 },
      { lat: 45.003, lng: 6, ele: 100 },
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
  it("returns lat/lng pairs for the track outline", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.001, lng: 6.001, ele: 110 },
    ]);

    expect(trackPolylinePositions(track)).toEqual([
      [45, 6],
      [45.001, 6.001],
    ]);
  });
});
