import { describe, expect, it } from "vitest";
import { XMLParser } from "fast-xml-parser";
import {
  buildGpxDocument,
  escapeXml,
  sanitizeGpxFilename,
  type GpxExportRoadbook,
} from "@/lib/gpx/export";

const SAMPLE_ROADBOOK: GpxExportRoadbook = {
  name: "Alpine Loop",
  track: [
    { lat: 45, lng: 6, ele: 1000, distanceM: 0 },
    { lat: 45.001, lng: 6.001, ele: 1050, distanceM: 150 },
    { lat: 45.002, lng: 6.002, ele: 1100, distanceM: 300 },
  ],
  pois: [
    {
      id: "b",
      name: "Summit",
      lat: 45.002,
      lng: 6.002,
      ele: 1100,
      distanceFromStartM: 300,
    },
    {
      id: "a",
      name: "Water & <stop>",
      description: 'Spring "cold"',
      lat: 45.001,
      lng: 6.001,
      ele: 1050,
      distanceFromStartM: 150,
    },
  ],
};

function parseExportedGpx(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });
  return parser.parse(xml) as { gpx: Record<string, unknown> };
}

describe("escapeXml", () => {
  it("escapes reserved XML characters", () => {
    expect(escapeXml(`Tom & Jerry <3> "ok" 'yes'`)).toBe(
      "Tom &amp; Jerry &lt;3&gt; &quot;ok&quot; &apos;yes&apos;",
    );
  });
});

describe("sanitizeGpxFilename", () => {
  it("sanitizes unsafe characters and adds .gpx extension", () => {
    expect(sanitizeGpxFilename("Alpine Loop / 2026")).toBe("Alpine_Loop_2026.gpx");
  });

  it("falls back when name is empty after sanitization", () => {
    expect(sanitizeGpxFilename("///")).toBe("roadbook.gpx");
  });
});

describe("buildGpxDocument", () => {
  it("produces valid GPX 1.1 structure with track and waypoints", () => {
    const xml = buildGpxDocument(SAMPLE_ROADBOOK);
    const { gpx } = parseExportedGpx(xml);

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(gpx["@_version"]).toBe("1.1");
    expect(gpx["@_creator"]).toBe("BikeBook");

    const metadata = gpx.metadata as { name: string };
    expect(metadata.name).toBe("Alpine Loop");

    const track = gpx.trk as {
      name: string;
      trkseg: { trkpt: Array<{ "@_lat": string; "@_lon": string; ele: number }> };
    };
    expect(track.name).toBe("Alpine Loop");
    expect(track.trkseg.trkpt).toHaveLength(3);
    expect(track.trkseg.trkpt[0]["@_lat"]).toBe("45.000000");
    expect(track.trkseg.trkpt[0].ele).toBe(1000);

    const waypoints = Array.isArray(gpx.wpt) ? gpx.wpt : [gpx.wpt];
    expect(waypoints).toHaveLength(2);
    expect(waypoints[0].name).toBe("Water & <stop>");
    expect(waypoints[0].desc).toBe('Spring "cold"');
    expect(waypoints[1].name).toBe("Summit");
  });

  it("escapes XML in names and descriptions", () => {
    const xml = buildGpxDocument(SAMPLE_ROADBOOK);
    expect(xml).toContain("<name>Water &amp; &lt;stop&gt;</name>");
    expect(xml).toContain("<desc>Spring &quot;cold&quot;</desc>");
  });

  it("sorts waypoints by distanceFromStartM", () => {
    const xml = buildGpxDocument(SAMPLE_ROADBOOK);
    const waterIndex = xml.indexOf("Water &amp;");
    const summitIndex = xml.indexOf("<name>Summit</name>");
    expect(waterIndex).toBeGreaterThan(-1);
    expect(summitIndex).toBeGreaterThan(waterIndex);
  });

  it("omits desc when description is missing", () => {
    const xml = buildGpxDocument({
      name: "Ride",
      track: SAMPLE_ROADBOOK.track,
      pois: [
        {
          id: "1",
          name: "Camp",
          lat: 45,
          lng: 6,
          distanceFromStartM: 0,
        },
      ],
    });
    expect(xml).not.toContain("<desc>");
  });
});
