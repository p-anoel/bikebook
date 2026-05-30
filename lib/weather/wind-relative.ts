import { shortestAngleDiff } from "@/lib/weather/bearing";
import type { WindRelative } from "@/lib/weather/types";

const HEADWIND_MAX_DEG = 45;
const TAILWIND_MIN_DEG = 135;

/** Classify wind relative to travel bearing (meteorological wind-from direction). */
export function classifyWindRelative(bearingDeg: number, windFromDeg: number): WindRelative {
  const angle = Math.abs(shortestAngleDiff(windFromDeg, bearingDeg));

  if (angle <= HEADWIND_MAX_DEG) return "headwind";
  if (angle >= TAILWIND_MIN_DEG) return "tailwind";
  return "crosswind";
}

/**
 * Signed component of wind along travel direction (km/h).
 * Positive = tailwind, negative = headwind.
 */
export function windComponentKmh(
  bearingDeg: number,
  windFromDeg: number,
  windSpeedKmh: number,
): number {
  const windToDeg = (windFromDeg + 180) % 360;
  const angleDiff = shortestAngleDiff(bearingDeg, windToDeg);
  const radians = (angleDiff * Math.PI) / 180;
  return Math.round(windSpeedKmh * Math.cos(radians) * 10) / 10;
}

export function dominantWindRelative(relatives: WindRelative[]): WindRelative {
  if (relatives.length === 0) return "crosswind";

  const counts: Record<WindRelative, number> = {
    headwind: 0,
    tailwind: 0,
    crosswind: 0,
  };

  for (const item of relatives) counts[item] += 1;

  if (counts.headwind >= counts.tailwind && counts.headwind >= counts.crosswind) {
    return "headwind";
  }
  if (counts.tailwind >= counts.crosswind) return "tailwind";
  return "crosswind";
}
