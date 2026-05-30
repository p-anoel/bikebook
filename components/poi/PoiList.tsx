"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { withPoiStats, type PoiWithStats } from "@/lib/gpx/poi-intervals";
import type { Poi, TrackPoint } from "@/types/roadbook";
import { formatElevation } from "@/lib/utils";

interface PoiListProps {
  track: TrackPoint[];
  pois: Poi[];
  locale: string;
  selectedPoiId?: string | null;
  hoveredPoiId?: string | null;
  onSelect?: (poiId: string | null) => void;
  onHover?: (poiId: string | null) => void;
}

function poiRowClass(selected: boolean, hovered: boolean, interactive: boolean) {
  if (!interactive) return "";
  if (selected) return "bg-blue-50 ring-2 ring-amber-400";
  if (hovered) return "bg-blue-50/80 ring-2 ring-blue-300";
  return "hover:bg-zinc-50 active:bg-zinc-100";
}

function PoiMetrics({
  poi,
  locale,
  t,
}: {
  poi: PoiWithStats;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <div>
        <dt className="text-zinc-400">{t("poiColumns.kilometrage")}</dt>
        <dd className="font-medium text-zinc-700">
          {t("poiDistance", { distance: (poi.distanceFromStartM / 1000).toFixed(1) })}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-400">{t("poiColumns.cumulativeGain")}</dt>
        <dd className="font-medium text-zinc-700">
          {t("poiCumulativeGain", { gain: formatElevation(poi.cumulativeElevationGainM, locale) })}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-400">{t("poiColumns.interval")}</dt>
        <dd className="font-medium text-zinc-700">
          {poi.intervalFromPrevM === null
            ? "—"
            : t("poiInterval", { distance: (poi.intervalFromPrevM / 1000).toFixed(1) })}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-400">{t("poiColumns.intervalGain")}</dt>
        <dd className="font-medium text-zinc-700">
          {poi.intervalElevationGainM === null
            ? "—"
            : t("poiIntervalGain", { gain: formatElevation(poi.intervalElevationGainM, locale) })}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-400">{t("poiColumns.elevation")}</dt>
        <dd className="font-medium text-zinc-700">
          {poi.ele !== undefined ? `${formatElevation(poi.ele, locale)} m` : "—"}
        </dd>
      </div>
    </>
  );
}

export function PoiList({
  track,
  pois,
  locale,
  selectedPoiId = null,
  hoveredPoiId = null,
  onSelect,
  onHover,
}: PoiListProps) {
  const t = useTranslations("roadbook");
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());

  const rows = useMemo(() => withPoiStats(track, pois), [track, pois]);

  useEffect(() => {
    if (!selectedPoiId) return;
    rowRefs.current.get(selectedPoiId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedPoiId]);

  if (rows.length === 0) {
    return <p className="py-4 text-sm text-zinc-500">{t("poiEmpty")}</p>;
  }

  const hint = onSelect ? (
    <p className="mb-2 text-[11px] text-zinc-500">{t("poiHint")}</p>
  ) : null;

  return (
    <div>
      {hint}

      <ul className="space-y-2 md:hidden">
        {rows.map((poi) => {
          const selected = poi.id === selectedPoiId;
          const hovered = poi.id === hoveredPoiId && !selected;
          const interactive = Boolean(onSelect);

          const body = (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {poi.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900">{poi.name}</p>
                  {poi.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{poi.description}</p>
                  ) : null}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <PoiMetrics poi={poi} locale={locale} t={t} />
              </dl>
            </>
          );

          if (!interactive) {
            return (
              <li key={poi.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                {body}
              </li>
            );
          }

          return (
            <li
              key={poi.id}
              ref={(node) => {
                if (node) rowRefs.current.set(poi.id, node);
                else rowRefs.current.delete(poi.id);
              }}
            >
              <button
                type="button"
                onClick={() => onSelect?.(poi.id)}
                onMouseEnter={() => onHover?.(poi.id)}
                onMouseLeave={() => onHover?.(null)}
                aria-pressed={selected}
                className={`w-full rounded-lg border border-zinc-200 p-3 text-left transition-colors ${poiRowClass(selected, hovered, true)}`}
              >
                {body}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <th scope="col" className="px-3 py-2 font-medium">
                {t("poiColumns.number")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("poiColumns.name")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("poiColumns.kilometrage")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("poiColumns.interval")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("poiColumns.intervalGain")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("poiColumns.cumulativeGain")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("poiColumns.elevation")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("poiColumns.description")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((poi) => {
              const selected = poi.id === selectedPoiId;
              const hovered = poi.id === hoveredPoiId && !selected;

              if (!onSelect) {
                return (
                  <tr key={poi.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-3 font-semibold text-blue-700">{poi.number}</td>
                    <td className="px-3 py-3 font-medium text-zinc-900">{poi.name}</td>
                    <td className="px-3 py-3 text-zinc-600">
                      {t("poiDistance", {
                        distance: (poi.distanceFromStartM / 1000).toFixed(1),
                      })}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {poi.intervalFromPrevM === null
                        ? "—"
                        : t("poiInterval", {
                            distance: (poi.intervalFromPrevM / 1000).toFixed(1),
                          })}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {poi.intervalElevationGainM === null
                        ? "—"
                        : t("poiIntervalGain", {
                            gain: formatElevation(poi.intervalElevationGainM, locale),
                          })}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {t("poiCumulativeGain", {
                        gain: formatElevation(poi.cumulativeElevationGainM, locale),
                      })}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {poi.ele !== undefined ? `${formatElevation(poi.ele, locale)} m` : "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-500">{poi.description ?? "—"}</td>
                  </tr>
                );
              }

              return (
                <tr
                  key={poi.id}
                  ref={(node) => {
                    if (node) rowRefs.current.set(poi.id, node);
                    else rowRefs.current.delete(poi.id);
                  }}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="p-1" colSpan={8}>
                    <button
                      type="button"
                      onClick={() => onSelect(poi.id)}
                      onMouseEnter={() => onHover?.(poi.id)}
                      onMouseLeave={() => onHover?.(null)}
                      aria-pressed={selected}
                      className={`grid w-full grid-cols-[2.5rem_1.2fr_0.8fr_1fr_1fr_1fr_0.8fr_1.5fr] gap-2 rounded-md px-3 py-2.5 text-left transition-colors ${poiRowClass(selected, hovered, true)}`}
                    >
                      <span className="font-semibold text-blue-700">{poi.number}</span>
                      <span className="font-medium text-zinc-900">{poi.name}</span>
                      <span className="text-zinc-600">
                        {t("poiDistance", {
                          distance: (poi.distanceFromStartM / 1000).toFixed(1),
                        })}
                      </span>
                      <span className="text-zinc-600">
                        {poi.intervalFromPrevM === null
                          ? "—"
                          : t("poiInterval", {
                              distance: (poi.intervalFromPrevM / 1000).toFixed(1),
                            })}
                      </span>
                      <span className="text-zinc-600">
                        {poi.intervalElevationGainM === null
                          ? "—"
                          : t("poiIntervalGain", {
                              gain: formatElevation(poi.intervalElevationGainM, locale),
                            })}
                      </span>
                      <span className="text-zinc-600">
                        {t("poiCumulativeGain", {
                          gain: formatElevation(poi.cumulativeElevationGainM, locale),
                        })}
                      </span>
                      <span className="text-zinc-600">
                        {poi.ele !== undefined ? `${formatElevation(poi.ele, locale)} m` : "—"}
                      </span>
                      <span className="text-zinc-500">{poi.description ?? "—"}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
