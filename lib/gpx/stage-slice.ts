import { computeBounds } from "@/lib/gpx/bounds";
import { computeElevationStats, getElevationAtDistance } from "@/lib/gpx/elevation";
import type {
  Multitour,
  Poi,
  RoadbookStats,
  Stage,
  StageView,
  TrackPoint,
} from "@/types/roadbook";

export function getStageStartDistanceM(stages: Stage[], index: number): number {
  return index > 0 ? stages[index - 1].endDistanceM : 0;
}

function pointAtDistance(track: TrackPoint[], distanceM: number): TrackPoint {
  if (track.length === 0) {
    return { lat: 0, lng: 0, ele: 0, distanceM: 0 };
  }
  if (distanceM <= track[0].distanceM) return { ...track[0], distanceM };
  const last = track[track.length - 1];
  if (distanceM >= last.distanceM) return { ...last, distanceM };

  for (let i = 1; i < track.length; i += 1) {
    const curr = track[i];
    if (curr.distanceM >= distanceM) {
      const prev = track[i - 1];
      const span = curr.distanceM - prev.distanceM;
      if (span <= 0) return { ...curr, distanceM };
      const ratio = (distanceM - prev.distanceM) / span;
      return {
        lat: prev.lat + (curr.lat - prev.lat) * ratio,
        lng: prev.lng + (curr.lng - prev.lng) * ratio,
        ele: getElevationAtDistance(track, distanceM),
        distanceM,
      };
    }
  }

  return { ...last, distanceM };
}

/** Slice track between two cumulative distances; stage-local distanceM starts at 0. */
export function sliceTrackSegment(
  track: TrackPoint[],
  startM: number,
  endM: number,
): TrackPoint[] {
  if (track.length < 2 || endM <= startM) return [];

  const startPoint = pointAtDistance(track, startM);
  const endPoint = pointAtDistance(track, endM);

  const interior = track.filter(
    (pt) => pt.distanceM > startM && pt.distanceM < endM,
  );

  const raw = [startPoint, ...interior, endPoint];
  const deduped: TrackPoint[] = [];

  for (const pt of raw) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      Math.abs(prev.lat - pt.lat) < 1e-8 &&
      Math.abs(prev.lng - pt.lng) < 1e-8
    ) {
      continue;
    }
    deduped.push(pt);
  }

  if (deduped.length < 2) return [];

  return deduped.map((pt) => ({
    lat: pt.lat,
    lng: pt.lng,
    ele: pt.ele,
    distanceM: pt.distanceM - startM,
  }));
}

function filterPoisForStage(
  pois: Poi[],
  startM: number,
  endM: number,
): Poi[] {
  return pois
    .filter(
      (poi) =>
        poi.distanceFromStartM > startM && poi.distanceFromStartM <= endM,
    )
    .map((poi) => ({
      ...poi,
      distanceFromStartM: poi.distanceFromStartM - startM,
    }));
}

function stageStats(track: TrackPoint[], startM: number, endM: number): RoadbookStats {
  const slice = sliceTrackSegment(track, startM, endM);
  if (slice.length < 2) {
    return {
      distanceKm: 0,
      elevationGainM: 0,
      elevationLossM: 0,
      minElevationM: 0,
      maxElevationM: 0,
    };
  }

  const elevation = computeElevationStats(slice);
  const distanceKm = Math.round(((endM - startM) / 1000) * 10) / 10;

  return {
    distanceKm,
    ...elevation,
  };
}

export function buildStageView(multitour: Multitour, stageIndex: number): StageView {
  const stage = multitour.stages[stageIndex];
  const startM = getStageStartDistanceM(multitour.stages, stageIndex);
  const endM = stage.endDistanceM;
  const track = sliceTrackSegment(multitour.track, startM, endM);
  const pois = filterPoisForStage(multitour.pois, startM, endM);

  return {
    index: stageIndex,
    stage,
    startDistanceM: startM,
    endDistanceM: endM,
    track,
    pois,
    stats: stageStats(multitour.track, startM, endM),
    bounds: computeBounds(track),
  };
}

export function buildAllStageViews(multitour: Multitour): StageView[] {
  return multitour.stages.map((_, index) => buildStageView(multitour, index));
}
