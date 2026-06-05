"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Scissors, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildStageView } from "@/lib/gpx/stage-slice";
import {
  DEFAULT_TARGET_KM_PER_DAY,
  splitStagesByTargetKm,
} from "@/lib/gpx/stage-split";
import { formatDistance, formatElevation } from "@/lib/utils";
import type { Multitour } from "@/types/roadbook";

interface StageSplitDialogProps {
  roadbook: Multitour;
  open: boolean;
  onClose: () => void;
  onConfirm: (targetKmPerDay: number) => void;
}

export function StageSplitDialog({
  roadbook,
  open,
  onClose,
  onConfirm,
}: StageSplitDialogProps) {
  const t = useTranslations("roadbook.stages.split");
  const locale = useLocale();
  const [targetKm, setTargetKm] = useState(String(DEFAULT_TARGET_KM_PER_DAY));

  const previewStages = useMemo(() => {
    const km = Number.parseFloat(targetKm);
    if (!Number.isFinite(km) || km <= 0) return [];
    const stages = splitStagesByTargetKm(roadbook.track, km);
    return stages.map((stage, index) => {
      const view = buildStageView(
        { ...roadbook, stages: splitStagesByTargetKm(roadbook.track, km) },
        index,
      );
      return view;
    });
  }, [roadbook, targetKm]);

  const handleConfirm = useCallback(() => {
    const km = Number.parseFloat(targetKm);
    if (!Number.isFinite(km) || km <= 0) return;
    onConfirm(km);
    onClose();
  }, [onClose, onConfirm, targetKm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-split-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="stage-split-title" className="text-lg font-semibold text-zinc-900">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">{t("description")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
            aria-label={t("cancel")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <label className="block text-sm font-medium text-zinc-700" htmlFor="target-km">
          {t("targetKmLabel")}
        </label>
        <input
          id="target-km"
          type="number"
          min={10}
          max={500}
          step={5}
          value={targetKm}
          onChange={(e) => setTargetKm(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
        />

        {previewStages.length > 1 ? (
          <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-zinc-100">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2">{t("previewStage")}</th>
                  <th className="px-3 py-2">{t("previewDistance")}</th>
                  <th className="px-3 py-2">{t("previewGain")}</th>
                </tr>
              </thead>
              <tbody>
                {previewStages.map((view) => (
                  <tr key={view.stage.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-medium">
                      {t("stageNumber", { number: view.index + 1 })}
                    </td>
                    <td className="px-3 py-2">
                      {formatDistance(view.stats.distanceKm, locale)} km
                    </td>
                    <td className="px-3 py-2">
                      {formatElevation(view.stats.elevationGainM, locale)} m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={previewStages.length <= 1}
          >
            <Scissors className="h-4 w-4" aria-hidden="true" />
            {t("confirm", { count: previewStages.length })}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface StageSplitPromptProps {
  roadbook: Multitour;
  onSplit: () => void;
  onDismiss: () => void;
}

export function StageSplitPrompt({
  roadbook,
  onSplit,
  onDismiss,
}: StageSplitPromptProps) {
  const t = useTranslations("roadbook.stages.split");

  if (roadbook.stages.length > 1) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-amber-900">{t("longRouteHint")}</p>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onDismiss}>
          {t("skip")}
        </Button>
        <Button type="button" size="sm" onClick={onSplit}>
          <Scissors className="h-4 w-4" aria-hidden="true" />
          {t("openSplit")}
        </Button>
      </div>
    </div>
  );
}
