"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildGpxDocument,
  buildStageGpxDocument,
  sanitizeGpxFilename,
  stageGpxFilename,
} from "@/lib/gpx/export";
import { downloadGpxFile } from "@/lib/gpx/download";
import type { Multitour } from "@/types/roadbook";
import { cn } from "@/lib/utils";

interface GpxExportButtonProps {
  roadbook: Multitour;
}

export function GpxExportButton({ roadbook }: GpxExportButtonProps) {
  const t = useTranslations("roadbook");
  const tStages = useTranslations("roadbook.stages");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const multiStage = roadbook.stages.length > 1;

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const stageLabel = useCallback(
    (index: number) => tStages("stageLabel", { number: index + 1 }),
    [tStages],
  );

  const handleExportFull = useCallback(() => {
    const gpxXml = buildGpxDocument({
      name: roadbook.name,
      track: roadbook.track,
      pois: roadbook.pois,
    });
    downloadGpxFile(sanitizeGpxFilename(roadbook.name), gpxXml);
    setOpen(false);
  }, [roadbook]);

  const handleExportStage = useCallback(
    (stageIndex: number) => {
      const label = stageLabel(stageIndex);
      const gpxXml = buildStageGpxDocument(roadbook, stageIndex, label);
      downloadGpxFile(
        stageGpxFilename(roadbook.name, stageIndex, label),
        gpxXml,
      );
      setOpen(false);
    },
    [roadbook, stageLabel],
  );

  const handleExportAllStages = useCallback(() => {
    for (let i = 0; i < roadbook.stages.length; i += 1) {
      const label = stageLabel(i);
      const gpxXml = buildStageGpxDocument(roadbook, i, label);
      downloadGpxFile(stageGpxFilename(roadbook.name, i, label), gpxXml);
    }
    setOpen(false);
  }, [roadbook, stageLabel]);

  if (!multiStage) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={handleExportFull}
        className="w-full sm:w-auto"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {t("exportGpx")}
      </Button>
    );
  }

  return (
    <div ref={menuRef} className="relative w-full sm:w-auto">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-full sm:w-auto"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {t("exportGpx")}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[14rem] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
            onClick={handleExportFull}
          >
            {tStages("exportFullGpx")}
          </button>
          <div className="my-1 border-t border-zinc-100" />
          {roadbook.stages.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
              onClick={() => handleExportStage(index)}
            >
              {stage.name?.trim() || stageLabel(index)}
            </button>
          ))}
          <div className="my-1 border-t border-zinc-100" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            onClick={handleExportAllStages}
          >
            {tStages("exportAllStages")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
