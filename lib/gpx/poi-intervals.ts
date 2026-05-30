import type { Poi, TrackPoint } from "@/types/roadbook";
import { elevationGainBetween } from "@/lib/gpx/elevation";
import { sortPoisByDistance } from "@/lib/gpx/poi";

export interface PoiWithInterval extends Poi {
  number: number;
  intervalFromPrevM: number | null;
}

export interface PoiWithStats extends PoiWithInterval {
  cumulativeElevationGainM: number;
  intervalElevationGainM: number | null;
}

export function withPoiIntervals(pois: Poi[]): PoiWithInterval[] {
  const sorted = sortPoisByDistance(pois);
  return sorted.map((poi, index) => ({
    ...poi,
    number: index + 1,
    intervalFromPrevM:
      index === 0 ? null : poi.distanceFromStartM - sorted[index - 1].distanceFromStartM,
  }));
}

export function withPoiStats(track: TrackPoint[], pois: Poi[]): PoiWithStats[] {
  const intervals = withPoiIntervals(pois);
  return intervals.map((poi, index) => ({
    ...poi,
    cumulativeElevationGainM: elevationGainBetween(track, 0, poi.distanceFromStartM),
    intervalElevationGainM:
      index === 0
        ? null
        : elevationGainBetween(
            track,
            intervals[index - 1].distanceFromStartM,
            poi.distanceFromStartM,
          ),
  }));
}
