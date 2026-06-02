"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useTranslations } from "next-intl";
import type { Poi, RoadbookBounds, TrackPoint } from "@/types/roadbook";
import { withPoiStats } from "@/lib/gpx/poi-intervals";
import { snapLatLngToTrack } from "@/lib/gpx/poi-manage";
import { formatElevation } from "@/lib/utils";
import { EndpointMarker } from "@/components/map/EndpointMarker";
import { GradientTrackLine } from "@/components/map/GradientTrackLine";
import { TrackGradeLegend } from "@/components/map/TrackGradeLegend";
import { PoiMarker } from "@/components/map/PoiMarker";
import { WaterPointMarker } from "@/components/map/WaterPointMarker";
import { CityLimitMarker } from "@/components/map/CityLimitMarker";
import { MapPoiPlacement } from "@/components/map/MapPoiPlacement";
import { translateWaterPointDisplay } from "@/lib/osm/water-display";
import { formatCityLimitDisplayTitle, translateCityLimitDisplay } from "@/lib/osm/city-limit-display";
import type { OsmWaterPoint } from "@/lib/osm/water-points";
import { parseCityLimitSignName, type OsmCityLimitSign } from "@/lib/osm/city-limit-signs";
import type { RouteWeatherSegment } from "@/lib/weather/types";
import "leaflet/dist/leaflet.css";

function FitBounds({ bounds }: { bounds: RoadbookBounds }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [bounds, map]);

  return null;
}

function FocusSelectedPoi({
  pois,
  selectedPoiId,
}: {
  pois: ReturnType<typeof withPoiStats>;
  selectedPoiId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedPoiId) return;
    const poi = pois.find((item) => item.id === selectedPoiId);
    if (!poi) return;
    map.flyTo([poi.lat, poi.lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
  }, [map, pois, selectedPoiId]);

  return null;
}

function FocusSelectedWeatherSegment({
  segments,
  selectedSegmentId,
}: {
  segments: RouteWeatherSegment[];
  selectedSegmentId: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedSegmentId) return;
    const segment = segments.find((item) => item.id === selectedSegmentId);
    if (!segment) return;
    map.flyTo([segment.centerLat, segment.centerLng], Math.max(map.getZoom(), 13), {
      duration: 0.5,
    });
  }, [map, segments, selectedSegmentId]);

  return null;
}

interface TrackMapProps {
  track: TrackPoint[];
  pois: Poi[];
  bounds: RoadbookBounds;
  locale: string;
  selectedPoiId?: string | null;
  hoveredPoiId?: string | null;
  onPoiSelect?: (poiId: string | null) => void;
  onPoiHover?: (poiId: string | null) => void;
  weatherSegments?: RouteWeatherSegment[];
  selectedWeatherSegmentId?: number | null;
  hoveredWeatherSegmentId?: number | null;
  onWeatherSegmentSelect?: (segmentId: number | null) => void;
  onWeatherSegmentHover?: (segmentId: number | null) => void;
  addPoiMode?: boolean;
  onMapPoiPlace?: (lat: number, lng: number) => void;
  waterPoints?: OsmWaterPoint[];
  addedOsmWaterIds?: Set<string>;
  hoveredWaterPointId?: string | null;
  onWaterPointSelect?: (point: OsmWaterPoint) => void;
  onWaterPointHover?: (osmId: string | null) => void;
  cityLimitSigns?: OsmCityLimitSign[];
  addedOsmCityLimitIds?: Set<string>;
  hoveredCityLimitId?: string | null;
  onCityLimitSelect?: (sign: OsmCityLimitSign) => void;
  onCityLimitHover?: (osmId: string | null) => void;
}

