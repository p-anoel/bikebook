import { dominantWindRelative } from "@/lib/weather/wind-relative";
import type { RouteWeatherSegment, RouteWeatherSummary } from "@/lib/weather/types";

export function buildRouteWeatherSummary(segments: RouteWeatherSegment[]): RouteWeatherSummary {
  if (segments.length === 0) {
    return {
      avgWindSpeedKmh: 0,
      dominantWindRelative: "crosswind",
      minTempC: 0,
      maxTempC: 0,
      totalPrecipitationMm: 0,
    };
  }

  const temps = segments.map((s) => s.temperatureC);
  const windSpeeds = segments.map((s) => s.windSpeedKmh);

  return {
    avgWindSpeedKmh:
      Math.round((windSpeeds.reduce((sum, v) => sum + v, 0) / windSpeeds.length) * 10) / 10,
    dominantWindRelative: dominantWindRelative(segments.map((s) => s.windRelative)),
    minTempC: Math.round(Math.min(...temps) * 10) / 10,
    maxTempC: Math.round(Math.max(...temps) * 10) / 10,
    totalPrecipitationMm:
      Math.round(segments.reduce((sum, s) => sum + s.precipitationMm, 0) * 10) / 10,
  };
}
