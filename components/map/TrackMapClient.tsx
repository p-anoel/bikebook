"use client";

import dynamic from "next/dynamic";
import type { RouteWeatherSegment } from "@/lib/weather/types";
import type { Poi, RoadbookBounds, TrackPoint } from "@/types/roadbook";

const TrackMapInner = dynamic(
  () => import("@/components/map/TrackMap").then((mod) => mod.TrackMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[clamp(240px,52vw,420px)] items-center justify-center rounded-xl bg-zinc-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    ),
  },
);

interface TrackMapClientProps {
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

export function TrackMapClient(props: TrackMapClientProps) {
  return <TrackMapInner {...props} />;
}
