"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { TrackMapClient } from "@/components/map/TrackMapClient";
import { ElevationProfile } from "@/components/elevation/ElevationProfile";
import { PoiList } from "@/components/poi/PoiList";
import { PoiManager, type MapPoiPlaceHandler } from "@/components/poi/PoiManager";
import { RoadbookSection } from "@/components/roadbook/RoadbookSection";
import { WeatherPanel } from "@/components/weather/WeatherPanel";
import { GpxExportButton } from "@/components/gpx/GpxExportButton";
import { PdfExportButton } from "@/components/pdf/PdfExportButton";
import { StageSelector } from "@/components/stage/StageSelector";
import {
  StageSplitDialog,
  StageSplitPrompt,
} from "@/components/stage/StageSplitDialog";
import { useActiveStageView, useRoadbookStore } from "@/lib/store/roadbook-store";
import { isLongRoute } from "@/lib/gpx/stage-split";
import {
  createPoiFromOsmCityLimit,
  createPoiFromOsmWater,
  isOsmCityLimitAlreadyAdded,
  isOsmWaterAlreadyAdded,
} from "@/lib/gpx/poi-manage";
import {
  osmCityLimitPoiNameAndDescription,
  translateCityLimitDisplay,
} from "@/lib/osm/city-limit-display";
import { parseCityLimitSignName, type OsmCityLimitSign } from "@/lib/osm/city-limit-signs";
import {
  osmWaterPoiNameAndDescription,
  translateWaterPointDisplay,
} from "@/lib/osm/water-display";
import type { OsmWaterPoint } from "@/lib/osm/water-points";
import type { RouteWeatherSnapshot } from "@/lib/weather/types";
import { formatDistance, formatElevation } from "@/lib/utils";

