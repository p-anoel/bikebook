"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import { createWindMapIcon } from "@/components/map/map-icons";
import type { RouteWeatherSegment } from "@/lib/weather/types";

interface WindMarkerProps {
  segment: RouteWeatherSegment;
  locale: string;
  selected?: boolean;
  hovered?: boolean;
  labels: {
    segment: string;
    windSpeed: string;
    windComponent: string;
    temperature: string;
    precipitation: string;
    headwind: string;
    tailwind: string;
    crosswind: string;
  };
  onSelect?: (segmentId: number | null) => void;
  onHover?: (segmentId: number | null) => void;
}

export function WindMarker({
  segment,
  locale,
  selected = false,
  hovered = false,
  labels,
  onSelect,
  onHover,
}: WindMarkerProps) {
  const icon = useMemo(
    () =>
      createWindMapIcon(segment.windRelative, segment.windDirectionDeg, {
        selected,
        hovered: hovered && !selected,
      }),
    [segment.windRelative, segment.windDirectionDeg, selected, hovered],
  );

  const relativeLabel =
    segment.windRelative === "headwind"
      ? labels.headwind
      : segment.windRelative === "tailwind"
        ? labels.tailwind
        : labels.crosswind;

  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  return (
    <Marker
      position={[segment.centerLat, segment.centerLng]}
      icon={icon}
      zIndexOffset={selected ? 800 : hovered ? 400 : 100}
      eventHandlers={{
        ...(onSelect
          ? {
              click: () => {
                onSelect(segment.id);
              },
            }
          : {}),
        ...(onHover
          ? {
              mouseover: () => {
                onHover(segment.id);
              },
              mouseout: () => {
                onHover(null);
              },
            }
          : {}),
      }}
    >
      <Popup>
        <div className="text-sm">
          <p className="font-semibold">{labels.segment.replace("{id}", String(segment.id))}</p>
          <p className="text-zinc-600">
            {relativeLabel} · {labels.windSpeed.replace("{speed}", fmt.format(segment.windSpeedKmh))}
          </p>
          <p className="text-zinc-600">
            {labels.windComponent.replace("{value}", fmt.format(segment.windComponentKmh))}
          </p>
          <p className="text-zinc-600">
            {labels.temperature.replace("{value}", fmt.format(segment.temperatureC))}
          </p>
          {segment.precipitationMm > 0 ? (
            <p className="text-zinc-600">
              {labels.precipitation.replace("{value}", fmt.format(segment.precipitationMm))}
            </p>
          ) : null}
        </div>
      </Popup>
    </Marker>
  );
}
