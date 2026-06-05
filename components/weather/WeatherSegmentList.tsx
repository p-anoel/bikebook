"use client";

import { useTranslations } from "next-intl";
import { WindDirectionIndicator } from "@/components/weather/WindDirectionIndicator";
import { weatherCodeGroup, weatherEmoji } from "@/lib/weather/weather-emoji";
import type { RouteWeatherSegment } from "@/lib/weather/types";

interface WeatherSegmentListProps {
  segments: RouteWeatherSegment[];
  locale: string;
  selectedSegmentId?: number | null;
  hoveredSegmentId?: number | null;
  onSelect?: (segmentId: number | null) => void;
  onHover?: (segmentId: number | null) => void;
}

function rowClass(selected: boolean, hovered: boolean, interactive: boolean) {
  if (!interactive) return "";
  if (selected) return "bg-amber-50 ring-2 ring-amber-400";
  if (hovered) return "bg-blue-50/80 ring-2 ring-blue-300";
  return "hover:bg-zinc-50 active:bg-zinc-100";
}

function windBadgeClass(relative: RouteWeatherSegment["windRelative"]) {
  if (relative === "headwind") return "bg-red-100 text-red-800";
  if (relative === "tailwind") return "bg-green-100 text-green-800";
  return "bg-amber-100 text-amber-800";
}

function WeatherIcon({
  code,
  label,
}: {
  code: number;
  label: string;
}) {
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center text-base leading-none"
      title={label}
      aria-label={label}
      role="img"
    >
      {weatherEmoji(code)}
    </span>
  );
}

function formatPassageTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function WeatherSegmentList({
  segments,
  locale,
  selectedSegmentId = null,
  hoveredSegmentId = null,
  onSelect,
  onHover,
}: WeatherSegmentListProps) {
  const t = useTranslations("roadbook.weather");
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const interactive = Boolean(onSelect);

  if (segments.length === 0) {
    return <p className="text-sm text-zinc-500">{t("segmentsEmpty")}</p>;
  }

  return (
    <>
      <p className="mb-2 text-[11px] text-zinc-500">{t("segmentsHint")}</p>

      <ul className="space-y-2 md:hidden">
        {segments.map((segment) => {
          const selected = segment.id === selectedSegmentId;
          const hovered = segment.id === hoveredSegmentId && !selected;
          const skyLabel = t(`weatherCode.${weatherCodeGroup(segment.weatherCode)}`);
          return (
            <li key={segment.id}>
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onSelect?.(selected ? null : segment.id)}
                onMouseEnter={() => onHover?.(segment.id)}
                onMouseLeave={() => onHover?.(null)}
                aria-pressed={selected}
                className={`flex w-full flex-col gap-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-left text-sm transition-colors ${rowClass(selected, hovered, interactive)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-900">
                    {t("segmentLabel", { id: segment.id })}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${windBadgeClass(segment.windRelative)}`}
                    >
                      {t(`windRelative.${segment.windRelative}`)}
                    </span>
                    <WeatherIcon code={segment.weatherCode} label={skyLabel} />
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-600">
                  <span>{t("segmentKm", { km: fmt.format(segment.startDistanceM / 1000) })}</span>
                  <span>{t("passageAt", { time: formatPassageTime(segment.passageAt, locale) })}</span>
                  <span className="flex flex-col gap-0.5">
                    <WindDirectionIndicator
                      windDirectionDeg={segment.windDirectionDeg}
                      windRelative={segment.windRelative}
                      variant="stacked"
                    />
                    <span>{t("windSpeed", { speed: fmt.format(segment.windSpeedKmh) })}</span>
                  </span>
                  <span>{t("temperature", { value: fmt.format(segment.temperatureC) })}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-2 py-2 font-semibold">{t("columns.number")}</th>
              <th className="px-2 py-2 font-semibold">{t("columns.km")}</th>
              <th className="px-2 py-2 font-semibold">{t("columns.passage")}</th>
              <th className="px-2 py-2 font-semibold">{t("columns.wind")}</th>
              <th className="px-2 py-2 font-semibold">{t("columns.speed")}</th>
              <th className="px-2 py-2 font-semibold">{t("columns.direction")}</th>
              <th className="px-2 py-2 font-semibold">{t("columns.temp")}</th>
              <th className="px-2 py-2 font-semibold">{t("columns.precip")}</th>
              <th className="px-2 py-2 font-semibold">{t("columns.sky")}</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => {
              const selected = segment.id === selectedSegmentId;
              const hovered = segment.id === hoveredSegmentId && !selected;
              const skyLabel = t(`weatherCode.${weatherCodeGroup(segment.weatherCode)}`);
              return (
                <tr
                  key={segment.id}
                  onClick={() => interactive && onSelect?.(selected ? null : segment.id)}
                  onMouseEnter={() => onHover?.(segment.id)}
                  onMouseLeave={() => onHover?.(null)}
                  className={`border-b border-zinc-100 transition-colors ${interactive ? "cursor-pointer" : ""} ${rowClass(selected, hovered, interactive)}`}
                >
                  <td className="px-2 py-2 font-medium">{segment.id}</td>
                  <td className="px-2 py-2">
                    {t("segmentKm", { km: fmt.format(segment.startDistanceM / 1000) })}
                  </td>
                  <td className="px-2 py-2">
                    {formatPassageTime(segment.passageAt, locale)}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${windBadgeClass(segment.windRelative)}`}
                    >
                      {t(`windRelative.${segment.windRelative}`)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {t("windSpeed", { speed: fmt.format(segment.windSpeedKmh) })}
                  </td>
                  <td className="px-2 py-2">
                    <WindDirectionIndicator
                      windDirectionDeg={segment.windDirectionDeg}
                      windRelative={segment.windRelative}
                    />
                  </td>
                  <td className="px-2 py-2">
                    {t("temperature", { value: fmt.format(segment.temperatureC) })}
                  </td>
                  <td className="px-2 py-2">
                    {segment.precipitationMm > 0
                      ? t("precipitation", { value: fmt.format(segment.precipitationMm) })
                      : "—"}
                  </td>
                  <td className="px-2 py-2">
                    <WeatherIcon code={segment.weatherCode} label={skyLabel} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
