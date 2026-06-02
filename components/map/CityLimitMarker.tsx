"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import { createCityLimitMapIcon } from "@/components/map/map-icons";
import type { OsmCityLimitSign } from "@/lib/osm/city-limit-signs";

interface CityLimitMarkerProps {
  sign: OsmCityLimitSign;
  added?: boolean;
  hovered?: boolean;
  titleLabel: string;
  typeLabel: string;
  trackKmLabel: string;
  addLabel: string;
  addedLabel: string;
  onSelect?: (sign: OsmCityLimitSign) => void;
  onHover?: (osmId: string | null) => void;
}

export function CityLimitMarker({
  sign,
  added = false,
  hovered = false,
  titleLabel,
  typeLabel,
  trackKmLabel,
  addLabel,
  addedLabel,
  onSelect,
  onHover,
}: CityLimitMarkerProps) {
  const icon = useMemo(
    () => createCityLimitMapIcon({ hovered: hovered && !added, added }),
    [added, hovered],
  );

  const displayName = titleLabel;

  return (
    <Marker
      position={[sign.lat, sign.lng]}
      icon={icon}
      zIndexOffset={hovered ? 400 : 200}
      eventHandlers={{
        ...(onSelect && !added
          ? {
              click: () => {
                onSelect(sign);
              },
            }
          : {}),
        ...(onHover
          ? {
              mouseover: () => {
                onHover(sign.id);
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
          <p className="font-semibold text-red-800">{displayName}</p>
          {displayName !== typeLabel ? (
            <p className="text-xs text-zinc-600">{typeLabel}</p>
          ) : null}
          {trackKmLabel ? <p className="mt-1 text-zinc-600">{trackKmLabel}</p> : null}
          <p
            className={`mt-1 text-xs font-medium ${added ? "text-emerald-700" : "text-red-700"}`}
          >
            {added ? addedLabel : addLabel}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}
