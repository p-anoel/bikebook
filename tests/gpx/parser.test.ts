const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BikeBook Test">
  <metadata>
    <name>Test Ride</name>
  </metadata>
  <trk>
    <name>Alpine Loop</name>
    <trkseg>
      <trkpt lat="45.0000" lon="6.0000"><ele>1000</ele></trkpt>
      <trkpt lat="45.0010" lon="6.0010"><ele>1050</ele></trkpt>
      <trkpt lat="45.0020" lon="6.0020"><ele>1100</ele></trkpt>
      <trkpt lat="45.0030" lon="6.0030"><ele>1080</ele></trkpt>
    </trkseg>
  </trk>
  <wpt lat="45.0010" lon="6.0010">
    <name>Water stop</name>
    <desc>Spring</desc>
    <ele>1050</ele>
  </wpt>
  <wpt lat="45.0030" lon="6.0030">
    <name>Summit</name>
  </wpt>
</gpx>`;

const ROUTE_ONLY_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <rte>
    <name>Route fallback</name>
    <rtept lat="48.8566" lon="2.3522"><ele>35</ele></rtept>
    <rtept lat="48.8576" lon="2.3532"><ele>40</ele></rtept>
    <rtept lat="48.8586" lon="2.3542"><ele>45</ele></rtept>
  </rte>
</gpx>`;

import { describe, expect, it } from "vitest";
import { parseGpxContent, isGpxParseError } from "@/lib/gpx/parser";

describe("parseGpxContent", () => {
  it("parses track points, stats, and waypoints", () => {
    const roadbook = parseGpxContent(SAMPLE_GPX, "ride.gpx");

    expect(roadbook.name).toBe("Alpine Loop");
    expect(roadbook.track).toHaveLength(4);
    expect(roadbook.track[0].distanceM).toBe(0);
    expect(roadbook.track[3].distanceM).toBeGreaterThan(0);
    expect(roadbook.stats.distanceKm).toBeGreaterThan(0);
    expect(roadbook.stats.elevationGainM).toBe(100);
    expect(roadbook.stats.elevationLossM).toBe(20);
    expect(roadbook.stats.minElevationM).toBe(1000);
    expect(roadbook.stats.maxElevationM).toBe(1100);
    expect(roadbook.pois).toHaveLength(2);
    expect(roadbook.pois[0].name).toBe("Water stop");
    expect(roadbook.pois[0].distanceFromStartM).toBeGreaterThanOrEqual(0);
    expect(roadbook.bounds[0][0]).toBeLessThanOrEqual(roadbook.bounds[1][0]);
  });

  it("falls back to route points when no track exists", () => {
    const roadbook = parseGpxContent(ROUTE_ONLY_GPX, "route.gpx");
    expect(roadbook.name).toBe("Route fallback");
    expect(roadbook.track).toHaveLength(3);
  });

  it("throws on invalid XML", () => {
    try {
      parseGpxContent("not xml", "bad.gpx");
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(isGpxParseError(error)).toBe(true);
      if (isGpxParseError(error)) {
        expect(error.code).toBe("INVALID_XML");
      }
    }
  });

  it("throws when no track or route exists", () => {
    const emptyGpx = `<?xml version="1.0"?><gpx version="1.1"></gpx>`;
    try {
      parseGpxContent(emptyGpx, "empty.gpx");
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(isGpxParseError(error)).toBe(true);
      if (isGpxParseError(error)) {
        expect(error.code).toBe("NO_TRACK");
      }
    }
  });

  it("throws when track has only one point", () => {
    const singlePoint = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="1" lon="1"><ele>100</ele></trkpt></trkseg></trk></gpx>`;
    try {
      parseGpxContent(singlePoint, "single.gpx");
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(isGpxParseError(error)).toBe(true);
      if (isGpxParseError(error)) {
        expect(error.code).toBe("EMPTY_TRACK");
      }
    }
  });
});
