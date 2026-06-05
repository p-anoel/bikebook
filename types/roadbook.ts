export interface TrackPoint {
  lat: number;
  lng: number;
  ele: number;
  distanceM: number;
}

export type PoiSource = "gpx" | "manual" | "osm" | "osm-city-limit";

export interface Poi {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  ele?: number;
  distanceFromStartM: number;
  source?: PoiSource;
  osmId?: string;
}

export interface RoadbookStats {
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number;
  maxElevationM: number;
}

export type RoadbookBounds = [[number, number], [number, number]];

export interface Stage {
  id: string;
  name?: string;
  /** Cumulative end distance on the master track (m). */
  endDistanceM: number;
}

/** Multi-stage tour: one master track with stage boundaries. */
export interface Multitour {
  id: string;
  name: string;
  uploadedAt: string;
  stats: RoadbookStats;
  track: TrackPoint[];
  pois: Poi[];
  bounds: RoadbookBounds;
  stages: Stage[];
}

export type Roadbook = Multitour;

/** Derived view for a single stage (not persisted). */
export interface StageView {
  index: number;
  stage: Stage;
  startDistanceM: number;
  endDistanceM: number;
  track: TrackPoint[];
  pois: Poi[];
  stats: RoadbookStats;
  bounds: RoadbookBounds;
}

export interface GpxParseError {
  code: "INVALID_XML" | "NO_TRACK" | "EMPTY_TRACK" | "PARSE_ERROR";
  message: string;
}
