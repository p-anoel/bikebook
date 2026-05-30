"use client";

import { ReferenceArea } from "recharts";
import type { ClimbSegment } from "@/lib/gpx/gradient";

interface ClimbProfileHighlightsProps {
  climbs: ClimbSegment[];
  visibleXDomain: [number, number];
  yDomain: [number, number];
  hoveredClimbId: number | null;
  selectedClimbId: number | null;
}

export function ClimbProfileHighlights({
  climbs,
  visibleXDomain,
  yDomain,
  hoveredClimbId,
  selectedClimbId,
}: ClimbProfileHighlightsProps) {
  const highlighted = climbs.filter((climb) => {
    const isActive =
      climb.id === selectedClimbId ||
      (climb.id === hoveredClimbId && climb.id !== selectedClimbId);
    if (!isActive) return false;

    const startKm = climb.startDistanceM / 1000;
    const endKm = climb.endDistanceM / 1000;
    return endKm >= visibleXDomain[0] && startKm <= visibleXDomain[1];
  });

  if (highlighted.length === 0) return null;

  return (
    <>
      {highlighted.map((climb) => {
        const selected = climb.id === selectedClimbId;
        return (
          <ReferenceArea
            key={climb.id}
            x1={climb.startDistanceM / 1000}
            x2={climb.endDistanceM / 1000}
            y1={yDomain[0]}
            y2={yDomain[1]}
            fill="#f59e0b"
            fillOpacity={selected ? 0.22 : 0.14}
            stroke="#f59e0b"
            strokeOpacity={selected ? 0.95 : 0.7}
            strokeWidth={selected ? 2 : 1.5}
            ifOverflow="hidden"
          />
        );
      })}
    </>
  );
}
