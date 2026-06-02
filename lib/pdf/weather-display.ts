import { weatherCodeGroup, weatherEmoji } from "@/lib/weather/weather-emoji";
import type { RouteWeatherSegment, RouteWeatherSnapshot } from "@/lib/weather/types";

export function formatPdfDateTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatPdfPassageTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPdfNumber(
  value: number,
  locale: string,
  maximumFractionDigits = 1,
): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

export function segmentKmLabel(km: number, locale: string, kmUnit: string): string {
  return `${formatPdfNumber(km, locale)} ${kmUnit}`;
}

export function segmentSkyLabel(
  code: number,
  weatherCodeLabels: Record<string, string>,
): string {
  const group = weatherCodeGroup(code);
  const label = weatherCodeLabels[group] ?? weatherCodeLabels.unknown ?? "—";
  return `${weatherEmoji(code)} ${label}`;
}

export interface PdfWeatherRow {
  id: number;
  km: string;
  passage: string;
  windRelative: string;
  windSpeed: string;
  windComponent: string;
  temperature: string;
  precipitation: string;
  sky: string;
}

export function buildPdfWeatherRows(
  segments: RouteWeatherSegment[],
  locale: string,
  labels: {
    kmUnit: string;
    windSpeed: (speed: number) => string;
    windComponent: (value: number) => string;
    temperature: (value: number) => string;
    precipitation: (value: number) => string;
    windRelative: Record<RouteWeatherSegment["windRelative"], string>;
    weatherCode: Record<string, string>;
  },
): PdfWeatherRow[] {
  return segments.map((segment) => ({
    id: segment.id,
    km: segmentKmLabel(segment.startDistanceM / 1000, locale, labels.kmUnit),
    passage: formatPdfPassageTime(segment.passageAt, locale),
    windRelative: labels.windRelative[segment.windRelative],
    windSpeed: labels.windSpeed(segment.windSpeedKmh),
    windComponent: labels.windComponent(segment.windComponentKmh),
    temperature: labels.temperature(segment.temperatureC),
    precipitation:
      segment.precipitationMm > 0
        ? labels.precipitation(segment.precipitationMm)
        : "—",
    sky: segmentSkyLabel(segment.weatherCode, labels.weatherCode),
  }));
}

export function hasWeatherContent(snapshot: RouteWeatherSnapshot | null | undefined): boolean {
  return Boolean(snapshot && snapshot.segments.length > 0);
}
