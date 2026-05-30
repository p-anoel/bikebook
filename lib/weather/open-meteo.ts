import {
  forecastCacheKey,
  getCachedForecast,
  setCachedForecast,
} from "@/lib/weather/forecast-cache";
import { retryAfterRateLimit } from "@/lib/weather/fetch-budget";

export interface HourlyForecast {
  time: string[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  temperature_2m: number[];
  precipitation: number[];
  weather_code: number[];
}

export interface OpenMeteoForecastResponse {
  hourly: HourlyForecast;
  timezone?: string;
}

export interface OpenMeteoSample {
  forecastTime: string;
  windSpeedKmh: number;
  windDirectionDeg: number;
  temperatureC: number;
  precipitationMm: number;
  weatherCode: number;
}

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

export async function fetchOpenMeteoForecast(
  lat: number,
  lng: number,
  startIso: string,
  endIso: string,
): Promise<OpenMeteoForecastResponse> {
  const cacheKey = forecastCacheKey(lat, lng, startIso, endIso);
  const cached = getCachedForecast(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: [
      "wind_speed_10m",
      "wind_direction_10m",
      "temperature_2m",
      "precipitation",
      "weather_code",
    ].join(","),
    wind_speed_unit: "kmh",
    timezone: "UTC",
    start_hour: startIso.slice(0, 13) + ":00",
    end_hour: endIso.slice(0, 13) + ":00",
  });

  const data = await retryAfterRateLimit(async () => {
    const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo error: ${response.status}`);
    }

    return (await response.json()) as OpenMeteoForecastResponse;
  });

  setCachedForecast(cacheKey, data);
  return data;
}

export function pickHourlySample(
  hourly: HourlyForecast,
  targetIso: string,
): OpenMeteoSample | null {
  if (!hourly.time.length) return null;

  const targetMs = new Date(targetIso).getTime();
  if (Number.isNaN(targetMs)) return null;

  let bestIndex = 0;
  let bestDelta = Infinity;

  for (let index = 0; index < hourly.time.length; index += 1) {
    const delta = Math.abs(new Date(hourly.time[index]).getTime() - targetMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  return {
    forecastTime: hourly.time[bestIndex],
    windSpeedKmh: hourly.wind_speed_10m[bestIndex] ?? 0,
    windDirectionDeg: hourly.wind_direction_10m[bestIndex] ?? 0,
    temperatureC: hourly.temperature_2m[bestIndex] ?? 0,
    precipitationMm: hourly.precipitation[bestIndex] ?? 0,
    weatherCode: hourly.weather_code[bestIndex] ?? 0,
  };
}
