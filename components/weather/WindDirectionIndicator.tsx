"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  formatWindDirection,
  getWindDirectionParts,
} from "@/lib/weather/wind-direction";
import type { WindRelative } from "@/lib/weather/types";

interface WindDirectionIndicatorProps {
  /** Meteorological wind-from direction (degrees clockwise from north). */
  windDirectionDeg: number;
  /** Optional tint when shown beside a wind-relative badge. */
  windRelative?: WindRelative;
  className?: string;
  /** Compact single line vs stacked label + degrees. */
  variant?: "inline" | "stacked";
}

function windTextColor(relative?: WindRelative): string {
  if (relative === "headwind") return "text-red-800";
  if (relative === "tailwind") return "text-green-800";
  if (relative === "crosswind") return "text-amber-800";
  return "text-zinc-800";
}

export function WindDirectionIndicator({
  windDirectionDeg,
  windRelative,
  className,
  variant = "inline",
}: WindDirectionIndicatorProps) {
  const t = useTranslations("roadbook.weather");
  const { deg, compassKey } = getWindDirectionParts(windDirectionDeg);
  const direction = t(compassKey);
  const label = formatWindDirection(
    windDirectionDeg,
    (key) => t(key),
    (values) => t("windDirectionLabel", values),
  );
  const aria = t("windFromAria", { direction, deg });

  if (variant === "stacked") {
    return (
      <span
        className={cn("inline-flex flex-col leading-tight", windTextColor(windRelative), className)}
        title={aria}
        aria-label={aria}
      >
        <span className="font-medium">{direction}</span>
        <span className="text-xs text-zinc-500">{t("windDirectionDegrees", { deg })}</span>
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex font-medium leading-snug", windTextColor(windRelative), className)}
      title={aria}
      aria-label={aria}
    >
      {label}
    </span>
  );
}
