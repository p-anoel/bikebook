import { haversineDistanceM } from "@/lib/gpx/elevation";
import type { Poi, TrackPoint } from "@/types/roadbook";

export interface RawWaypoint {
  lat: number;
  lng: number;
  name?: string;
  description?: string;
  ele?: number;
}

export function projectPoisOnTrack(
  waypoints: RawWaypoint[],
  track: TrackPoint[],
): Poi[] {
  if (track.length === 0) return [];

  const pois = waypoints.map((wpt, index) => {
    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < track.length; i++) {
      const d = haversineDistanceM(wpt.lat, wpt.lng, track[i].lat, track[i].lng);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    return {
      id: `poi-${index}`,
      name: wpt.name?.trim() || `POI ${index + 1}`,
      description: wpt.description?.trim() || undefined,
      lat: wpt.lat,
      lng: wpt.lng,
      ele: wpt.ele,
      distanceFromStartM: track[bestIndex].distanceM,
    };
  });

  return sortPoisByDistance(pois);
}

export function sortPoisByDistance(pois: Poi[]): Poi[] {
  return [...pois].sort((a, b) => a.distanceFromStartM - b.distanceFromStartM);
}
