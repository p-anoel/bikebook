import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import { OVERPASS_QL_TIMEOUT_S } from "@/lib/osm/overpass-client";
import {
  acceptsWaterPointTags,
  bboxDiagonalM,
  buildOverpassQuery,
  distancePointToTrackM,
  expandBounds,
  fetchOverpassWaterPoints,
  filterWaterPointsNearTrack,
  OVERPASS_ENDPOINTS,
  OVERPASS_USER_AGENT,
  OVERPASS_USER_FACING_HINT,
  queryBoundsChunksFromTrack,
  trackCacheKey,
  waterPointTagPreferenceScore,
} from "@/lib/osm/water-points";

describe("distancePointToTrackM", () => {
  const track = buildTrackWithDistances([
    { lat: 48, lng: -2, ele: 100 },
    { lat: 48.01, lng: -2, ele: 120 },
    { lat: 48.02, lng: -2, ele: 140 },
  ]);

  it("returns 0 for a point on the track", () => {
    expect(distancePointToTrackM(48.01, -2, track)).toBeLessThan(1);
  });

  it("returns a larger distance for a point far from the track", () => {
    const onTrack = distancePointToTrackM(48.01, -2, track);
    const offTrack = distancePointToTrackM(48.01, -1.99, track);
    expect(offTrack).toBeGreaterThan(onTrack);
    expect(offTrack).toBeGreaterThan(500);
  });
});

