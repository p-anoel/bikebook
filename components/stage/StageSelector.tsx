"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface StageSelectorProps {
  stageCount: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function StageSelector({
  stageCount,
  activeIndex,
  onSelect,
}: StageSelectorProps) {
  const t = useTranslations("roadbook.stages");

  if (stageCount <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-zinc-700">{t("title")}</span>
      <div
        role="tablist"
        aria-label={t("title")}
        className="flex flex-wrap gap-1"
      >
        {Array.from({ length: stageCount }, (_, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(index)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
              )}
            >
              {t("stageLabel", { number: index + 1 })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
