import type { TrackPoint } from "@/types/roadbook";

export type WindRelative = "tailwind" | "headwind" | "crosswind";

export interface RouteSegmentGeometry {
  id: number;
  startDistanceM: number;
  endDistanceM: number;
  centerLat: number;
  centerLng: number;
  bearingDeg: number;
}

export interface RouteWeatherSegment extends RouteSegmentGeometry {
  passageAt: string;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windRelative: WindRelative;
  windComponentKmh: number;
  temperatureC: number;
  precipitationMm: number;
  weatherCode: number;
  forecastTime: string;
}

export interface RouteWeatherSummary {
  avgWindSpeedKmh: number;
  dominantWindRelative: WindRelative;
  minTempC: number;
  maxTempC: number;
  totalPrecipitationMm: number;
}

export interface RidePlanSummary {
  avgSpeedKmh: number;
  distanceKm: number;
  departureAt: string;
  arrivalAt: string;
  pauseMinutes: number;
  ridingMinutes: number;
}

export interface RouteWeatherSnapshot {
  departureAt: string;
  segments: RouteWeatherSegment[];
  summary: RouteWeatherSummary;
  ridePlan: RidePlanSummary;
}

export interface WeatherRouteRequest {
  track: TrackPoint[];
  departureAt: string;
  segmentLengthKm?: number;
  avgSpeedKmh?: number;
  pauseMinutes?: number;
}
