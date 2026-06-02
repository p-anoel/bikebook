import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import {
  buildCityLimitOverpassQuery,
  CITY_LIMIT_ON_TRACK_MAX_M,
  CITY_LIMIT_PAIR_LOOKAHEAD_M,
  fetchOverpassCityLimitSigns,
  filterCityLimitSignsNearTrack,
  filterEntryCityLimitSigns,
  osmExplicitCityLimitRole,
  parseCityLimitOverpassElements,
  parseCityLimitSignName,
  type OsmCityLimitSign,
} from "@/lib/osm/city-limit-signs";
import { OVERPASS_QL_TIMEOUT_S } from "@/lib/osm/overpass-client";
import { OVERPASS_ENDPOINTS, OVERPASS_USER_AGENT } from "@/lib/osm/water-points";

describe("parseCityLimitSignName", () => {
  it("prefers name tag", () => {
    expect(parseCityLimitSignName({ name: "Rennes" })).toBe("Rennes");
  });

  it("falls back to traffic_sign:city_limit subtag", () => {
    expect(parseCityLimitSignName({ "traffic_sign:city_limit": "Vitré" })).toBe("Vitré");
  });

  it("falls back to ref", () => {
    expect(parseCityLimitSignName({ ref: "B123" })).toBe("B123");
  });

  it("returns undefined when no name tags", () => {
    expect(parseCityLimitSignName({ traffic_sign: "city_limit" })).toBeUndefined();
  });
});

describe("parseCityLimitOverpassElements", () => {
  it("parses city limit nodes and deduplicates", () => {
    const parsed = parseCityLimitOverpassElements([
      {
        type: "node",
        id: 1,
        lat: 48.1,
        lon: -1.7,
        tags: { traffic_sign: "city_limit", name: "Rennes" },
      },
      {
        type: "node",
        id: 1,
        lat: 48.1,
        lon: -1.7,
        tags: { traffic_sign: "city_limit", name: "Rennes" },
      },
      {
        type: "node",
        id: 2,
        lat: 48.2,
        lon: -1.8,
        tags: { traffic_sign: "city_limit", city_limit: "begin" },
      },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      id: "node/1",
      name: "Rennes",
      lat: 48.1,
      lng: -1.7,
    });
    expect(parsed[1].name).toBeUndefined();
  });

  it("ignores elements without coordinates", () => {
    expect(parseCityLimitOverpassElements([{ type: "node", id: 3 }])).toHaveLength(0);
  });
});

