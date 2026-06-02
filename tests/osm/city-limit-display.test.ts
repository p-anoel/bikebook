import { describe, expect, it } from "vitest";
import {
  formatCityLimitType,
  osmCityLimitPoiNameAndDescription,
  translateCityLimitDisplay,
} from "@/lib/osm/city-limit-display";

describe("formatCityLimitType", () => {
  it("maps city_limit=begin to entry", () => {
    expect(formatCityLimitType({ city_limit: "begin" })).toBe("entry");
  });

  it("maps city_limit=end to exit", () => {
    expect(formatCityLimitType({ city_limit: "end" })).toBe("exit");
  });

  it("maps city_limit=both to both", () => {
    expect(formatCityLimitType({ city_limit: "both" })).toBe("both");
  });

  it("uses direction as entry hint", () => {
    expect(formatCityLimitType({ direction: "forward" })).toBe("entry");
    expect(formatCityLimitType({ "traffic_sign:direction": "backward" })).toBe("entry");
  });

  it("returns generic when no direction tags", () => {
    expect(formatCityLimitType({ traffic_sign: "city_limit" })).toBe("generic");
  });
});

describe("osmCityLimitPoiNameAndDescription", () => {
  const t = (key: string, values?: Record<string, string>) => {
    const labels: Record<string, string> = {
      "types.entry": "Entrée de commune",
      "types.generic": "Panneau de commune",
      "poiName.entry": "Entrée {name}",
      "poiName.generic": "Panneau commune {name}",
    };
    const template = labels[key] ?? key;
    return values?.name ? template.replace("{name}", values.name) : template;
  };

  it("formats POI name with commune when OSM name is present", () => {
    const labels = translateCityLimitDisplay({ city_limit: "begin" }, t);
    const result = osmCityLimitPoiNameAndDescription("Rennes", labels, t, "Commune");

    expect(result.name).toBe("Entrée Rennes");
    expect(result.description).toBe("Entrée de commune");
  });

  it("falls back to type label when commune name is missing", () => {
    const labels = translateCityLimitDisplay({ city_limit: "begin" }, t);
    const result = osmCityLimitPoiNameAndDescription(undefined, labels, t, "Commune");

    expect(result.name).toBe("Entrée de commune");
    expect(result.description).toBeUndefined();
  });
});
