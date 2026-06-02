"use client";

import { useMemo } from "react";
import { Polyline } from "react-leaflet";
import {
  buildColoredTrackSegments,
  trackPolylinePositions,
} from "@/lib/gpx/map-track";
import type { TrackPoint } from "@/types/roadbook";

const ROUND_LINE = {
  lineCap: "round" as const,
  lineJoin: "round" as const,
};

interface GradientTrackLineProps {
  track: TrackPoint[];
}

export function GradientTrackLine({ track }: GradientTrackLineProps) {
  const outlinePositions = useMemo(() => trackPolylinePositions(track), [track]);
  const segments = useMemo(() => buildColoredTrackSegments(track), [track]);

  if (outlinePositions.length < 2) return null;

  return (
    <>
      <Polyline
        positions={outlinePositions}
        pathOptions={{
          color: "#ffffff",
          weight: 5,
          opacity: 0.88,
          ...ROUND_LINE,
        }}
      />
      <Polyline
        positions={outlinePositions}
        pathOptions={{
          color: "rgba(15,23,42,0.28)",
          weight: 3,
          opacity: 1,
          ...ROUND_LINE,
        }}
      />
      {segments.map((segment, index) => (
        <Polyline
          key={`${segment.color}-${index}`}
          positions={segment.positions}
          pathOptions={{
            color: segment.color,
            weight: 4,
            opacity: 1,
            ...ROUND_LINE,
          }}
        />
      ))}
    </>
  );
}
