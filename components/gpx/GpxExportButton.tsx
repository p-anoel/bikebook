"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildGpxDocument, sanitizeGpxFilename } from "@/lib/gpx/export";
import { downloadGpxFile } from "@/lib/gpx/download";
import type { Roadbook } from "@/types/roadbook";

interface GpxExportButtonProps {
  roadbook: Roadbook;
}

export function GpxExportButton({ roadbook }: GpxExportButtonProps) {
  const t = useTranslations("roadbook");

  const handleExport = useCallback(() => {
    const gpxXml = buildGpxDocument({
      name: roadbook.name,
      track: roadbook.track,
      pois: roadbook.pois,
    });
    downloadGpxFile(sanitizeGpxFilename(roadbook.name), gpxXml);
  }, [roadbook]);

  return (
    <Button type="button" variant="outline" onClick={handleExport} className="w-full sm:w-auto">
      <Download className="h-4 w-4" aria-hidden="true" />
      {t("exportGpx")}
    </Button>
  );
}
