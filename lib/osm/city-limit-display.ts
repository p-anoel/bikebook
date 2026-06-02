/** i18n key suffix under `roadbook.poiManage.cityLimit.types.*` */
export type CityLimitTypeKey = "entry" | "exit" | "both" | "generic";

export interface CityLimitDisplayLabels {
  typeKey: CityLimitTypeKey;
  typeLabel: string;
}

export type CityLimitTranslateFn = (
  key: string,
  values?: Record<string, string>,
) => string;

function normalizeTag(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || undefined;
}

/**
 * Derives entry/exit/both from OSM tags (city_limit, direction, traffic_sign:direction).
 */
export function formatCityLimitType(tags: Record<string, string>): CityLimitTypeKey {
  const cityLimit = normalizeTag(tags.city_limit);
  if (cityLimit === "begin") return "entry";
  if (cityLimit === "end") return "exit";
  if (cityLimit === "both") return "both";

  const direction = normalizeTag(tags.direction) ?? normalizeTag(tags["traffic_sign:direction"]);
  if (direction === "forward" || direction === "backward") {
    return "entry";
  }

  return "generic";
}

export function translateCityLimitDisplay(
  tags: Record<string, string>,
  t: CityLimitTranslateFn & { has?: (key: string) => boolean },
): CityLimitDisplayLabels {
  const typeKey = formatCityLimitType(tags);
  const path = `types.${typeKey}`;
  const typeLabel =
    t.has && !t.has(path) ? t("types.generic") : t(path);

  return { typeKey, typeLabel };
}

export function formatCityLimitDisplayTitle(
  communeName: string | undefined,
  labels: CityLimitDisplayLabels,
  t: CityLimitTranslateFn & { has?: (key: string) => boolean },
  defaultName: string,
): string {
  const trimmed = communeName?.trim();
  if (trimmed) {
    const path = `poiName.${labels.typeKey}`;
    return t.has && !t.has(path) ? t("poiName.generic", { name: trimmed }) : t(path, { name: trimmed });
  }

  return labels.typeLabel || defaultName;
}

export function osmCityLimitPoiNameAndDescription(
  osmName: string | undefined,
  labels: CityLimitDisplayLabels,
  t: CityLimitTranslateFn & { has?: (key: string) => boolean },
  defaultName: string,
): { name: string; description?: string } {
  const trimmedName = osmName?.trim();
  const name = formatCityLimitDisplayTitle(osmName, labels, t, defaultName);

  return {
    name,
    description: trimmedName ? labels.typeLabel : undefined,
  };
}