export function TrackMap({
  track,
  pois,
  bounds,
  locale,
  selectedPoiId = null,
  hoveredPoiId = null,
  onPoiSelect,
  onPoiHover,
  weatherSegments = [],
  selectedWeatherSegmentId = null,
  addPoiMode = false,
  onMapPoiPlace,
  waterPoints = [],
  addedOsmWaterIds,
  hoveredWaterPointId = null,
  onWaterPointSelect,
  onWaterPointHover,
  cityLimitSigns = [],
  addedOsmCityLimitIds,
  hoveredCityLimitId = null,
  onCityLimitSelect,
  onCityLimitHover,
}: TrackMapProps) {
  const t = useTranslations("a11y");
  const tRoadbook = useTranslations("roadbook");
  const tWater = useTranslations("roadbook.poiManage.water");
  const tCityLimit = useTranslations("roadbook.poiManage.cityLimit");

  const center = useMemo(() => {
    const [[swLat, swLng], [neLat, neLng]] = bounds;
    return [(swLat + neLat) / 2, (swLng + neLng) / 2] as [number, number];
  }, [bounds]);

  const start = track[0];
  const finish = track.length > 1 ? track[track.length - 1] : undefined;

  const formatDistance = (distanceM: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(distanceM / 1000)} km`;

  const poiStats = useMemo(() => withPoiStats(track, pois), [track, pois]);

  return (
    <div
      className="relative isolate z-0 h-[clamp(240px,52vw,420px)] w-full overflow-hidden rounded-xl"
      role="region"
      aria-label={t("mapDescription")}
    >
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: "#f4f4f5" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GradientTrackLine track={track} />
        {start ? (
          <EndpointMarker
            kind="start"
            lat={start.lat}
            lng={start.lng}
            label={tRoadbook("markers.start")}
            distanceKm={formatDistance(start.distanceM)}
          />
        ) : null}
        {finish && finish !== start ? (
          <EndpointMarker
            kind="finish"
            lat={finish.lat}
            lng={finish.lng}
            label={tRoadbook("markers.finish")}
            distanceKm={formatDistance(finish.distanceM)}
          />
        ) : null}
        {waterPoints.map((point) => {
          const labels = translateWaterPointDisplay(point.tags, tWater);
          const snapped = snapLatLngToTrack(track, point.lat, point.lng);
          const trackKmLabel = snapped
            ? tWater("kmOnTrack", { km: (snapped.distanceM / 1000).toFixed(1) })
            : "";
          const physicalSignLabel =
            point.distanceToTrackM >= 1
              ? tWater("physicalSignOffset", {
                  distance: Math.round(point.distanceToTrackM),
                })
              : undefined;

          return (
            <WaterPointMarker
              key={point.id}
              point={point}
              track={track}
              added={addedOsmWaterIds?.has(point.id) ?? false}
              hovered={point.id === hoveredWaterPointId}
              typeLabel={labels.typeLabel}
              detailsLine={labels.detailsLine}
              nameLabel={tWater("defaultName")}
              trackKmLabel={trackKmLabel}
              physicalSignLabel={physicalSignLabel}
              addLabel={tWater("mapAddHint")}
              addedLabel={tWater("alreadyAdded")}
              onSelect={onWaterPointSelect}
              onHover={onWaterPointHover}
            />
          );
        })}
        {cityLimitSigns.map((sign) => {
          const labels = translateCityLimitDisplay(sign.tags, tCityLimit);
          const communeName = sign.name ?? parseCityLimitSignName(sign.tags);
          const titleLabel = formatCityLimitDisplayTitle(
            communeName,
            labels,
            tCityLimit,
            tCityLimit("defaultName"),
          );
          const snapped = snapLatLngToTrack(track, sign.lat, sign.lng);
          const trackKmLabel = snapped
            ? tCityLimit("kmOnTrack", { km: (snapped.distanceM / 1000).toFixed(1) })
            : "";

          return (
            <CityLimitMarker
              key={sign.id}
              sign={sign}
              added={addedOsmCityLimitIds?.has(sign.id) ?? false}
              hovered={sign.id === hoveredCityLimitId}
              titleLabel={titleLabel}
              typeLabel={labels.typeLabel}
              trackKmLabel={trackKmLabel}
              addLabel={tCityLimit("mapAddHint")}
              addedLabel={tCityLimit("alreadyAdded")}
              onSelect={onCityLimitSelect}
              onHover={onCityLimitHover}
            />
          );
        })}
        {poiStats.map((poi) => (
          <PoiMarker
            key={poi.id}
            poiId={poi.id}
            lat={poi.lat}
            lng={poi.lng}
            number={poi.number}
            selected={poi.id === selectedPoiId}
            hovered={poi.id === hoveredPoiId}
            name={poi.name}
            description={poi.description}
            distanceKm={`${(poi.distanceFromStartM / 1000).toFixed(1)} km`}
            cumulativeGainLabel={tRoadbook("poiCumulativeGain", {
              gain: formatElevation(poi.cumulativeElevationGainM, locale),
            })}
            intervalGainLabel={
              poi.intervalElevationGainM === null
                ? undefined
                : tRoadbook("poiIntervalGain", {
                    gain: formatElevation(poi.intervalElevationGainM, locale),
                  })
            }
            onSelect={onPoiSelect}
            onHover={onPoiHover}
          />
        ))}
        <FocusSelectedPoi pois={poiStats} selectedPoiId={selectedPoiId} />
        <FocusSelectedWeatherSegment
          segments={weatherSegments}
          selectedSegmentId={selectedWeatherSegmentId}
        />
        <FitBounds bounds={bounds} />
        {addPoiMode && onMapPoiPlace ? (
          <MapPoiPlacement enabled={addPoiMode} onMapClick={onMapPoiPlace} />
        ) : null}
      </MapContainer>
      {addPoiMode ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-[500] flex justify-center px-2">
          <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white shadow">
            {tRoadbook("poiManage.mapModeBanner")}
          </span>
        </div>
      ) : null}
      <TrackGradeLegend />
    </div>
  );
}
