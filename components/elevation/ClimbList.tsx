"use client";

import { useTranslations } from "next-intl";
import type { ClimbSegment } from "@/lib/gpx/gradient";
import { formatElevation } from "@/lib/utils";

interface ClimbListProps {
  climbs: ClimbSegment[];
  locale: string;
  selectedClimbId: number | null;
  hoveredClimbId?: number | null;
  onSelect: (climb: ClimbSegment) => void;
  onHover?: (climbId: number | null) => void;
}

export function ClimbList({
  climbs,
  locale,
  selectedClimbId,
  hoveredClimbId = null,
  onSelect,
  onHover,
}: ClimbListProps) {
  const t = useTranslations("roadbook");
  const fmtGrade = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  if (climbs.length === 0) {
    return (
      <p className="border-t border-zinc-200 pt-3 text-sm text-zinc-500">{t("climbsEmpty")}</p>
    );
  }

  const climbButtonClass = (selected: boolean, hovered: boolean) => {
    if (selected) return "bg-amber-50 ring-2 ring-amber-400";
    if (hovered) return "bg-amber-50/80 ring-2 ring-amber-200";
    return "hover:bg-zinc-50 active:bg-zinc-100";
  };

  return (
    <div className="border-t border-zinc-200 pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {t("climbsTitle", { count: climbs.length })}
      </h3>
      <p className="mb-2 text-[11px] text-zinc-500">{t("climbsHint")}</p>

      <ul className="space-y-2 sm:hidden">
        {climbs.map((climb) => {
          const selected = climb.id === selectedClimbId;
          const hovered = climb.id === hoveredClimbId && !selected;
          return (
            <li key={climb.id}>
              <button
                type="button"
                onClick={() => onSelect(climb)}
                onMouseEnter={() => onHover?.(climb.id)}
                onMouseLeave={() => onHover?.(null)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 text-left transition-colors ${climbButtonClass(selected, hovered)}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
                  {climb.id}
                </span>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <span className="text-zinc-400">{t("climbColumns.start")}</span>
                    <p className="font-medium text-zinc-800">
                      {t("climbStart", {
                        distance: (climb.startDistanceM / 1000).toFixed(1),
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-400">{t("climbColumns.gain")}</span>
                    <p className="font-medium text-zinc-800">+{formatElevation(climb.gainM, locale)} m</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">{t("climbColumns.length")}</span>
                    <p className="font-medium text-zinc-800">{(climb.lengthM / 1000).toFixed(1)} km</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">{t("climbColumns.grade")}</span>
                    <p className="font-medium text-zinc-800">{fmtGrade.format(climb.avgGradePct)} %</p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("climbColumns.number")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("climbColumns.start")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("climbColumns.gain")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("climbColumns.length")}
              </th>
              <th scope="col" className="px-2 py-1.5 font-medium">
                {t("climbColumns.grade")}
              </th>
            </tr>
          </thead>
          <tbody>
            {climbs.map((climb) => {
              const selected = climb.id === selectedClimbId;
              const hovered = climb.id === hoveredClimbId && !selected;
              return (
                <tr key={climb.id} className="border-b border-zinc-100 last:border-0">
                  <td className="p-1" colSpan={5}>
                    <button
                      type="button"
                      onClick={() => onSelect(climb)}
                      onMouseEnter={() => onHover?.(climb.id)}
                      onMouseLeave={() => onHover?.(null)}
                      aria-pressed={selected}
                      className={`grid w-full grid-cols-[2rem_1fr_1fr_1fr_1fr] gap-2 rounded-md px-2 py-2 text-left transition-colors ${climbButtonClass(selected, hovered)}`}
                    >
                      <span className="font-semibold text-amber-700">{climb.id}</span>
                      <span className="text-zinc-700">
                        {t("climbStart", {
                          distance: (climb.startDistanceM / 1000).toFixed(1),
                        })}
                      </span>
                      <span className="text-zinc-700">
                        +{formatElevation(climb.gainM, locale)} m
                      </span>
                      <span className="text-zinc-700">
                        {(climb.lengthM / 1000).toFixed(1)} km
                      </span>
                      <span className="text-zinc-700">{fmtGrade.format(climb.avgGradePct)} %</span>
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
