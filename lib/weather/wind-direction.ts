/** Eight-point compass rose (meteorological wind-from direction). */
export const COMPASS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export type Compass8 = (typeof COMPASS_8)[number];

export type WindDirectionCompassKey = `compass.${Compass8}`;

export function normalizeWindDirectionDeg(deg: number): number {
  return Math.round(((deg % 360) + 360) % 360);
}

/** Maps wind-from degrees to the nearest 8-point compass label key. */
export function windDirectionToCompass8(deg: number): Compass8 {
  const normalized = normalizeWindDirectionDeg(deg);
  const index = Math.round(normalized / 45) % 8;
  return COMPASS_8[index]!;
}

export interface WindDirectionParts {
  deg: number;
  compass: Compass8;
  compassKey: WindDirectionCompassKey;
}

export function getWindDirectionParts(deg: number): WindDirectionParts {
  const compass = windDirectionToCompass8(deg);
  return {
    deg: normalizeWindDirectionDeg(deg),
    compass,
    compassKey: `compass.${compass}`,
  };
}

/** Localized label, e.g. "Nord-Est (45°)". */
export function formatWindDirection(
  deg: number,
  translateCompass: (key: WindDirectionCompassKey) => string,
  formatLabel: (values: { direction: string; deg: number }) => string,
): string {
  const { deg: rounded, compassKey } = getWindDirectionParts(deg);
  return formatLabel({
    direction: translateCompass(compassKey),
    deg: rounded,
  });
}
