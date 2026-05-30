"use client";

import { Marker, Popup } from "react-leaflet";
import { finishMapIcon, startMapIcon } from "@/components/map/map-icons";

interface EndpointMarkerProps {
  kind: "start" | "finish";
  lat: number;
  lng: number;
  label: string;
  distanceKm: string;
}

export function EndpointMarker({ kind, lat, lng, label, distanceKm }: EndpointMarkerProps) {
  return (
    <Marker position={[lat, lng]} icon={kind === "start" ? startMapIcon : finishMapIcon}>
      <Popup>
        <div className="text-sm">
          <p className="font-semibold">{label}</p>
          <p className="text-zinc-600">{distanceKm}</p>
        </div>
      </Popup>
    </Marker>
  );
}
