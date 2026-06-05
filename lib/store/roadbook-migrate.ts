import { createDefaultStage, normalizeStages } from "@/lib/gpx/stage-split";
import type { Multitour, Roadbook, Stage } from "@/types/roadbook";

interface LegacyRoadbook {
  id: string;
  name: string;
  uploadedAt: string;
  stats: Multitour["stats"];
  track: Multitour["track"];
  pois: Multitour["pois"];
  bounds: Multitour["bounds"];
  stages?: Stage[];
}

export function migratePersistedRoadbook(raw: unknown): Roadbook | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as LegacyRoadbook;
  if (!candidate.id || !Array.isArray(candidate.track) || candidate.track.length < 2) {
    return null;
  }

  const totalM = candidate.track[candidate.track.length - 1].distanceM;
  const stages = candidate.stages?.length
    ? normalizeStages(candidate.stages, totalM)
    : createDefaultStage(candidate.track);

  return {
    id: candidate.id,
    name: candidate.name,
    uploadedAt: candidate.uploadedAt,
    stats: candidate.stats,
    track: candidate.track,
    pois: candidate.pois ?? [],
    bounds: candidate.bounds,
    stages,
  };
}
