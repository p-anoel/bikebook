import { describe, expect, it } from "vitest";
import {
  createPoiAtDistance,
  createPoiFromMapClick,
  createPoiFromOsmCityLimit,
  createPoiFromOsmWater,
  generatePoiId,
  findPoiByOsmId,
  isOsmCityLimitAlreadyAdded,
  isOsmWaterAlreadyAdded,
  snapLatLngToTrack,
} from "@/lib/gpx/poi-manage";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import type { Poi } from "@/types/roadbook";

describe("snapLatLngToTrack", () => {
  const track = buildTrackWithDistances([
    { lat: 48, lng: -2, ele: 100 },
    { lat: 48.01, lng: -2, ele: 120 },
    { lat: 48.02, lng: -2, ele: 140 },
  ]);

  it("projects a nearby click onto the track", () => {
    const snapped = snapLatLngToTrack(track, 48.005, -2.001);
    expect(snapped).not.toBeNull();
    expect(snapped!.distanceM).toBeGreaterThan(0);
    expect(snapped!.distanceM).toBeLessThan(track[track.length - 1].distanceM);
  });
});

describe("createPoiAtDistance", () => {
  it("creates a POI at the requested kilometrage", () => {
    const track = buildTrackWithDistances([
      { lat: 48, lng: -2, ele: 100 },
      { lat: 48.1, lng: -2, ele: 200 },
    ]);

    const poi = createPoiAtDistance(track, 0.5, "Ravito", "Collation", []);
    expect(poi).not.toBeNull();
    expect(poi!.name).toBe("Ravito");
    expect(poi!.description).toBe("Collation");
    expect(poi!.distanceFromStartM).toBeGreaterThan(0);
    expect(poi!.id).toMatch(/^poi-custom-/);
  });
});

describe("createPoiFromMapClick", () => {
  it("snaps map clicks to the track", () => {
    const track = buildTrackWithDistances([
      { lat: 48, lng: -2, ele: 100 },
      { lat: 48.05, lng: -2, ele: 150 },
    ]);

    const poi = createPoiFromMapClick(track, 48.02, -2.01, "Point", undefined, []);
    expect(poi).not.toBeNull();
    expect(poi!.lat).toBeCloseTo(48.02, 1);
  });
});

describe("generatePoiId", () => {
  it("avoids duplicate custom ids", () => {
    const existing: Poi[] = [
      { id: "poi-custom-1", name: "A", lat: 0, lng: 0, distanceFromStartM: 0 },
    ];
    expect(generatePoiId(existing)).toBe("poi-custom-2");
  });
});

describe("createPoiFromOsmWater", () => {
  it("snaps OSM water to the track with osm metadata", () => {
    const track = buildTrackWithDistances([
      { lat: 48, lng: -2, ele: 100 },
      { lat: 48.05, lng: -2, ele: 150 },
    ]);

    const poi = createPoiFromOsmWater(
      track,
      { lat: 48.02, lng: -2.001, name: "Fontaine", osmId: "node/42" },
      "Point d'eau",
      [],
    );

    expect(poi).not.toBeNull();
    expect(poi!.source).toBe("osm");
    expect(poi!.osmId).toBe("node/42");
    expect(poi!.name).toBe("Fontaine");
  });
});

describe("isOsmWaterAlreadyAdded", () => {
  it("detects duplicate osm ids", () => {
    const pois: Poi[] = [
      {
        id: "poi-custom-1",
        name: "Eau",
        lat: 48,
        lng: -2,
        distanceFromStartM: 0,
        source: "osm",
        osmId: "node/1",
      },
    ];
    expect(isOsmWaterAlreadyAdded(pois, "node/1")).toBe(true);
    expect(isOsmWaterAlreadyAdded(pois, "node/2")).toBe(false);
  });
});

describe("findPoiByOsmId", () => {
  it("finds a POI by osm id and source", () => {
    const pois: Poi[] = [
      {
        id: "poi-custom-1",
        name: "Eau",
        lat: 48,
        lng: -2,
        distanceFromStartM: 0,
        source: "osm",
        osmId: "node/1",
      },
      {
        id: "poi-custom-2",
        name: "Rennes",
        lat: 48,
        lng: -2,
        distanceFromStartM: 1000,
        source: "osm-city-limit",
        osmId: "node/2",
      },
    ];

    expect(findPoiByOsmId(pois, "node/1", "osm")?.id).toBe("poi-custom-1");
    expect(findPoiByOsmId(pois, "node/2", "osm-city-limit")?.id).toBe("poi-custom-2");
    expect(findPoiByOsmId(pois, "node/1", "osm-city-limit")).toBeUndefined();
  });
});

describe("createPoiFromOsmCityLimit", () => {
  it("snaps OSM city limit to the track with osm-city-limit metadata", () => {
    const track = buildTrackWithDistances([
      { lat: 48, lng: -2, ele: 100 },
      { lat: 48.05, lng: -2, ele: 150 },
    ]);

    const poi = createPoiFromOsmCityLimit(
      track,
      { lat: 48.02, lng: -2.001, name: "Rennes", osmId: "node/99" },
      "Commune",
      [],
    );

    expect(poi).not.toBeNull();
    expect(poi!.source).toBe("osm-city-limit");
    expect(poi!.osmId).toBe("node/99");
    expect(poi!.name).toBe("Rennes");
  });

  it("places POI on the track, not at the raw OSM node when offset", () => {
    const track = buildTrackWithDistances([
      { lat: 48, lng: -2, ele: 100 },
      { lat: 48.05, lng: -2, ele: 150 },
    ]);

    const poi = createPoiFromOsmCityLimit(
      track,
      { lat: 48.02, lng: -2.05, name: "Rennes", osmId: "node/99" },
      "Commune",
      [],
    );

    expect(poi).not.toBeNull();
    expect(poi!.lng).toBeCloseTo(-2, 2);
    expect(poi!.lat).toBeCloseTo(48.02, 2);
    expect(Math.abs(poi!.lng - -2.05)).toBeGreaterThan(0.01);
  });
});

describe("isOsmCityLimitAlreadyAdded", () => {
  it("detects duplicate city limit osm ids", () => {
    const pois: Poi[] = [
      {
        id: "poi-custom-1",
        name: "Rennes",
        lat: 48,
        lng: -2,
        distanceFromStartM: 0,
        source: "osm-city-limit",
        osmId: "node/1",
      },
    ];
    expect(isOsmCityLimitAlreadyAdded(pois, "node/1")).toBe(true);
    expect(isOsmCityLimitAlreadyAdded(pois, "node/2")).toBe(false);
  });
});
