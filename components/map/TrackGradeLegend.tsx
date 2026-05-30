"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { buildMapGradeLegendGradient } from "@/lib/gpx/gradient";

export function TrackGradeLegend() {
  const t = useTranslations("roadbook.mapLegend");
  const gradient = useMemo(() => buildMapGradeLegendGradient(), []);

  return (
    <div
      className="pointer-events-none absolute inset-x-2 bottom-2 z-[1000] rounded-lg border border-zinc-200/80 bg-white/95 px-2.5 py-2 shadow-lg backdrop-blur-sm sm:inset-x-auto sm:bottom-3 sm:left-3 sm:w-44 sm:px-3 sm:py-2.5"
      aria-hidden="true"
    >
      <p className="mb-1.5 truncate text-[9px] font-semibold uppercase tracking-wide text-zinc-500 sm:mb-2 sm:text-[10px]">
        {t("title")}
      </p>
      <div
        className="h-2.5 w-full rounded-full ring-1 ring-inset ring-black/10 sm:h-3"
        style={{ background: gradient }}
      />
      <div className="mt-1 hidden justify-between text-[10px] font-medium text-zinc-600 sm:flex">
        <span>{t("descent")}</span>
        <span>{t("flat")}</span>
        <span>{t("climb")}</span>
        <span>{t("steep")}</span>
      </div>
      <div className="mt-1 flex justify-between text-[8px] tabular-nums text-zinc-500 sm:mt-0.5 sm:text-[9px] sm:text-zinc-400">
        <span>−8 %</span>
        <span>0 %</span>
        <span>+6 %</span>
        <span>+14 %</span>
      </div>
    </div>
  );
}
