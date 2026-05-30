"use client";

import { useState, useCallback, useMemo } from "react";
import { pdf } from "@react-pdf/renderer";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoadbookPdf, PDF_MAP_HEIGHT, PDF_MAP_WIDTH, type PdfMessages } from "@/components/pdf/RoadbookPdf";
import { buildMapOverlay } from "@/lib/pdf/map-overlay";
import {
  expandBounds,
  pdfMapDisplaySize,
  type MapProjectionMeta,
} from "@/lib/pdf/geo-bounds";
import type { Roadbook } from "@/types/roadbook";

interface PdfExportButtonProps {
  roadbook: Roadbook;
  locale: string;
}

/** @deprecated import PDF_MAP_WIDTH / PDF_MAP_HEIGHT from RoadbookPdf */
export const PDF_MAP_MAX_WIDTH = PDF_MAP_WIDTH;
export const PDF_MAP_MAX_HEIGHT = PDF_MAP_HEIGHT;

interface StaticMapResponse {
  image?: string;
  projection?: MapProjectionMeta;
}

async function fetchStaticMap(
  roadbook: Roadbook,
  displayWidth: number,
  displayHeight: number,
): Promise<StaticMapResponse> {
  const [[swLat, swLng], [neLat, neLng]] = roadbook.bounds;
  const params = new URLSearchParams({
    swLat: String(swLat),
    swLng: String(swLng),
    neLat: String(neLat),
    neLng: String(neLng),
    w: String(Math.round(displayWidth)),
    h: String(Math.round(displayHeight)),
    format: "json",
  });

  const response = await fetch(`/api/map/static?${params.toString()}`);
  if (!response.ok) return {};

  return (await response.json()) as StaticMapResponse;
}

export function PdfExportButton({ roadbook, locale }: PdfExportButtonProps) {
  const t = useTranslations("common");
  const tPdf = useTranslations("pdf");
  const tRoadbook = useTranslations("roadbook");
  const [isExporting, setIsExporting] = useState(false);

  const mapDisplaySize = useMemo(() => {
    const geoBounds = expandBounds(roadbook.bounds, 0.05);
    return pdfMapDisplaySize(geoBounds, PDF_MAP_MAX_WIDTH, PDF_MAP_MAX_HEIGHT);
  }, [roadbook.bounds]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const generatedDate = new Date().toLocaleDateString(locale, {
        dateStyle: "long",
      });

      const messages: PdfMessages = {
        title: tPdf("title"),
        generatedAt: tPdf("generatedAt", { date: generatedDate }),
        statsSection: tPdf("statsSection"),
        poiSection: tPdf("poiSection"),
        profileSection: tPdf("profileSection"),
        profileDetailSection: tPdf("profileDetailSection"),
        mapSection: tPdf("mapSection"),
        km: tPdf("km"),
        m: tPdf("m"),
        stats: {
          distance: tRoadbook("stats.distance"),
          elevationGain: tRoadbook("stats.elevationGain"),
          elevationLoss: tRoadbook("stats.elevationLoss"),
          minElevation: tRoadbook("stats.minElevation"),
          maxElevation: tRoadbook("stats.maxElevation"),
        },
        poiColumns: {
          number: tPdf("poiColumns.number"),
          name: tPdf("poiColumns.name"),
          kilometrage: tPdf("poiColumns.kilometrage"),
          interval: tPdf("poiColumns.interval"),
          cumulativeGain: tPdf("poiColumns.cumulativeGain"),
          intervalGain: tPdf("poiColumns.intervalGain"),
          elevation: tPdf("poiColumns.elevation"),
          description: tPdf("poiColumns.description"),
        },
        climbsSection: tPdf("climbsSection"),
        climbColumns: {
          number: tPdf("climbColumns.number"),
          start: tPdf("climbColumns.start"),
          gain: tPdf("climbColumns.gain"),
          length: tPdf("climbColumns.length"),
          grade: tPdf("climbColumns.grade"),
        },
        markers: {
          start: tRoadbook("markers.start"),
          finish: tRoadbook("markers.finish"),
        },
        seaLevel: tRoadbook("profile.seaLevel"),
      };

      const { image: mapImageSrc, projection: mapProjection } = await fetchStaticMap(
        roadbook,
        mapDisplaySize.width,
        mapDisplaySize.height,
      );

      const mapOverlay =
        mapImageSrc && mapProjection
          ? buildMapOverlay(roadbook.track, roadbook.pois, mapProjection)
          : undefined;

      const blob = await pdf(
        <RoadbookPdf
          roadbook={roadbook}
          locale={locale}
          messages={messages}
          mapImageSrc={mapImageSrc}
          mapOverlay={mapOverlay}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${roadbook.name.replace(/[^a-z0-9-_]/gi, "_")}-roadbook.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [roadbook, locale, mapDisplaySize, tPdf, tRoadbook]);

  return (
    <Button
      type="button"
      onClick={() => void handleExport()}
      disabled={isExporting}
      className="w-full sm:w-auto"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {isExporting ? t("exporting") : t("export")}
    </Button>
  );
}
