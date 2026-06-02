"use client";

import { useCallback, useEffect, useState } from "react";
import { Droplets, Check, MapPin, Pencil, Plus, Signpost, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  createPoiAtDistance,
  createPoiFromMapClick,
  createPoiFromOsmCityLimit,
  createPoiFromOsmWater,
  findPoiByOsmId,
  isOsmCityLimitAlreadyAdded,
  isOsmWaterAlreadyAdded,
  snapLatLngToTrack,
} from "@/lib/gpx/poi-manage";
import {
  formatCityLimitDisplayTitle,
  osmCityLimitPoiNameAndDescription,
  translateCityLimitDisplay,
} from "@/lib/osm/city-limit-display";
import {
  CITY_LIMIT_ON_TRACK_MAX_M,
  fetchCityLimitSignsForTrack,
  parseCityLimitSignName,
  type OsmCityLimitSign,
} from "@/lib/osm/city-limit-signs";
import {
  osmWaterPoiNameAndDescription,
  translateWaterPointDisplay,
} from "@/lib/osm/water-display";
import { fetchWaterPointsForTrack, type OsmWaterPoint } from "@/lib/osm/water-points";
import { useRoadbookStore } from "@/lib/store/roadbook-store";
import type { Poi, TrackPoint } from "@/types/roadbook";

export type MapPoiPlaceHandler = (lat: number, lng: number) => void;

export type PoiManagerVariant = "all" | "manual" | "water" | "cityLimit";

interface PoiManagerProps {
  track: TrackPoint[];
  pois: Poi[];
  selectedPoiId: string | null;
  addMode: boolean;
  onAddModeChange: (enabled: boolean) => void;
  onSelect: (poiId: string | null) => void;
  onPlaceOnMap: (handler: MapPoiPlaceHandler | null) => void;
  waterPoints: OsmWaterPoint[];
  onWaterPointsChange: (points: OsmWaterPoint[]) => void;
  hoveredWaterPointId?: string | null;
  onWaterPointHover?: (osmId: string | null) => void;
  cityLimitSigns: OsmCityLimitSign[];
  onCityLimitSignsChange: (signs: OsmCityLimitSign[]) => void;
  hoveredCityLimitId?: string | null;
  onCityLimitHover?: (osmId: string | null) => void;
  variant?: PoiManagerVariant;
}

const inputClassName =
  "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900";

type OsmPoiRowTheme = "water" | "cityLimit";

interface OsmPoiRowActionsProps {
  added: boolean;
  inMyPoisLabel: string;
  addToMyPoisLabel: string;
  removeFromMyPoisLabel: string;
  onAdd: () => void;
  onRemove: () => void;
}

