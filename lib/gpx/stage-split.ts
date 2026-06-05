import type { Stage, TrackPoint } from "@/types/roadbook";

export const DEFAULT_TARGET_KM_PER_DAY = 120;
export const LONG_ROUTE_THRESHOLD_KM = 150;

export function createDefaultStage(track: TrackPoint[]): Stage[] {
  if (track.length < 2) {
    return [{ id: crypto.randomUUID(), endDistanceM: 0 }];
  }

  return [
    {
      id: crypto.randomUUID(),
      endDistanceM: track[track.length - 1].distanceM,
    },
  ];
}

/** Ensure stages are valid: sorted, last ends at total distance, at least one stage. */
export function normalizeStages(
  stages: Stage[],
  totalDistanceM: number,
): Stage[] {
  if (stages.length === 0) {
    return [{ id: crypto.randomUUID(), endDistanceM: totalDistanceM }];
  }

  const sorted = [...stages].sort((a, b) => a.endDistanceM - b.endDistanceM);
  const normalized = sorted.map((stage, index) => ({
    ...stage,
    endDistanceM:
      index === sorted.length - 1
        ? totalDistanceM
        : Math.min(Math.max(stage.endDistanceM, 1), totalDistanceM),
  }));

  // Drop duplicate end distances (keep first of each boundary)
  const deduped: Stage[] = [];
  for (const stage of normalized) {
    const prev = deduped[deduped.length - 1];
    if (prev && stage.endDistanceM <= prev.endDistanceM) continue;
    deduped.push(stage);
  }

  if (deduped.length === 0) {
    return [{ id: crypto.randomUUID(), endDistanceM: totalDistanceM }];
  }

  deduped[deduped.length - 1] = {
    ...deduped[deduped.length - 1],
    endDistanceM: totalDistanceM,
  };

  return deduped;
}

/** Split a track into stages of roughly targetKmPerDay kilometres. */
export function splitStagesByTargetKm(
  track: TrackPoint[],
  targetKmPerDay: number,
): Stage[] {
  if (track.length < 2) {
    return createDefaultStage(track);
  }

  const totalM = track[track.length - 1].distanceM;
  const targetM = Math.max(targetKmPerDay * 1000, 1000);

  if (totalM <= targetM) {
    return createDefaultStage(track);
  }

  const stages: Stage[] = [];
  let endM = targetM;

  while (endM < totalM - 1) {
    stages.push({ id: crypto.randomUUID(), endDistanceM: endM });
    endM += targetM;
  }

  stages.push({ id: crypto.randomUUID(), endDistanceM: totalM });
  return normalizeStages(stages, totalM);
}

export function isLongRoute(distanceKm: number): boolean {
  return distanceKm > LONG_ROUTE_THRESHOLD_KM;
}
