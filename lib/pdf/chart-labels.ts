import type { LabelContent } from "@/lib/pdf/label-layout";

export function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function formatDistanceKm(distanceKm: number, unit: string, locale: string): string {
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(distanceKm);
  return `${value} ${unit}`;
}

export function formatElevation(elevationM: number, unit: string, locale: string): string {
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(elevationM);
  return `${value} ${unit}`;
}

export function buildMetricsSubtitle(
  distanceKm: number,
  elevationM: number | undefined,
  kmUnit: string,
  mUnit: string,
  locale: string,
  cumulativeGainM?: number,
): string {
  const parts = [formatDistanceKm(distanceKm, kmUnit, locale)];
  if (elevationM !== undefined) {
    parts.push(formatElevation(elevationM, mUnit, locale));
  }
  if (cumulativeGainM !== undefined) {
    parts.push(
      `D+ ${formatElevation(cumulativeGainM, mUnit, locale)}`,
    );
  }
  return parts.join(" · ");
}

export function buildPoiLabelContent(
  name: string,
  distanceKm: number,
  elevationM: number | undefined,
  kmUnit: string,
  mUnit: string,
  locale: string,
  cumulativeGainM?: number,
  number?: number,
): LabelContent {
  const title = number != null ? `${number}. ${name}` : name;
  return {
    title,
    subtitle: buildMetricsSubtitle(
      distanceKm,
      elevationM,
      kmUnit,
      mUnit,
      locale,
      cumulativeGainM,
    ),
  };
}

export function buildEndpointLabelContent(
  label: string,
  distanceKm: number,
  elevationM: number | undefined,
  kmUnit: string,
  mUnit: string,
  locale: string,
): LabelContent {
  return {
    title: label,
    subtitle: buildMetricsSubtitle(distanceKm, elevationM, kmUnit, mUnit, locale),
  };
}
