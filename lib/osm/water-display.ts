/** i18n key suffix under `roadbook.poiManage.water.types.*` */
export type WaterPointTypeKey = string;

/** i18n key suffix under `roadbook.poiManage.water.details.*` */
export type WaterPointDetailKey = string;

export interface WaterPointDetailItem {
  key: WaterPointDetailKey;
  params?: Record<string, string>;
}

const DRINKING_WATER_SUBTYPES = new Set([
  "fountain",
  "water_tap",
  "spring_box",
  "hand_pump",
  "bottle_refill",
  "jug",
  "yes",
]);

const AMENITY_FALLBACK_TYPES: Record<string, WaterPointTypeKey> = {
  bakery: "amenity_bakery",
  bar: "amenity_bar",
  cafe: "amenity_cafe",
  cemetery: "amenity_cemetery",
  fountain: "amenity_fountain",
  pub: "amenity_pub",
  restaurant: "amenity_restaurant",
  toilets: "amenity_toilets",
};

function normalizeTag(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || undefined;
}

function drinkingWaterSubtypeKey(subtype: string): WaterPointTypeKey {
  const normalized = subtype.replace(/-/g, "_");
  if (DRINKING_WATER_SUBTYPES.has(subtype)) {
    return `drinking_water_${normalized}`;
  }
  return `drinking_water_${normalized}`;
}

/**
 * Returns an i18n key suffix for `roadbook.poiManage.water.types.{key}`.
 */
export function formatWaterPointType(tags: Record<string, string>): WaterPointTypeKey {
  const amenity = normalizeTag(tags.amenity);
  const natural = normalizeTag(tags.natural);
  const manMade = normalizeTag(tags.man_made);
  const leisure = normalizeTag(tags.leisure);
  const drinkingWater = normalizeTag(tags.drinking_water);

  if (natural === "spring") {
    return "spring";
  }

  if (manMade === "water_well") {
    return "water_well";
  }

  if (manMade === "water_tap") {
    return "water_tap";
  }

  if (amenity === "drinking_water") {
    if (drinkingWater) {
      return drinkingWaterSubtypeKey(drinkingWater);
    }
    return "drinking_water";
  }

  if (amenity === "fountain") {
    return drinkingWater === "yes" ? "drinking_water_fountain" : "amenity_fountain";
  }

  if (leisure === "drinking_water") {
    return "drinking_water";
  }

  if (amenity && AMENITY_FALLBACK_TYPES[amenity]) {
    return AMENITY_FALLBACK_TYPES[amenity];
  }

  if (amenity) {
    return `amenity_${amenity.replace(/-/g, "_")}`;
  }

  if (natural) {
    return `natural_${natural.replace(/-/g, "_")}`;
  }

  if (manMade) {
    return `man_made_${manMade.replace(/-/g, "_")}`;
  }

  return "generic";
}

function pushDetail(
  items: WaterPointDetailItem[],
  key: WaterPointDetailKey,
  params?: Record<string, string>,
): void {
  items.push(params ? { key, params } : { key });
}

/**
 * Structured detail rows for UI translation.
 */
export function getWaterPointDetailItems(tags: Record<string, string>): WaterPointDetailItem[] {
  const items: WaterPointDetailItem[] = [];

  const access = normalizeTag(tags.access);
  if (access) {
    pushDetail(items, `access.${access.replace(/-/g, "_")}`);
  }

  const drinkingWaterLegal = normalizeTag(tags["drinking_water:legal"]);
  if (drinkingWaterLegal) {
    pushDetail(items, `drinking_water_legal.${drinkingWaterLegal.replace(/-/g, "_")}`);
  }

  const seasonal = normalizeTag(tags.seasonal);
  if (seasonal) {
    pushDetail(items, `seasonal.${seasonal.replace(/-/g, "_")}`);
  }

  const fee = normalizeTag(tags.fee);
  if (fee) {
    pushDetail(items, `fee.${fee.replace(/-/g, "_")}`);
  }

  const bottle = normalizeTag(tags.bottle);
  if (bottle) {
    pushDetail(items, `bottle.${bottle.replace(/-/g, "_")}`);
  }

  const drinkable = normalizeTag(tags.drinkable);
  if (drinkable) {
    pushDetail(items, `drinkable.${drinkable.replace(/-/g, "_")}`);
  }

  const pump = normalizeTag(tags.pump);
  if (pump) {
    pushDetail(items, `pump.${pump.replace(/-/g, "_")}`);
  }

  const waterSource = normalizeTag(tags.water_source);
  if (waterSource) {
    pushDetail(items, `water_source.${waterSource.replace(/-/g, "_")}`);
  }

  const covered = normalizeTag(tags.covered);
  if (covered) {
    pushDetail(items, `covered.${covered.replace(/-/g, "_")}`);
  }

  const operator = tags.operator?.trim();
  if (operator) {
    pushDetail(items, "operator", { name: operator });
  }

  return items;
}

/**
 * Pipe-separated i18n detail key suffixes for `roadbook.poiManage.water.details.*`.
 */
export function formatWaterPointDetails(tags: Record<string, string>): string {
  return getWaterPointDetailItems(tags)
    .map((item) => item.key)
    .join("|");
}

export type WaterPointTranslateFn = (
  key: string,
  values?: Record<string, string>,
) => string;

export interface WaterPointDisplayLabels {
  typeLabel: string;
  detailsLine?: string;
}

function translateTypeLabel(
  typeKey: WaterPointTypeKey,
  t: WaterPointTranslateFn & { has?: (key: string) => boolean },
): string {
  const path = `types.${typeKey}`;
  if (t.has && !t.has(path)) {
    return t("types.generic");
  }
  return t(path);
}

function translateDetailLabel(
  item: WaterPointDetailItem,
  t: WaterPointTranslateFn & { has?: (key: string) => boolean },
): string | null {
  const path = `details.${item.key}`;
  if (t.has && !t.has(path)) {
    return null;
  }
  return t(path, item.params);
}

export function translateWaterPointDisplay(
  tags: Record<string, string>,
  t: WaterPointTranslateFn & { has?: (key: string) => boolean },
): WaterPointDisplayLabels {
  const typeKey = formatWaterPointType(tags);
  const typeLabel = translateTypeLabel(typeKey, t);

  const detailLabels = getWaterPointDetailItems(tags)
    .map((item) => translateDetailLabel(item, t))
    .filter((label): label is string => Boolean(label));

  return {
    typeLabel,
    detailsLine: detailLabels.length > 0 ? detailLabels.join(" · ") : undefined,
  };
}

export function osmWaterPoiNameAndDescription(
  osmName: string | undefined,
  labels: WaterPointDisplayLabels,
  defaultName: string,
): { name: string; description?: string } {
  const trimmedName = osmName?.trim();
  if (trimmedName) {
    return { name: trimmedName };
  }

  return {
    name: labels.typeLabel || defaultName,
    description: labels.detailsLine,
  };
}
