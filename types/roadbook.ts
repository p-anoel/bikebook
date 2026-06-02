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

export interface Roadbook {
  id: string;
  name: string;
  uploadedAt: string;
  stats: RoadbookStats;
  track: TrackPoint[];
  pois: Poi[];
  bounds: RoadbookBounds;
}

export interface GpxParseError {
  code: "INVALID_XML" | "NO_TRACK" | "EMPTY_TRACK" | "PARSE_ERROR";
  message: string;
}
