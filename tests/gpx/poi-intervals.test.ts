import { describe, expect, it } from "vitest";
import { withPoiIntervals, withPoiStats } from "@/lib/gpx/poi-intervals";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import type { Poi } from "@/types/roadbook";

describe("withPoiIntervals", () => {
  const pois: Poi[] = [
    { id: "a", name: "A", lat: 0, lng: 0, distanceFromStartM: 5000 },
    { id: "b", name: "B", lat: 0, lng: 0, distanceFromStartM: 1000 },
    { id: "c", name: "C", lat: 0, lng: 0, distanceFromStartM: 8000 },
  ];

  it("sorts POIs and computes interval from previous POI", () => {
    const rows = withPoiIntervals(pois);

    expect(rows.map((row) => row.name)).toEqual(["B", "A", "C"]);
    expect(rows.map((row) => row.number)).toEqual([1, 2, 3]);
    expect(rows[0].intervalFromPrevM).toBeNull();
    expect(rows[1].intervalFromPrevM).toBe(4000);
    expect(rows[2].intervalFromPrevM).toBe(3000);
  });
});

describe("withPoiStats", () => {
  it("computes cumulative and interval elevation gain", () => {
    const track = buildTrackWithDistances([
      { lat: 0, lng: 0, ele: 100 },
      { lat: 0, lng: 0.001, ele: 150 },
      { lat: 0, lng: 0.002, ele: 120 },
      { lat: 0, lng: 0.003, ele: 180 },
    ]);

    const pois: Poi[] = [
      { id: "start-poi", name: "Start", lat: 0, lng: 0, distanceFromStartM: 0 },
      {
        id: "mid",
        name: "Mid",
        lat: 0,
        lng: 0,
        distanceFromStartM: track[1].distanceM,
      },
      {
        id: "end",
        name: "End",
        lat: 0,
        lng: 0,
        distanceFromStartM: track[track.length - 1].distanceM,
      },
    ];

    const rows = withPoiStats(track, pois);

    expect(rows[0].cumulativeElevationGainM).toBe(0);
    expect(rows[0].intervalElevationGainM).toBeNull();
    expect(rows[1].cumulativeElevationGainM).toBe(50);
    expect(rows[1].intervalElevationGainM).toBe(50);
    expect(rows[2].cumulativeElevationGainM).toBe(110);
    expect(rows[2].intervalElevationGainM).toBe(60);
  });
});