export default function RoadbookPage() {
  const t = useTranslations("roadbook");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const roadbook = useRoadbookStore((state) => state.roadbook);
  const activeStageIndex = useRoadbookStore((state) => state.activeStageIndex);
  const setActiveStageIndex = useRoadbookStore((state) => state.setActiveStageIndex);
  const splitByTargetKm = useRoadbookStore((state) => state.splitByTargetKm);
  const stageView = useActiveStageView();
  const [hydrated, setHydrated] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null);
  const [weatherSnapshot, setWeatherSnapshot] = useState<RouteWeatherSnapshot | null>(null);
  const [selectedWeatherSegmentId, setSelectedWeatherSegmentId] = useState<number | null>(null);
  const [hoveredWeatherSegmentId, setHoveredWeatherSegmentId] = useState<number | null>(null);
  const [poiAddMode, setPoiAddMode] = useState(false);
  const [waterPoints, setWaterPoints] = useState<OsmWaterPoint[]>([]);
  const [hoveredWaterPointId, setHoveredWaterPointId] = useState<string | null>(null);
  const [cityLimitSigns, setCityLimitSigns] = useState<OsmCityLimitSign[]>([]);
  const [hoveredCityLimitId, setHoveredCityLimitId] = useState<string | null>(null);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitPromptDismissed, setSplitPromptDismissed] = useState(false);
  const mapPoiPlaceRef = useRef<MapPoiPlaceHandler | null>(null);
  const addPoi = useRoadbookStore((state) => state.addPoi);
  const removePoi = useRoadbookStore((state) => state.removePoi);
  const tWater = useTranslations("roadbook.poiManage.water");
  const tCityLimit = useTranslations("roadbook.poiManage.cityLimit");

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
    setPoiAddMode(false);
    setWaterPoints([]);
    setHoveredWaterPointId(null);
    setCityLimitSigns([]);
    setHoveredCityLimitId(null);
    setSplitPromptDismissed(false);
  }, [roadbook?.id]);

  const addedOsmWaterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const poi of roadbook?.pois ?? []) {
      if (poi.osmId && poi.source !== "osm-city-limit") ids.add(poi.osmId);
    }
    return ids;
  }, [roadbook?.pois]);

  const addedOsmCityLimitIds = useMemo(() => {
    const ids = new Set<string>();
    for (const poi of roadbook?.pois ?? []) {
      if (poi.osmId && poi.source === "osm-city-limit") ids.add(poi.osmId);
    }
    return ids;
  }, [roadbook?.pois]);

  const handlePoiSelect = useCallback((poiId: string | null) => {
    setSelectedPoiId((current) => {
      if (poiId === null) return null;
      return current === poiId ? null : poiId;
    });
  }, []);

  const handlePoiHover = useCallback((poiId: string | null) => {
    setHoveredPoiId((current) => (current === poiId ? current : poiId));
  }, []);

  const handlePoiEdit = useCallback((poiId: string) => {
    setSelectedPoiId(poiId);
    setPoiAddMode(false);
    requestAnimationFrame(() => {
      document.getElementById("poi-manage-form")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }, []);

  const handlePoiDelete = useCallback(
    (poiId: string) => {
      removePoi(poiId);
      setSelectedPoiId((current) => (current === poiId ? null : current));
    },
    [removePoi],
  );

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

  const handlePlaceOnMap = useCallback((handler: MapPoiPlaceHandler | null) => {
    mapPoiPlaceRef.current = handler;
  }, []);

  const handleMapPoiPlace = useCallback((lat: number, lng: number) => {
    mapPoiPlaceRef.current?.(lat, lng);
  }, []);

  const handleWaterPointSelect = useCallback(
    (point: OsmWaterPoint) => {
      if (!roadbook || isOsmWaterAlreadyAdded(roadbook.pois, point.id)) return;

      const labels = translateWaterPointDisplay(point.tags, tWater);
      const { name, description } = osmWaterPoiNameAndDescription(
        point.name,
        labels,
        tWater("defaultName"),
      );

      const poi = createPoiFromOsmWater(
        roadbook.track,
        {
          lat: point.lat,
          lng: point.lng,
          name,
          description,
          osmId: point.id,
        },
        tWater("defaultName"),
        roadbook.pois,
      );

      if (!poi) return;

      addPoi(poi);
      setSelectedPoiId(poi.id);
    },
    [addPoi, roadbook, tWater],
  );

  const handleWaterPointHover = useCallback((osmId: string | null) => {
    setHoveredWaterPointId((current) => (current === osmId ? current : osmId));
  }, []);

  const handleCityLimitSelect = useCallback(
    (sign: OsmCityLimitSign) => {
      if (!roadbook || isOsmCityLimitAlreadyAdded(roadbook.pois, sign.id)) return;

      const labels = translateCityLimitDisplay(sign.tags, tCityLimit);
      const communeName = sign.name ?? parseCityLimitSignName(sign.tags);
      const { name, description } = osmCityLimitPoiNameAndDescription(
        communeName,
        labels,
        tCityLimit,
        tCityLimit("defaultName"),
      );

      const poi = createPoiFromOsmCityLimit(
        roadbook.track,
        {
          lat: sign.lat,
          lng: sign.lng,
          name,
          description,
          osmId: sign.id,
        },
        tCityLimit("defaultName"),
        roadbook.pois,
      );

      if (!poi) return;

      addPoi(poi);
      setSelectedPoiId(poi.id);
    },
    [addPoi, roadbook, tCityLimit],
  );

  const handleCityLimitHover = useCallback((osmId: string | null) => {
    setHoveredCityLimitId((current) => (current === osmId ? current : osmId));
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (!roadbook || !stageView) {
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

  const multiStage = roadbook.stages.length > 1;
  const displayStats = multiStage ? stageView.stats : roadbook.stats;
  const displayTrack = stageView.track;
  const displayPois = stageView.pois;
  const displayBounds = stageView.bounds;

  const showSplitPrompt =
    !splitPromptDismissed &&
    !multiStage &&
    isLongRoute(roadbook.stats.distanceKm);

  const stats = [
    {
      label: multiStage ? t("stages.statsStage") : t("stats.distance"),
      value: `${formatDistance(displayStats.distanceKm, locale)} km`,
    },
    {
      label: t("stats.elevationGain"),
      value: `${formatElevation(displayStats.elevationGainM, locale)} m`,
    },
    {
      label: t("stats.elevationLoss"),
      value: `${formatElevation(displayStats.elevationLossM, locale)} m`,
    },
    {
      label: t("stats.minElevation"),
      value: `${formatElevation(displayStats.minElevationM, locale)} m`,
    },
    {
      label: t("stats.maxElevation"),
      value: `${formatElevation(displayStats.maxElevationM, locale)} m`,
    },
  ];

  if (multiStage) {
    stats.unshift({
      label: t("stages.statsGlobal"),
      value: `${formatDistance(roadbook.stats.distanceKm, locale)} km`,
    });
  }

  const poiManagerProps = {
    track: roadbook.track,
    pois: displayPois,
    selectedPoiId,
    addMode: poiAddMode,
    onAddModeChange: setPoiAddMode,
    onSelect: handlePoiSelect,
    onPlaceOnMap: handlePlaceOnMap,
    waterPoints,
    onWaterPointsChange: setWaterPoints,
    hoveredWaterPointId,
    onWaterPointHover: handleWaterPointHover,
    cityLimitSigns,
    onCityLimitSignsChange: setCityLimitSigns,
    hoveredCityLimitId,
    onCityLimitHover: handleCityLimitHover,
  };

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
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <GpxExportButton roadbook={roadbook} />
          <PdfExportButton
            roadbook={roadbook}
            locale={locale}
            weatherSnapshot={weatherSnapshot}
          />
        </div>
      </div>

      {showSplitPrompt ? (
        <StageSplitPrompt
          roadbook={roadbook}
          onSplit={() => setSplitDialogOpen(true)}
          onDismiss={() => setSplitPromptDismissed(true)}
        />
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StageSelector
          stageCount={roadbook.stages.length}
          activeIndex={activeStageIndex}
          onSelect={setActiveStageIndex}
        />
        {!multiStage && roadbook.stats.distanceKm > 50 ? (
          <button
            type="button"
            onClick={() => setSplitDialogOpen(true)}
            className="text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            {t("stages.split.manageSplit")}
          </button>
        ) : null}
      </div>

      <StageSplitDialog
        roadbook={roadbook}
        open={splitDialogOpen}
        onClose={() => setSplitDialogOpen(false)}
        onConfirm={splitByTargetKm}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:flex sm:flex-wrap">
        {stats.map((stat) => (
          <Badge key={stat.label} className="justify-center px-2 py-1.5 text-xs sm:px-3 sm:text-sm">
            <span className="text-zinc-500">{stat.label}:</span>&nbsp;
            <span className="font-semibold text-zinc-900">{stat.value}</span>
          </Badge>
        ))}
      </div>

      <div className="space-y-4 sm:space-y-5">
        <RoadbookSection
          title={t("sections.route")}
          description={t("sections.routeDesc")}
          defaultOpen
          storageKey="bikebook-roadbook-section-route"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-zinc-700">{t("mapTitle")}</h3>
            <TrackMapClient
              track={displayTrack}
              pois={displayPois}
              bounds={displayBounds}
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
              addPoiMode={poiAddMode}
              onMapPoiPlace={handleMapPoiPlace}
              waterPoints={waterPoints}
              addedOsmWaterIds={addedOsmWaterIds}
              hoveredWaterPointId={hoveredWaterPointId}
              onWaterPointSelect={handleWaterPointSelect}
              onWaterPointHover={handleWaterPointHover}
              cityLimitSigns={cityLimitSigns}
              addedOsmCityLimitIds={addedOsmCityLimitIds}
              hoveredCityLimitId={hoveredCityLimitId}
              onCityLimitSelect={handleCityLimitSelect}
              onCityLimitHover={handleCityLimitHover}
            />
          </div>

          <div className="space-y-1 border-t border-zinc-100 pt-4">
            <h3 className="text-sm font-medium text-zinc-700">{t("elevationTitle")}</h3>
            <ElevationProfile
              track={displayTrack}
              pois={displayPois}
              locale={locale}
              selectedPoiId={selectedPoiId}
              hoveredPoiId={hoveredPoiId}
              onPoiSelect={handlePoiSelect}
              onPoiHover={handlePoiHover}
            />
          </div>
        </RoadbookSection>

        <RoadbookSection
          title={t("sections.poi")}
          description={t("sections.poiDesc")}
          defaultOpen
          storageKey="bikebook-roadbook-section-poi"
        >
          <div className="space-y-4">
            <RoadbookSection
              nested
              title={t("sections.poiManual")}
              description={t("sections.poiManualDesc")}
              defaultOpen
              storageKey="bikebook-roadbook-section-poi-manual"
            >
              <PoiManager {...poiManagerProps} variant="manual" />
              <PoiList
                track={displayTrack}
                pois={displayPois}
                locale={locale}
                selectedPoiId={selectedPoiId}
                hoveredPoiId={hoveredPoiId}
                onSelect={handlePoiSelect}
                onHover={handlePoiHover}
                onEdit={handlePoiEdit}
                onDelete={handlePoiDelete}
              />
            </RoadbookSection>

            <RoadbookSection
              nested
              title={t("sections.poiWater")}
              defaultOpen
              storageKey="bikebook-roadbook-section-poi-water"
            >
              <PoiManager {...poiManagerProps} variant="water" />
            </RoadbookSection>

            <RoadbookSection
              nested
              title={t("sections.poiCityLimit")}
              defaultOpen
              storageKey="bikebook-roadbook-section-poi-city-limit"
            >
              <PoiManager {...poiManagerProps} variant="cityLimit" />
            </RoadbookSection>
          </div>
        </RoadbookSection>

        <RoadbookSection
          title={t("sections.weather")}
          description={t("sections.weatherDesc")}
          defaultOpen={false}
          storageKey="bikebook-roadbook-section-weather"
        >
          <WeatherPanel
            track={displayTrack}
            locale={locale}
            onWeatherLoaded={handleWeatherLoaded}
            selectedSegmentId={selectedWeatherSegmentId}
            hoveredSegmentId={hoveredWeatherSegmentId}
            onSelectSegment={handleWeatherSegmentSelect}
            onHoverSegment={handleWeatherSegmentHover}
          />
        </RoadbookSection>
      </div>
    </div>
  );
}
