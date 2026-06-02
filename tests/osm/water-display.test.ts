import { describe, expect, it } from "vitest";
import {
  formatWaterPointDetails,
  formatWaterPointType,
  getWaterPointDetailItems,
  osmWaterPoiNameAndDescription,
} from "@/lib/osm/water-display";

describe("formatWaterPointType", () => {
  it("maps natural=spring", () => {
    expect(formatWaterPointType({ natural: "spring" })).toBe("spring");
  });

  it("maps man_made=water_well", () => {
    expect(formatWaterPointType({ man_made: "water_well" })).toBe("water_well");
  });

  it("maps amenity=drinking_water with drinking_water subtype", () => {
    expect(
      formatWaterPointType({ amenity: "drinking_water", drinking_water: "water_tap" }),
    ).toBe("drinking_water_water_tap");
    expect(
      formatWaterPointType({ amenity: "drinking_water", drinking_water: "fountain" }),
    ).toBe("drinking_water_fountain");
  });

  it("maps generic drinking_water without subtype", () => {
    expect(formatWaterPointType({ amenity: "drinking_water" })).toBe("drinking_water");
  });

  it("maps amenity=fountain", () => {
    expect(formatWaterPointType({ amenity: "fountain" })).toBe("amenity_fountain");
    expect(formatWaterPointType({ amenity: "fountain", drinking_water: "yes" })).toBe(
      "drinking_water_fountain",
    );
  });

  it("maps unrelated amenity tags when present", () => {
    expect(formatWaterPointType({ amenity: "bakery" })).toBe("amenity_bakery");
    expect(formatWaterPointType({ amenity: "restaurant" })).toBe("amenity_restaurant");
  });

  it("falls back to generic", () => {
    expect(formatWaterPointType({})).toBe("generic");
  });
});

describe("formatWaterPointDetails", () => {
  it("collects access, seasonal, and operator", () => {
    const details = formatWaterPointDetails({
      access: "yes",
      seasonal: "summer",
      operator: "Mairie",
    });
    expect(details).toContain("access.yes");
    expect(details).toContain("seasonal.summer");
    expect(details).toContain("operator");
  });

  it("includes drinking_water:legal", () => {
    expect(formatWaterPointDetails({ "drinking_water:legal": "yes" })).toBe(
      "drinking_water_legal.yes",
    );
  });

  it("includes bottle and access when tagged yes", () => {
    const details = formatWaterPointDetails({
      amenity: "drinking_water",
      drinking_water: "yes",
      bottle: "yes",
      access: "yes",
    });
    expect(details).toBe("access.yes|bottle.yes");
  });
});

describe("getWaterPointDetailItems", () => {
  it("passes operator name as param", () => {
    const items = getWaterPointDetailItems({ operator: "Syndicat" });
    expect(items).toEqual([{ key: "operator", params: { name: "Syndicat" } }]);
  });
});

describe("osmWaterPoiNameAndDescription", () => {
  it("uses OSM name when present", () => {
    expect(
      osmWaterPoiNameAndDescription(
        "Fontaine du village",
        { typeLabel: "Borne", detailsLine: "Accès libre" },
        "Point d'eau",
      ),
    ).toEqual({ name: "Fontaine du village" });
  });

  it("uses type and details when OSM name is missing", () => {
    expect(
      osmWaterPoiNameAndDescription(undefined, {
        typeLabel: "Source",
        detailsLine: "Saison estivale",
      }, "Point d'eau"),
    ).toEqual({ name: "Source", description: "Saison estivale" });
  });
});
