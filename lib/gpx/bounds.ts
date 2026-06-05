import type { RoadbookBounds } from "@/types/roadbook";

export function computeBounds(
  track: Array<{ lat: number; lng: number }>,
): RoadbookBounds {
  if (track.length === 0) {
    return [
      [0, 0],
      [0, 0],
    ];
  }

  const lats = track.map((p) => p.lat);
  const lngs = track.map((p) => p.lng);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}