describe("filterCityLimitSignsNearTrack", () => {
  const track = buildTrackWithDistances([
    { lat: 48, lng: -2, ele: 100 },
    { lat: 48.02, lng: -2, ele: 140 },
  ]);

  it("keeps only signs on the track by default", () => {
    const filtered = filterCityLimitSignsNearTrack(
      [
        { id: "node/1", lat: 48.01, lng: -2, tags: {} },
        { id: "node/2", lat: 48.01, lng: -1.98, tags: {} },
      ],
      track,
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("node/1");
    expect(filtered[0].distanceToTrackM).toBeLessThanOrEqual(CITY_LIMIT_ON_TRACK_MAX_M);
  });

  it("excludes signs farther than the on-track threshold", () => {
    const filtered = filterCityLimitSignsNearTrack(
      [{ id: "node/2", lat: 48.01, lng: -1.98, tags: {} }],
      track,
    );

    expect(filtered).toHaveLength(0);
  });
});

describe("buildCityLimitOverpassQuery", () => {
  it("queries traffic_sign=city_limit nodes in bbox with 90s timeout", () => {
    const query = buildCityLimitOverpassQuery([
      [48, -2],
      [48.02, -1.98],
    ]);
    expect(query).toContain(`[timeout:${OVERPASS_QL_TIMEOUT_S}]`);
    expect(query).toContain('node["traffic_sign"="city_limit"](48,-2,48.02,-1.98)');
    expect(query).toContain("out;");
  });
});

const entryFilterTrack = buildTrackWithDistances([
  { lat: 48, lng: -2, ele: 0 },
  { lat: 48.04, lng: -2, ele: 0 },
]);

function signOnTrackAtKm(
  id: string,
  km: number,
  name: string,
  tags: Record<string, string> = {},
): OsmCityLimitSign {
  const totalM = entryFilterTrack[entryFilterTrack.length - 1].distanceM;
  const ratio = Math.min(1, Math.max(0, (km * 1000) / totalM));
  const lat =
    entryFilterTrack[0].lat + (entryFilterTrack[1].lat - entryFilterTrack[0].lat) * ratio;

  return {
    id,
    lat,
    lng: -2,
    name,
    tags,
    distanceToTrackM: 0,
  };
}

describe("osmExplicitCityLimitRole", () => {
  it("maps city_limit begin/end only", () => {
    expect(osmExplicitCityLimitRole({ city_limit: "begin" })).toBe("entry");
    expect(osmExplicitCityLimitRole({ city_limit: "end" })).toBe("exit");
    expect(osmExplicitCityLimitRole({ direction: "forward" })).toBeNull();
  });
});

describe("filterEntryCityLimitSigns", () => {
  it("keeps entry signs when leaving a commune at route start", () => {
    const signs = [
      signOnTrackAtKm("node/1", 0, "A"),
      signOnTrackAtKm("node/2", 10, "B"),
      signOnTrackAtKm("node/3", 20, "B"),
      signOnTrackAtKm("node/4", 30, "C"),
    ];

    const entries = filterEntryCityLimitSigns(entryFilterTrack, signs, {
      initialCommune: "A",
    });

    expect(entries.map((sign) => sign.name)).toEqual(["B", "C"]);
  });

  it("keeps first commune entry then later entries along the route", () => {
    const signs = [
      signOnTrackAtKm("node/1", 0, "A"),
      signOnTrackAtKm("node/2", 10, "B"),
      signOnTrackAtKm("node/3", 20, "B"),
      signOnTrackAtKm("node/4", 30, "C"),
    ];

    const entries = filterEntryCityLimitSigns(entryFilterTrack, signs);

    expect(entries.map((sign) => sign.name)).toEqual(["A", "B", "C"]);
  });

  it("honours OSM city_limit=end as exit", () => {
    const signs = [
      signOnTrackAtKm("node/1", 0, "A", { city_limit: "end" }),
      signOnTrackAtKm("node/2", 10, "B", { city_limit: "begin" }),
    ];

    const entries = filterEntryCityLimitSigns(entryFilterTrack, signs);

    expect(entries.map((sign) => sign.name)).toEqual(["B"]);
  });

  it("skips French exit sign when followed by entry sign with different name", () => {
    const pairDistanceKm = (CITY_LIMIT_PAIR_LOOKAHEAD_M / 2) / 1000;
    const signs = [
      signOnTrackAtKm("node/exit-a", 5, "A"),
      signOnTrackAtKm("node/entry-b", 5 + pairDistanceKm, "B"),
      signOnTrackAtKm("node/exit-b", 20, "B"),
      signOnTrackAtKm("node/entry-c", 30, "C"),
    ];

    const entries = filterEntryCityLimitSigns(entryFilterTrack, signs);

    expect(entries.map((sign) => sign.name)).toEqual(["B", "C"]);
  });

  it("skips exit sign at commune boundary even when currentCommune is unknown", () => {
    const signs = [
      signOnTrackAtKm("node/1", 1, "Rennes"),
      signOnTrackAtKm("node/2", 1.3, "Chantepie"),
      signOnTrackAtKm("node/3", 15, "Chantepie"),
      signOnTrackAtKm("node/4", 15.3, "Cesson-Sévigné"),
    ];

    const entries = filterEntryCityLimitSigns(entryFilterTrack, signs);

    expect(entries.map((sign) => sign.name)).toEqual(["Chantepie", "Cesson-Sévigné"]);
  });

  it("keeps lone entry sign when next boundary is far away", () => {
    const signs = [
      signOnTrackAtKm("node/1", 0, "A"),
      signOnTrackAtKm("node/2", 10, "B"),
    ];

    const entries = filterEntryCityLimitSigns(entryFilterTrack, signs);

    expect(entries.map((sign) => sign.name)).toEqual(["A", "B"]);
  });

  it("skips exit sign when rider starts inside commune via initialCommune", () => {
    const signs = [
      signOnTrackAtKm("node/1", 0, "A"),
      signOnTrackAtKm("node/2", 10, "B"),
    ];

    const entries = filterEntryCityLimitSigns(entryFilterTrack, signs, {
      initialCommune: "A",
    });

    expect(entries.map((sign) => sign.name)).toEqual(["B"]);
  });
});

describe("fetchOverpassCityLimitSigns", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends User-Agent and city_limit query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchOverpassCityLimitSigns([
      [48.85, 2.35],
      [48.86, 2.36],
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      OVERPASS_ENDPOINTS[0],
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "User-Agent": OVERPASS_USER_AGENT,
        }),
      }),
    );

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = init.body as string;
    expect(decodeURIComponent(body)).toContain('node["traffic_sign"="city_limit"]');
  });
});
