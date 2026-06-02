"use client";

import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import type { TrackPoint } from "@/types/roadbook";

interface MapPoiPlacementProps {
  enabled: boolean;
  onMapClick: (lat: number, lng: number) => void;
}

export function MapPoiPlacement({ enabled, onMapClick }: MapPoiPlacementProps) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (enabled) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }

    return () => {
      container.style.cursor = "";
    };
  }, [enabled, map]);

  useMapEvents({
    click(event) {
      if (!enabled) return;
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}
