"use client";

import { useState, useCallback, useMemo } from "react";
import { pdf } from "@react-pdf/renderer";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoadbookPdf, PDF_MAP_HEIGHT, PDF_MAP_WIDTH, type PdfMessages } from "@/components/pdf/RoadbookPdf";
import type { PdfWeatherMessages } from "@/components/pdf/WeatherPdfSection";
import { buildMapOverlay } from "@/lib/pdf/map-overlay";
import type { RouteWeatherSnapshot } from "@/lib/weather/types";
import {
  expandBounds,
  pdfMapDisplaySize,
  type MapProjectionMeta,
} from "@/lib/pdf/geo-bounds";
import type { Roadbook } from "@/types/roadbook";

interface PdfExportButtonProps {
  roadbook: Roadbook;
  locale: string;
  /** Client weather state from WeatherPanel; omit to exclude the weather section. */
  weatherSnapshot?: RouteWeatherSnapshot | null;
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

export function PdfExportButton({
  roadbook,
  locale,
  weatherSnapshot,
}: PdfExportButtonProps) {
  const t = useTranslations("common");
  const tPdf = useTranslations("pdf");
  const tRoadbook = useTranslations("roadbook");
  const tWeather = useTranslations("roadbook.weather");
  const [isExporting, setIsExporting] = useState(false);

  const weatherFmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );

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

      const formatWeatherNum = (n: number) => weatherFmt.format(n);

      const weatherMessages: PdfWeatherMessages | undefined =
        weatherSnapshot !== undefined
          ? {
              section: tPdf("weatherSection"),
              notLoaded: tPdf("weatherNotLoaded"),
              ridePlanTitle: tPdf("weather.ridePlanTitle"),
              summaryTitle: tPdf("weather.summaryTitle"),
              departure: tWeather("departureLabel"),
              arrival: tWeather("summary.arrival"),
              plannedSpeed: tWeather("summary.plannedSpeed"),
              pause: tWeather("summary.pause"),
              dominant: tWeather("summary.dominant"),
              avgWind: tWeather("summary.avgWind"),
              temp: tWeather("summary.temp"),
              precip: tWeather("summary.precip"),
              windSpeed: (speed) =>
                tWeather("windSpeed", { speed: formatWeatherNum(speed) }),
              windComponent: (value) =>
                tWeather("windComponent", { value: formatWeatherNum(value) }),
              temperature: (value) =>
                tWeather("temperature", { value: formatWeatherNum(value) }),
              precipitation: (value) =>
                tWeather("precipitation", { value: formatWeatherNum(value) }),
              tempRange: (min, max) =>
                tWeather("tempRange", {
                  min: formatWeatherNum(min),
                  max: formatWeatherNum(max),
                }),
              pauseSummary: (minutes) => tWeather("pauseSummary", { minutes }),
              windRelative: {
                headwind: tWeather("windRelative.headwind"),
                tailwind: tWeather("windRelative.tailwind"),
                crosswind: tWeather("windRelative.crosswind"),
              },
              weatherCode: {
                clear: tWeather("weatherCode.clear"),
                mainlyClear: tWeather("weatherCode.mainlyClear"),
                partlyCloudy: tWeather("weatherCode.partlyCloudy"),
                overcast: tWeather("weatherCode.overcast"),
                fog: tWeather("weatherCode.fog"),
                drizzle: tWeather("weatherCode.drizzle"),
                rain: tWeather("weatherCode.rain"),
                snow: tWeather("weatherCode.snow"),
                thunderstorm: tWeather("weatherCode.thunderstorm"),
                unknown: tWeather("weatherCode.unknown"),
              },
              columns: {
                number: tWeather("columns.number"),
                km: tWeather("columns.km"),
                passage: tWeather("columns.passage"),
                wind: tWeather("columns.wind"),
                speed: tWeather("columns.speed"),
                component: tWeather("columns.component"),
                temp: tWeather("columns.temp"),
                precip: tWeather("columns.precip"),
                sky: tWeather("columns.sky"),
              },
            }
          : undefined;

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
          weatherSnapshot={weatherSnapshot}
          weatherMessages={weatherMessages}
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
  }, [roadbook, locale, mapDisplaySize, tPdf, tRoadbook, tWeather, weatherSnapshot, weatherFmt]);

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