describe("filterWaterPointsNearTrack", () => {
  const track = buildTrackWithDistances([
    { lat: 48, lng: -2, ele: 100 },
    { lat: 48.02, lng: -2, ele: 140 },
  ]);

  it("keeps only points within the max distance", () => {
    const filtered = filterWaterPointsNearTrack(
      [
        {
          id: "node/1",
          lat: 48.01,
          lng: -2,
          tags: { amenity: "drinking_water", drinking_water: "yes" },
        },
        {
          id: "node/2",
          lat: 48.01,
          lng: -1.98,
          tags: { amenity: "drinking_water", drinking_water: "yes" },
        },
      ],
      track,
      200,
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("node/1");
    expect(filtered[0].distanceToTrackM).toBeLessThanOrEqual(200);
  });

  it("sorts by distance to track", () => {
    const filtered = filterWaterPointsNearTrack(
      [
        {
          id: "node/2",
          lat: 48.015,
          lng: -2.001,
          tags: { amenity: "drinking_water", drinking_water: "yes" },
        },
        {
          id: "node/1",
          lat: 48.005,
          lng: -2.0005,
          tags: { amenity: "drinking_water", drinking_water: "yes" },
        },
      ],
      track,
      500,
    );

    expect(filtered[0].distanceToTrackM).toBeLessThanOrEqual(filtered[1].distanceToTrackM);
  });

  it("prefers ideal tags when distance is equal", () => {
    const filtered = filterWaterPointsNearTrack(
      [
        {
          id: "node/basic",
          lat: 48.01,
          lng: -2,
          tags: { amenity: "drinking_water" },
        },
        {
          id: "node/ideal",
          lat: 48.01,
          lng: -2,
          tags: {
            amenity: "drinking_water",
            drinking_water: "yes",
            bottle: "yes",
            access: "yes",
          },
        },
      ],
      track,
      200,
    );

    expect(filtered[0].id).toBe("node/ideal");
  });
});

describe("expandBounds", () => {
  it("expands the bounding box", () => {
    const bounds: [[number, number], [number, number]] = [
      [48, -2],
      [48.02, -1.98],
    ];
    const expanded = expandBounds(bounds, 200);
    expect(expanded[0][0]).toBeLessThan(bounds[0][0]);
    expect(expanded[1][0]).toBeGreaterThan(bounds[1][0]);
  });
});

describe("trackCacheKey", () => {
  it("is stable for the same track", () => {
    const track = buildTrackWithDistances([
      { lat: 48, lng: -2, ele: 100 },
      { lat: 48.01, lng: -2, ele: 110 },
    ]);
    expect(trackCacheKey(track)).toBe(trackCacheKey(track));
  });
});

describe("buildOverpassQuery", () => {
  it("queries amenity=drinking_water nodes with ideal tag clauses and 90s timeout", () => {
    const query = buildOverpassQuery([
      [48, -2],
      [48.02, -1.98],
    ]);
    expect(query).toContain("[out:json]");
    expect(query).toContain(`[timeout:${OVERPASS_QL_TIMEOUT_S}]`);
    expect(query).toContain(
      'node["amenity"="drinking_water"]["drinking_water"="yes"](48,-2,48.02,-1.98)',
    );
    expect(query).toContain(
      'node["amenity"="drinking_water"]["bottle"="yes"](48,-2,48.02,-1.98)',
    );
    expect(query).toContain(
      'node["amenity"="drinking_water"]["access"="yes"](48,-2,48.02,-1.98)',
    );
    expect(query).toContain(
      'node["amenity"="drinking_water"]["drinking_water"!~"."](48,-2,48.02,-1.98)',
    );
    expect(query).toContain("out;");
    expect(query).not.toContain("way[");
    expect(query).not.toContain('node["natural"="spring"]');
    expect(query).not.toContain('node["man_made"="water_well"]');
  });
});

describe("acceptsWaterPointTags", () => {
  it("accepts amenity=drinking_water with ideal tags", () => {
    expect(
      acceptsWaterPointTags({
        amenity: "drinking_water",
        drinking_water: "yes",
        bottle: "yes",
        access: "yes",
      }),
    ).toBe(true);
  });

  it("accepts legacy nodes without drinking_water subtag", () => {
    expect(acceptsWaterPointTags({ amenity: "drinking_water" })).toBe(true);
  });

  it("accepts known drinking_water subtypes", () => {
    expect(
      acceptsWaterPointTags({ amenity: "drinking_water", drinking_water: "fountain" }),
    ).toBe(true);
  });

  it("rejects non-drinking_water amenities", () => {
    expect(acceptsWaterPointTags({ natural: "spring" })).toBe(false);
    expect(acceptsWaterPointTags({ man_made: "water_well" })).toBe(false);
  });

  it("rejects contradictory tags when present", () => {
    expect(
      acceptsWaterPointTags({ amenity: "drinking_water", drinking_water: "no" }),
    ).toBe(false);
    expect(acceptsWaterPointTags({ amenity: "drinking_water", access: "private" })).toBe(false);
    expect(acceptsWaterPointTags({ amenity: "drinking_water", bottle: "no" })).toBe(false);
    expect(acceptsWaterPointTags({ amenity: "drinking_water", drinkable: "no" })).toBe(false);
  });
});

describe("waterPointTagPreferenceScore", () => {
  it("scores ideal tags higher than legacy nodes", () => {
    const ideal = waterPointTagPreferenceScore({
      amenity: "drinking_water",
      drinking_water: "yes",
      bottle: "yes",
      access: "yes",
    });
    const legacy = waterPointTagPreferenceScore({ amenity: "drinking_water" });
    expect(ideal).toBeGreaterThan(legacy);
  });
});

describe("queryBoundsChunksFromTrack", () => {
  it("returns a single bbox for short tracks", () => {
    const track = buildTrackWithDistances([
      { lat: 48, lng: -2, ele: 100 },
      { lat: 48.01, lng: -2, ele: 110 },
    ]);
    const chunks = queryBoundsChunksFromTrack(track, 200, 50_000);
    expect(chunks).toHaveLength(1);
  });

  it("splits into multiple bboxes for very long tracks", () => {
    const points = Array.from({ length: 500 }, (_, index) => ({
      lat: 48 + index * 0.05,
      lng: -2,
      ele: 100,
    }));
    const track = buildTrackWithDistances(points);
    const full = expandBounds(
      [
        [48, -2],
        [48 + 499 * 0.05, -2],
      ],
      200,
    );
    expect(bboxDiagonalM(full)).toBeGreaterThan(50_000);

    const chunks = queryBoundsChunksFromTrack(track, 200, 50_000);
    const fullDiagonal = bboxDiagonalM(full);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(bboxDiagonalM(chunk)).toBeLessThan(fullDiagonal);
      expect(bboxDiagonalM(chunk)).toBeLessThanOrEqual(50_500);
    }
  });
});

describe("fetchOverpassWaterPoints", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends User-Agent and form-encoded data to the interpreter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchOverpassWaterPoints([
      [48.85, 2.35],
      [48.86, 2.36],
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      OVERPASS_ENDPOINTS[0],
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "User-Agent": OVERPASS_USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        }),
      }),
    );

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = init.body as string;
    expect(body).toContain("data=");
    expect(decodeURIComponent(body)).toContain(
      'node["amenity"="drinking_water"]["drinking_water"="yes"]',
    );
  });

  it("falls back to the second endpoint after HTTP 406", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Not Acceptable", { status: 406 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [{ type: "node", id: 1, lat: 1, lon: 2 }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const elements = await fetchOverpassWaterPoints([
      [48.85, 2.35],
      [48.86, 2.36],
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(OVERPASS_ENDPOINTS[1]);
    expect(elements).toHaveLength(1);
  });

  it("surfaces a user-facing retry message when all endpoints fail", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("Busy", { status: 504 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const promise = fetchOverpassWaterPoints([
      [48.85, 2.35],
      [48.86, 2.36],
    ]);
    const rejection = expect(promise).rejects.toThrow(OVERPASS_USER_FACING_HINT);
    await vi.advanceTimersByTimeAsync(60_000);
    await rejection;
    vi.useRealTimers();
  });
});
