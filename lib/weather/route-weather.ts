import { groupForecastPlans } from "@/lib/weather/forecast-groups";
import { fetchOpenMeteoForecast, pickHourlySample } from "@/lib/weather/open-meteo";
import {
  buildRouteWeatherSegments,
  estimatedArrivalAtDistance,
  DEFAULT_AVG_SPEED_KMH,
  DEFAULT_SEGMENT_LENGTH_KM,
} from "@/lib/weather/segments";
import { buildRouteWeatherSummary } from "@/lib/weather/summary";
import { computeRidePlan } from "@/lib/weather/ride-plan";
import { classifyWindRelative, windComponentKmh } from "@/lib/weather/wind-relative";
import type {
  RouteSegmentGeometry,
  RouteWeatherSegment,
  RouteWeatherSnapshot,
  WeatherRouteRequest,
} from "@/lib/weather/types";
import type { TrackPoint } from "@/types/roadbook";

type SegmentWeatherFields = Omit<RouteWeatherSegment, keyof RouteSegmentGeometry | "passageAt">;

function emptyWeather(arrivalIso: string): SegmentWeatherFields {
  return {
    windSpeedKmh: 0,
    windDirectionDeg: 0,
    windRelative: "crosswind",
    windComponentKmh: 0,
    temperatureC: 0,
    precipitationMm: 0,
    weatherCode: 0,
    forecastTime: arrivalIso,
  };
}

function weatherFromSample(
  geometry: RouteSegmentGeometry,
  arrivalIso: string,
  sample: ReturnType<typeof pickHourlySample>,
): SegmentWeatherFields {
  if (!sample) return emptyWeather(arrivalIso);

  const windRelative = classifyWindRelative(geometry.bearingDeg, sample.windDirectionDeg);
  const component = windComponentKmh(
    geometry.bearingDeg,
    sample.windDirectionDeg,
    sample.windSpeedKmh,
  );

  return {
    windSpeedKmh: Math.round(sample.windSpeedKmh * 10) / 10,
    windDirectionDeg: Math.round(sample.windDirectionDeg),
    windRelative,
    windComponentKmh: component,
    temperatureC: Math.round(sample.temperatureC * 10) / 10,
    precipitationMm: Math.round(sample.precipitationMm * 10) / 10,
    weatherCode: sample.weatherCode,
    forecastTime: sample.forecastTime,
  };
}

export async function buildRouteWeatherSnapshot(
  request: WeatherRouteRequest,
): Promise<RouteWeatherSnapshot> {
  const {
    track,
    departureAt,
    segmentLengthKm = DEFAULT_SEGMENT_LENGTH_KM,
    avgSpeedKmh = DEFAULT_AVG_SPEED_KMH,
    pauseMinutes = 0,
  } = request;

  const distanceKm = track[track.length - 1]?.distanceM / 1000 || 0;
  const ridePlan = computeRidePlan({
    mode: "speed",
    distanceKm,
    departureAt,
    avgSpeedKmh,
    pauseMinutes,
  });

  const geometries = buildRouteWeatherSegments(track, segmentLengthKm);
  const totalDistanceM = track[track.length - 1]?.distanceM ?? 0;
  const plans = geometries.map((geometry) => {
    const centerM = (geometry.startDistanceM + geometry.endDistanceM) / 2;
    const passageAt = estimatedArrivalAtDistance(
      departureAt,
      centerM,
      ridePlan.avgSpeedKmh,
      pauseMinutes,
      totalDistanceM,
    );
    return {
      geometry,
      arrivalIso: passageAt,
      passageAt,
    };
  });

  const groups = groupForecastPlans(plans);
  const weatherBySegmentId = new Map<number, SegmentWeatherFields>();

  for (const group of groups) {
    const forecast = await fetchOpenMeteoForecast(
      group.lat,
      group.lng,
      group.startIso,
      group.endIso,
    );

    for (const plan of group.plans) {
      const sample = pickHourlySample(forecast.hourly, plan.arrivalIso);
      weatherBySegmentId.set(
        plan.geometry.id,
        weatherFromSample(plan.geometry, plan.arrivalIso, sample),
      );
    }
  }

  const segments: RouteWeatherSegment[] = geometries.map((geometry) => {
    const plan = plans.find((item) => item.geometry.id === geometry.id);
    const passageAt = plan?.passageAt ?? departureAt;
    return {
      ...geometry,
      passageAt,
      ...(weatherBySegmentId.get(geometry.id) ?? emptyWeather(passageAt)),
    };
  });

  return {
    departureAt,
    segments,
    summary: buildRouteWeatherSummary(segments),
    ridePlan,
  };
}

export function validateWeatherRouteRequest(body: unknown): WeatherRouteRequest | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.track) || typeof record.departureAt !== "string") return null;

  const track = record.track as TrackPoint[];
  if (track.length < 2) return null;
  if (Number.isNaN(new Date(record.departureAt).getTime())) return null;

  return {
    track,
    departureAt: record.departureAt,
    segmentLengthKm:
      typeof record.segmentLengthKm === "number" ? record.segmentLengthKm : undefined,
    avgSpeedKmh: typeof record.avgSpeedKmh === "number" ? record.avgSpeedKmh : undefined,
    pauseMinutes: typeof record.pauseMinutes === "number" ? record.pauseMinutes : undefined,
  };
}
