"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useTranslations } from "next-intl";
import type { Poi, RoadbookBounds, TrackPoint } from "@/types/roadbook";
import { withPoiStats } from "@/lib/gpx/poi-intervals";
import { formatElevation } from "@/lib/utils";
import { EndpointMarker } from "@/components/map/EndpointMarker";
import { GradientTrackLine } from "@/components/map/GradientTrackLine";
import { TrackGradeLegend } from "@/components/map/TrackGradeLegend";
import { PoiMarker } from "@/components/map/PoiMarker";
import { WindMarker } from "@/components/map/WindMarker";
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
  hoveredWeatherSegmentId = null,
  onWeatherSegmentSelect,
  onWeatherSegmentHover,
}: TrackMapProps) {
  const t = useTranslations("a11y");
  const tRoadbook = useTranslations("roadbook");
  const tWeather = useTranslations("roadbook.weather");

  const center = useMemo(() => {
    const [[swLat, swLng], [neLat, neLng]] = bounds;
    return [(swLat + neLat) / 2, (swLng + neLng) / 2] as [number, number];
  }, [bounds]);

  const start = track[0];
  const finish = track.length > 1 ? track[track.length - 1] : undefined;

  const formatDistance = (distanceM: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(distanceM / 1000)} km`;

  const poiStats = useMemo(() => withPoiStats(track, pois), [track, pois]);

  const windMarkerLabels = useMemo(
    () => ({
      segment: tWeather("segmentLabel", { id: "{id}" }),
      windSpeed: tWeather("windSpeed", { speed: "{speed}" }),
      windComponent: tWeather("windComponent", { value: "{value}" }),
      temperature: tWeather("temperature", { value: "{value}" }),
      precipitation: tWeather("precipitation", { value: "{value}" }),
      headwind: tWeather("windRelative.headwind"),
      tailwind: tWeather("windRelative.tailwind"),
      crosswind: tWeather("windRelative.crosswind"),
    }),
    [tWeather],
  );

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
        {weatherSegments.map((segment) => (
          <WindMarker
            key={`wind-${segment.id}`}
            segment={segment}
            locale={locale}
            selected={segment.id === selectedWeatherSegmentId}
            hovered={segment.id === hoveredWeatherSegmentId}
            labels={windMarkerLabels}
            onSelect={onWeatherSegmentSelect}
            onHover={onWeatherSegmentHover}
          />
        ))}
        <FocusSelectedPoi pois={poiStats} selectedPoiId={selectedPoiId} />
        <FocusSelectedWeatherSegment
          segments={weatherSegments}
          selectedSegmentId={selectedWeatherSegmentId}
        />
        <FitBounds bounds={bounds} />
      </MapContainer>
      <TrackGradeLegend />
    </div>
  );
}
