import { describe, expect, it } from "vitest";
import { buildTrackWithDistances } from "@/lib/gpx/elevation";
import { migratePersistedRoadbook } from "@/lib/store/roadbook-migrate";

describe("migratePersistedRoadbook", () => {
  it("adds a default stage to legacy roadbooks", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.01, lng: 6.01, ele: 200 },
    ]);

    const legacy = {
      id: "legacy-1",
      name: "Old ride",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      stats: {
        distanceKm: 12,
        elevationGainM: 100,
        elevationLossM: 0,
        minElevationM: 100,
        maxElevationM: 200,
      },
      track,
      pois: [],
      bounds: [
        [45, 6],
        [45.01, 6.01],
      ] as [[number, number], [number, number]],
    };

    const migrated = migratePersistedRoadbook(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated!.stages).toHaveLength(1);
    expect(migrated!.stages[0].endDistanceM).toBeCloseTo(
      track[track.length - 1].distanceM,
      0,
    );
  });

  it("normalizes existing stages", () => {
    const track = buildTrackWithDistances([
      { lat: 45, lng: 6, ele: 100 },
      { lat: 45.01, lng: 6.01, ele: 200 },
    ]).map((pt, index) => ({ ...pt, distanceM: index * 10_000 }));

    const migrated = migratePersistedRoadbook({
      id: "1",
      name: "Tour",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      stats: {
        distanceKm: 20,
        elevationGainM: 100,
        elevationLossM: 0,
        minElevationM: 100,
        maxElevationM: 200,
      },
      track,
      pois: [],
      bounds: [
        [45, 6],
        [45.01, 6.01],
      ],
      stages: [{ id: "s1", endDistanceM: 10_000 }],
    });

    expect(migrated!.stages).toHaveLength(1);
    expect(migrated!.stages[0].endDistanceM).toBe(10_000);
  });

  it("returns null for invalid payloads", () => {
    expect(migratePersistedRoadbook(null)).toBeNull();
    expect(migratePersistedRoadbook({ id: "x" })).toBeNull();
  });
});
