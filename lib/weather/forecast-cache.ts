import type { OpenMeteoForecastResponse } from "@/lib/weather/open-meteo";
import { bucketCoord } from "@/lib/weather/forecast-groups";

const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  data: OpenMeteoForecastResponse;
}

const forecastCache = new Map<string, CacheEntry>();

export function forecastCacheKey(
  lat: number,
  lng: number,
  startIso: string,
  endIso: string,
): string {
  const latKey = bucketCoord(lat);
  const lngKey = bucketCoord(lng);
  const startHour = startIso.slice(0, 13);
  const endHour = endIso.slice(0, 13);
  return `${latKey},${lngKey}|${startHour}|${endHour}`;
}

export function getCachedForecast(key: string): OpenMeteoForecastResponse | null {
  const entry = forecastCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    forecastCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedForecast(key: string, data: OpenMeteoForecastResponse): void {
  forecastCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearForecastCache(): void {
  forecastCache.clear();
}