function OsmPoiRowActions({
  added,
  inMyPoisLabel,
  addToMyPoisLabel,
  removeFromMyPoisLabel,
  onAdd,
  onRemove,
}: OsmPoiRowActionsProps) {
  if (added) {
    return (
      <div className="flex shrink-0 items-center gap-1 pr-1">
        <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {inMyPoisLabel}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 px-2 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {removeFromMyPoisLabel}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="mr-1 h-8 shrink-0 px-2 text-xs"
      onClick={(event) => {
        event.stopPropagation();
        onAdd();
      }}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      {addToMyPoisLabel}
    </Button>
  );
}

function osmPoiRowShellClassName(
  theme: OsmPoiRowTheme,
  options: { added: boolean; selected: boolean; hovered: boolean },
): string {
  const { added, selected, hovered } = options;
  const accent =
    theme === "water"
      ? { selected: "bg-sky-100", hovered: "bg-sky-50" }
      : { selected: "bg-red-100", hovered: "bg-red-50" };

  if (selected) return accent.selected;
  if (hovered) return accent.hovered;
  if (added) return "border border-emerald-200 bg-emerald-50/80";
  return "border border-transparent";
}

export function PoiManager({
  track,
  pois,
  selectedPoiId,
  addMode,
  onAddModeChange,
  onSelect,
  onPlaceOnMap,
  waterPoints,
  onWaterPointsChange,
  hoveredWaterPointId = null,
  onWaterPointHover,
  cityLimitSigns,
  onCityLimitSignsChange,
  hoveredCityLimitId = null,
  onCityLimitHover,
  variant = "all",
}: PoiManagerProps) {
  const t = useTranslations("roadbook.poiManage");
  const tWater = useTranslations("roadbook.poiManage.water");
  const tCityLimit = useTranslations("roadbook.poiManage.cityLimit");
  const addPoi = useRoadbookStore((state) => state.addPoi);
  const updatePoi = useRoadbookStore((state) => state.updatePoi);
  const removePoi = useRoadbookStore((state) => state.removePoi);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [waterLoading, setWaterLoading] = useState(false);
  const [waterError, setWaterError] = useState<string | null>(null);
  const [cityLimitLoading, setCityLimitLoading] = useState(false);
  const [cityLimitError, setCityLimitError] = useState<string | null>(null);
  const [cityLimitSearched, setCityLimitSearched] = useState(false);

  const showManual = variant === "all" || variant === "manual";
  const showWater = variant === "all" || variant === "water";
  const showCityLimit = variant === "all" || variant === "cityLimit";

  const selectedPoi = pois.find((poi) => poi.id === selectedPoiId) ?? null;
  const maxDistanceKm = track.length > 0 ? track[track.length - 1].distanceM / 1000 : 0;

  useEffect(() => {
    if (!selectedPoi) return;
    setName(selectedPoi.name);
    setDescription(selectedPoi.description ?? "");
    setDistanceKm((selectedPoi.distanceFromStartM / 1000).toFixed(1));
  }, [selectedPoi]);

  const defaultName = useCallback(
    () => t("defaultName", { index: pois.length + 1 }),
    [pois.length, t],
  );

  const placePoi = useCallback(
    (lat: number, lng: number, distanceFromKm?: number) => {
      const poi =
        distanceFromKm !== undefined
          ? createPoiAtDistance(track, distanceFromKm, name || defaultName(), description, pois)
          : createPoiFromMapClick(track, lat, lng, name || defaultName(), description, pois);

      if (!poi) return;

      addPoi(poi);
      onSelect(poi.id);
      setName("");
      setDescription("");
      setDistanceKm("");
      onAddModeChange(false);
    },
    [addPoi, defaultName, description, name, onAddModeChange, onSelect, pois, track],
  );

  useEffect(() => {
    if (!showManual) return;

    if (!addMode) {
      onPlaceOnMap(null);
      return;
    }

    onPlaceOnMap((lat, lng) => {
      placePoi(lat, lng);
    });

    return () => {
      onPlaceOnMap(null);
    };
  }, [addMode, onPlaceOnMap, placePoi, showManual]);

  const handleAddFromForm = () => {
    const distance = Number(distanceKm);
    if (Number.isNaN(distance) || distance < 0) return;
    placePoi(0, 0, distance);
  };

  const handleSaveEdit = () => {
    if (!selectedPoi) return;
    updatePoi(selectedPoi.id, { name, description });
  };

  const handleDelete = () => {
    if (!selectedPoi) return;
    removePoi(selectedPoi.id);
    onSelect(null);
    setName("");
    setDescription("");
    setDistanceKm("");
  };

  const addWaterAsPoi = useCallback(
    (point: OsmWaterPoint) => {
      if (isOsmWaterAlreadyAdded(pois, point.id)) return;

      const labels = translateWaterPointDisplay(point.tags, tWater);
      const { name, description } = osmWaterPoiNameAndDescription(
        point.name,
        labels,
        tWater("defaultName"),
      );

      const poi = createPoiFromOsmWater(
        track,
        {
          lat: point.lat,
          lng: point.lng,
          name,
          description,
          osmId: point.id,
        },
        tWater("defaultName"),
        pois,
      );

      if (!poi) return;

      addPoi(poi);
      onSelect(poi.id);
    },
    [addPoi, onSelect, pois, tWater, track],
  );

  const removeWaterFromRoadbook = useCallback(
    (osmId: string) => {
      const poi = findPoiByOsmId(pois, osmId, "osm");
      if (!poi) return;

      removePoi(poi.id);
      if (selectedPoiId === poi.id) onSelect(null);
    },
    [onSelect, pois, removePoi, selectedPoiId],
  );

  const handleWaterRowClick = useCallback(
    (point: OsmWaterPoint, added: boolean) => {
      if (added) {
        const poi = findPoiByOsmId(pois, point.id, "osm");
        if (poi) onSelect(poi.id);
        onWaterPointHover?.(point.id);
        return;
      }

      addWaterAsPoi(point);
    },
    [addWaterAsPoi, onSelect, onWaterPointHover, pois],
  );

  const handleSearchWater = async () => {
    setWaterLoading(true);
    setWaterError(null);

    try {
      const points = await fetchWaterPointsForTrack(track);
      onWaterPointsChange(points);
    } catch (error) {
      setWaterError(error instanceof Error ? error.message : tWater("fetchError"));
      onWaterPointsChange([]);
    } finally {
      setWaterLoading(false);
    }
  };

  const addCityLimitAsPoi = useCallback(
    (sign: OsmCityLimitSign) => {
      if (isOsmCityLimitAlreadyAdded(pois, sign.id)) return;

      const labels = translateCityLimitDisplay(sign.tags, tCityLimit);
      const communeName = sign.name ?? parseCityLimitSignName(sign.tags);
      const { name, description } = osmCityLimitPoiNameAndDescription(
        communeName,
        labels,
        tCityLimit,
        tCityLimit("defaultName"),
      );

      const poi = createPoiFromOsmCityLimit(
        track,
        {
          lat: sign.lat,
          lng: sign.lng,
          name,
          description,
          osmId: sign.id,
        },
        tCityLimit("defaultName"),
        pois,
      );

      if (!poi) return;

      addPoi(poi);
      onSelect(poi.id);
    },
    [addPoi, onSelect, pois, tCityLimit, track],
  );

  const removeCityLimitFromRoadbook = useCallback(
    (osmId: string) => {
      const poi = findPoiByOsmId(pois, osmId, "osm-city-limit");
      if (!poi) return;

      removePoi(poi.id);
      if (selectedPoiId === poi.id) onSelect(null);
    },
    [onSelect, pois, removePoi, selectedPoiId],
  );

  const handleCityLimitRowClick = useCallback(
    (sign: OsmCityLimitSign, added: boolean) => {
      if (added) {
        const poi = findPoiByOsmId(pois, sign.id, "osm-city-limit");
        if (poi) onSelect(poi.id);
        onCityLimitHover?.(sign.id);
        return;
      }

      addCityLimitAsPoi(sign);
    },
    [addCityLimitAsPoi, onCityLimitHover, onSelect, pois],
  );

  const handleSearchCityLimits = async () => {
    setCityLimitLoading(true);
    setCityLimitError(null);

    try {
      const signs = await fetchCityLimitSignsForTrack(track);
      onCityLimitSignsChange(signs);
      setCityLimitSearched(true);
    } catch (error) {
      setCityLimitError(error instanceof Error ? error.message : tCityLimit("fetchError"));
      onCityLimitSignsChange([]);
      setCityLimitSearched(false);
    } finally {
      setCityLimitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {showManual ? (
        <div id="poi-manage-form" className="space-y-3 scroll-mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={addMode ? "default" : "secondary"}
              onClick={() => onAddModeChange(!addMode)}
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {addMode ? t("cancelMapMode") : t("addOnMap")}
            </Button>
            {addMode ? (
              <p className="text-xs font-medium text-amber-800">{t("mapModeHint")}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="poi-name" className="text-xs font-medium text-zinc-600">
                {t("nameLabel")}
              </label>
              <input
                id="poi-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("namePlaceholder")}
                className={inputClassName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="poi-km" className="text-xs font-medium text-zinc-600">
                {t("distanceLabel", { max: maxDistanceKm.toFixed(1) })}
              </label>
              <input
                id="poi-km"
                type="number"
                min={0}
                max={maxDistanceKm}
                step={0.1}
                value={distanceKm}
                onChange={(event) => setDistanceKm(event.target.value)}
                placeholder="0"
                className={inputClassName}
                disabled={Boolean(selectedPoi)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="poi-desc" className="text-xs font-medium text-zinc-600">
                {t("descriptionLabel")}
              </label>
              <input
                id="poi-desc"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("descriptionPlaceholder")}
                className={inputClassName}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddFromForm}
              disabled={Boolean(selectedPoi)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addAtKm")}
            </Button>
            {selectedPoi ? (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={handleSaveEdit}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  {t("saveEdit")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t("delete")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onSelect(null)}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  {t("clearSelection")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {showWater ? (
        <div className="space-y-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleSearchWater}
            disabled={waterLoading || track.length === 0}
          >
            <Droplets className="h-4 w-4" aria-hidden="true" />
            {waterLoading ? tWater("searching") : tWater("search")}
          </Button>

          {waterError ? <p className="text-xs text-red-600">{waterError}</p> : null}
          {waterPoints.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-600">
                {tWater("resultsCount", { count: waterPoints.length })}
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1">
                {waterPoints.map((point) => {
                  const added = isOsmWaterAlreadyAdded(pois, point.id);
                  const linkedPoi = added ? findPoiByOsmId(pois, point.id, "osm") : undefined;
                  const selected = linkedPoi?.id === selectedPoiId;
                  const hovered = point.id === hoveredWaterPointId;
                  const labels = translateWaterPointDisplay(point.tags, tWater);
                  const snapped = snapLatLngToTrack(track, point.lat, point.lng);
                  const trackKmPrimary = snapped
                    ? tWater("kmOnTrack", { km: (snapped.distanceM / 1000).toFixed(1) })
                    : null;
                  const nameLine = point.name ?? labels.typeLabel;
                  const subtitleParts: string[] = [];
                  if (point.name) subtitleParts.push(labels.typeLabel);
                  if (labels.detailsLine) subtitleParts.push(labels.detailsLine);
                  if (point.distanceToTrackM >= 1) {
                    subtitleParts.push(
                      tWater("physicalSignOffset", {
                        distance: Math.round(point.distanceToTrackM),
                      }),
                    );
                  }
                  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : null;

                  return (
                    <li key={point.id}>
                      <div
                        className={`flex items-center gap-1 rounded-md transition-colors ${osmPoiRowShellClassName("water", { added, selected, hovered })}`}
                        onMouseEnter={() => onWaterPointHover?.(point.id)}
                        onMouseLeave={() => onWaterPointHover?.(null)}
                      >
                        <button
                          type="button"
                          onClick={() => handleWaterRowClick(point, added)}
                          className={`flex min-w-0 flex-1 touch-manipulation items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors ${
                            selected || hovered
                              ? "text-sky-900"
                              : added
                                ? "text-emerald-950"
                                : "text-zinc-800 hover:bg-zinc-50 active:bg-zinc-100"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{trackKmPrimary}</span>
                            <span className="block truncate text-xs text-zinc-600">{nameLine}</span>
                            {subtitle ? (
                              <span className="block truncate text-xs text-zinc-500">{subtitle}</span>
                            ) : null}
                          </span>
                        </button>
                        <OsmPoiRowActions
                          added={added}
                          inMyPoisLabel={t("inMyPois")}
                          addToMyPoisLabel={t("addToMyPois")}
                          removeFromMyPoisLabel={t("removeFromMyPois")}
                          onAdd={() => addWaterAsPoi(point)}
                          onRemove={() => removeWaterFromRoadbook(point.id)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {showCityLimit ? (
        <div className="space-y-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleSearchCityLimits}
            disabled={cityLimitLoading || track.length === 0}
          >
            <Signpost className="h-4 w-4" aria-hidden="true" />
            {cityLimitLoading ? tCityLimit("searching") : tCityLimit("search")}
          </Button>

          {cityLimitError ? <p className="text-xs text-red-600">{cityLimitError}</p> : null}
          {cityLimitSearched && cityLimitSigns.length === 0 && !cityLimitLoading ? (
            <p className="text-xs text-zinc-600">
              {tCityLimit("noOnTrackResults", { maxDistance: CITY_LIMIT_ON_TRACK_MAX_M })}
            </p>
          ) : null}
          {cityLimitSigns.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-600">
                {tCityLimit("resultsCount", {
                  count: cityLimitSigns.length,
                  maxDistance: CITY_LIMIT_ON_TRACK_MAX_M,
                })}
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1">
                {cityLimitSigns.map((sign) => {
                  const added = isOsmCityLimitAlreadyAdded(pois, sign.id);
                  const linkedPoi = added
                    ? findPoiByOsmId(pois, sign.id, "osm-city-limit")
                    : undefined;
                  const selected = linkedPoi?.id === selectedPoiId;
                  const hovered = sign.id === hoveredCityLimitId;
                  const labels = translateCityLimitDisplay(sign.tags, tCityLimit);
                  const communeName = sign.name ?? parseCityLimitSignName(sign.tags);
                  const titleLine = formatCityLimitDisplayTitle(
                    communeName,
                    labels,
                    tCityLimit,
                    tCityLimit("defaultName"),
                  );
                  const snapped = snapLatLngToTrack(track, sign.lat, sign.lng);
                  const trackKmPrimary = snapped
                    ? tCityLimit("kmOnTrack", { km: (snapped.distanceM / 1000).toFixed(1) })
                    : null;
                  const subtitleParts: string[] = [];
                  if (communeName) subtitleParts.push(labels.typeLabel);
                  if (trackKmPrimary) subtitleParts.push(trackKmPrimary);
                  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : null;

                  return (
                    <li key={sign.id}>
                      <div
                        className={`flex items-center gap-1 rounded-md transition-colors ${osmPoiRowShellClassName("cityLimit", { added, selected, hovered })}`}
                        onMouseEnter={() => onCityLimitHover?.(sign.id)}
                        onMouseLeave={() => onCityLimitHover?.(null)}
                      >
                        <button
                          type="button"
                          onClick={() => handleCityLimitRowClick(sign, added)}
                          className={`flex min-w-0 flex-1 touch-manipulation items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors ${
                            selected || hovered
                              ? "text-red-900"
                              : added
                                ? "text-emerald-950"
                                : "text-zinc-800 hover:bg-zinc-50 active:bg-zinc-100"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{titleLine}</span>
                            {subtitle ? (
                              <span className="block truncate text-xs text-zinc-500">{subtitle}</span>
                            ) : null}
                          </span>
                        </button>
                        <OsmPoiRowActions
                          added={added}
                          inMyPoisLabel={t("inMyPois")}
                          addToMyPoisLabel={t("addToMyPois")}
                          removeFromMyPoisLabel={t("removeFromMyPois")}
                          onAdd={() => addCityLimitAsPoi(sign)}
                          onRemove={() => removeCityLimitFromRoadbook(sign.id)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
