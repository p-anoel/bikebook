"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrackMapClient } from "@/components/map/TrackMapClient";
import { ElevationProfile } from "@/components/elevation/ElevationProfile";
import { PoiList } from "@/components/poi/PoiList";
import { WeatherPanel } from "@/components/weather/WeatherPanel";
import { PdfExportButton } from "@/components/pdf/PdfExportButton";
import { useRoadbookStore } from "@/lib/store/roadbook-store";
import type { RouteWeatherSnapshot } from "@/lib/weather/types";
import { formatDistance, formatElevation } from "@/lib/utils";

export default function RoadbookPage() {
  const t = useTranslations("roadbook");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const roadbook = useRoadbookStore((state) => state.roadbook);
  const [hydrated, setHydrated] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null);
  const [weatherSnapshot, setWeatherSnapshot] = useState<RouteWeatherSnapshot | null>(null);
  const [selectedWeatherSegmentId, setSelectedWeatherSegmentId] = useState<number | null>(null);
  const [hoveredWeatherSegmentId, setHoveredWeatherSegmentId] = useState<number | null>(null);

  useEffect(() => {
    useRoadbookStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  useEffect(() => {
    setSelectedPoiId(null);
    setHoveredPoiId(null);
    setWeatherSnapshot(null);
    setSelectedWeatherSegmentId(null);
    setHoveredWeatherSegmentId(null);
  }, [roadbook?.id]);

  const handlePoiSelect = useCallback((poiId: string | null) => {
    setSelectedPoiId((current) => {
      if (poiId === null) return null;
      return current === poiId ? null : poiId;
    });
  }, []);

  const handlePoiHover = useCallback((poiId: string | null) => {
    setHoveredPoiId((current) => (current === poiId ? current : poiId));
  }, []);

  const handleWeatherLoaded = useCallback((snapshot: RouteWeatherSnapshot | null) => {
    setWeatherSnapshot(snapshot);
  }, []);

  const handleWeatherSegmentSelect = useCallback((segmentId: number | null) => {
    setSelectedWeatherSegmentId((current) => {
      if (segmentId === null) return null;
      return current === segmentId ? null : segmentId;
    });
  }, []);

  const handleWeatherSegmentHover = useCallback((segmentId: number | null) => {
    setHoveredWeatherSegmentId((current) => (current === segmentId ? current : segmentId));
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (!roadbook) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-zinc-600">{t("noData")}</p>
        <p className="mt-6">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t("goUpload")}
          </Link>
        </p>
      </div>
    );
  }

  const stats = [
    {
      label: t("stats.distance"),
      value: `${formatDistance(roadbook.stats.distanceKm, locale)} km`,
    },
    {
      label: t("stats.elevationGain"),
      value: `${formatElevation(roadbook.stats.elevationGainM, locale)} m`,
    },
    {
      label: t("stats.elevationLoss"),
      value: `${formatElevation(roadbook.stats.elevationLossM, locale)} m`,
    },
    {
      label: t("stats.minElevation"),
      value: `${formatElevation(roadbook.stats.minElevationM, locale)} m`,
    },
    {
      label: t("stats.maxElevation"),
      value: `${formatElevation(roadbook.stats.maxElevationM, locale)} m`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/"
            className="mb-2 inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 sm:px-3"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            {tCommon("back")}
          </Link>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{roadbook.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("title")}</p>
        </div>
        <div className="shrink-0">
          <PdfExportButton roadbook={roadbook} locale={locale} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:flex sm:flex-wrap">
        {stats.map((stat) => (
          <Badge key={stat.label} className="justify-center px-2 py-1.5 text-xs sm:px-3 sm:text-sm">
            <span className="text-zinc-500">{stat.label}:</span>&nbsp;
            <span className="font-semibold text-zinc-900">{stat.value}</span>
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("mapTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrackMapClient
              track={roadbook.track}
              pois={roadbook.pois}
              bounds={roadbook.bounds}
              locale={locale}
              selectedPoiId={selectedPoiId}
              hoveredPoiId={hoveredPoiId}
              onPoiSelect={handlePoiSelect}
              onPoiHover={handlePoiHover}
              weatherSegments={weatherSnapshot?.segments ?? []}
              selectedWeatherSegmentId={selectedWeatherSegmentId}
              hoveredWeatherSegmentId={hoveredWeatherSegmentId}
              onWeatherSegmentSelect={handleWeatherSegmentSelect}
              onWeatherSegmentHover={handleWeatherSegmentHover}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("elevationTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ElevationProfile
              track={roadbook.track}
              pois={roadbook.pois}
              locale={locale}
              selectedPoiId={selectedPoiId}
              hoveredPoiId={hoveredPoiId}
              onPoiSelect={handlePoiSelect}
              onPoiHover={handlePoiHover}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("poiTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PoiList
              track={roadbook.track}
              pois={roadbook.pois}
              locale={locale}
              selectedPoiId={selectedPoiId}
              hoveredPoiId={hoveredPoiId}
              onSelect={handlePoiSelect}
              onHover={handlePoiHover}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("weather.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <WeatherPanel
              track={roadbook.track}
              locale={locale}
              onWeatherLoaded={handleWeatherLoaded}
              selectedSegmentId={selectedWeatherSegmentId}
              hoveredSegmentId={hoveredWeatherSegmentId}
              onSelectSegment={handleWeatherSegmentSelect}
              onHoverSegment={handleWeatherSegmentHover}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
