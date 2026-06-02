"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import { createWaterPointMapIcon } from "@/components/map/map-icons";
import { snapLatLngToTrack } from "@/lib/gpx/poi-manage";
import type { OsmWaterPoint } from "@/lib/osm/water-points";
import type { TrackPoint } from "@/types/roadbook";

interface WaterPointMarkerProps {
  point: OsmWaterPoint;
  track: TrackPoint[];
  added?: boolean;
  hovered?: boolean;
  typeLabel: string;
  detailsLine?: string;
  nameLabel: string;
  trackKmLabel: string;
  physicalSignLabel?: string;
  addLabel: string;
  addedLabel: string;
  onSelect?: (point: OsmWaterPoint) => void;
  onHover?: (osmId: string | null) => void;
}

export function WaterPointMarker({
  point,
  track,
  added = false,
  hovered = false,
  typeLabel,
  detailsLine,
  nameLabel,
  trackKmLabel,
  physicalSignLabel,
  addLabel,
  addedLabel,
  onSelect,
  onHover,
}: WaterPointMarkerProps) {
  const snapped = useMemo(
    () => snapLatLngToTrack(track, point.lat, point.lng),
    [track, point.lat, point.lng],
  );

  const icon = useMemo(
    () => createWaterPointMapIcon({ hovered: hovered && !added, added }),
    [added, hovered],
  );

  const displayName = point.name ?? typeLabel ?? nameLabel;

  if (!snapped) return null;

  return (
    <Marker
      position={[snapped.lat, snapped.lng]}
      icon={icon}
      zIndexOffset={hovered ? 400 : 200}
      eventHandlers={{
        ...(onSelect && !added
          ? {
              click: () => {
                onSelect(point);
              },
            }
          : {}),
        ...(onHover
          ? {
              mouseover: () => {
                onHover(point.id);
              },
              mouseout: () => {
                onHover(null);
              },
            }
          : {}),
      }}
    >
      <Popup>
        <div className="max-w-[220px] text-sm">
          <p className="font-semibold text-sky-800">{displayName}</p>
          {point.name ? <p className="text-xs text-zinc-600">{typeLabel}</p> : null}
          {detailsLine ? <p className="text-xs text-zinc-500">{detailsLine}</p> : null}
          <p className="mt-1 text-zinc-600">{trackKmLabel}</p>
          {physicalSignLabel ? <p className="text-xs text-zinc-500">{physicalSignLabel}</p> : null}
          <p
            className={`mt-1 text-xs font-medium ${added ? "text-emerald-700" : "text-sky-700"}`}
          >
            {added ? addedLabel : addLabel}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}
