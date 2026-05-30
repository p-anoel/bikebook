"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import { createPoiMapIcon } from "@/components/map/map-icons";

interface PoiMarkerProps {
  poiId: string;
  lat: number;
  lng: number;
  number: number;
  selected?: boolean;
  hovered?: boolean;
  name: string;
  description?: string;
  distanceKm: string;
  cumulativeGainLabel: string;
  intervalGainLabel?: string;
  onSelect?: (poiId: string | null) => void;
  onHover?: (poiId: string | null) => void;
}

export function PoiMarker({
  poiId,
  lat,
  lng,
  number,
  selected = false,
  hovered = false,
  name,
  description,
  distanceKm,
  cumulativeGainLabel,
  intervalGainLabel,
  onSelect,
  onHover,
}: PoiMarkerProps) {
  const icon = useMemo(
    () => createPoiMapIcon(number, { selected, hovered: hovered && !selected }),
    [number, selected, hovered],
  );

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      zIndexOffset={selected ? 1000 : hovered ? 500 : 0}
      eventHandlers={{
        ...(onSelect
          ? {
              click: () => {
                onSelect(poiId);
              },
            }
          : {}),
        ...(onHover
          ? {
              mouseover: () => {
                onHover(poiId);
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
          <p className="font-semibold">
            <span className="text-blue-700">{number}.</span> {name}
          </p>
          <p className="text-zinc-600">{distanceKm}</p>
          <p className="text-zinc-600">{cumulativeGainLabel}</p>
          {intervalGainLabel ? (
            <p className="text-zinc-600">{intervalGainLabel}</p>
          ) : null}
          {description ? <p className="mt-1 text-zinc-500">{description}</p> : null}
        </div>
      </Popup>
    </Marker>
  );
}
