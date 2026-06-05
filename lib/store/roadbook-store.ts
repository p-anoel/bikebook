"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mergePois } from "@/lib/gpx/poi-manage";
import { buildStageView } from "@/lib/gpx/stage-slice";
import {
  createDefaultStage,
  normalizeStages,
  splitStagesByTargetKm,
} from "@/lib/gpx/stage-split";
import { migratePersistedRoadbook } from "@/lib/store/roadbook-migrate";
import type { Multitour, Poi, Stage, StageView } from "@/types/roadbook";

interface RoadbookState {
  roadbook: Multitour | null;
  activeStageIndex: number;
  error: string | null;
  isLoading: boolean;
  setRoadbook: (roadbook: Multitour | null) => void;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setActiveStageIndex: (index: number) => void;
  setStages: (stages: Stage[]) => void;
  splitByTargetKm: (targetKmPerDay: number) => void;
  resetToSingleStage: () => void;
  getActiveStageView: () => StageView | null;
  addPoi: (poi: Poi) => void;
  updatePoi: (poiId: string, patch: Pick<Poi, "name" | "description">) => void;
  removePoi: (poiId: string) => void;
  clear: () => void;
}

function clampStageIndex(roadbook: Multitour, index: number): number {
  if (roadbook.stages.length === 0) return 0;
  return Math.max(0, Math.min(index, roadbook.stages.length - 1));
}

export const useRoadbookStore = create<RoadbookState>()(
  persist(
    (set, get) => ({
      roadbook: null,
      activeStageIndex: 0,
      error: null,
      isLoading: false,
      setRoadbook: (roadbook) =>
        set({
          roadbook: roadbook
            ? (migratePersistedRoadbook(roadbook) ?? roadbook)
            : null,
          activeStageIndex: 0,
          error: null,
        }),
      setError: (error) => set({ error }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setActiveStageIndex: (index) =>
        set((state) => {
          if (!state.roadbook) return state;
          return {
            activeStageIndex: clampStageIndex(state.roadbook, index),
          };
        }),
      setStages: (stages) =>
        set((state) => {
          if (!state.roadbook) return state;
          const totalM =
            state.roadbook.track[state.roadbook.track.length - 1].distanceM;
          const normalized = normalizeStages(stages, totalM);
          return {
            roadbook: { ...state.roadbook, stages: normalized },
            activeStageIndex: clampStageIndex(
              { ...state.roadbook, stages: normalized },
              state.activeStageIndex,
            ),
          };
        }),
      splitByTargetKm: (targetKmPerDay) =>
        set((state) => {
          if (!state.roadbook) return state;
          const stages = splitStagesByTargetKm(
            state.roadbook.track,
            targetKmPerDay,
          );
          return {
            roadbook: { ...state.roadbook, stages },
            activeStageIndex: 0,
          };
        }),
      resetToSingleStage: () =>
        set((state) => {
          if (!state.roadbook) return state;
          return {
            roadbook: {
              ...state.roadbook,
              stages: createDefaultStage(state.roadbook.track),
            },
            activeStageIndex: 0,
          };
        }),
      getActiveStageView: () => {
        const { roadbook, activeStageIndex } = get();
        if (!roadbook || roadbook.stages.length === 0) return null;
        return buildStageView(
          roadbook,
          clampStageIndex(roadbook, activeStageIndex),
        );
      },
      addPoi: (poi) =>
        set((state) => {
          if (!state.roadbook) return state;
          return {
            roadbook: {
              ...state.roadbook,
              pois: mergePois([...state.roadbook.pois, poi]),
            },
          };
        }),
      updatePoi: (poiId, patch) =>
        set((state) => {
          if (!state.roadbook) return state;
          return {
            roadbook: {
              ...state.roadbook,
              pois: mergePois(
                state.roadbook.pois.map((poi) =>
                  poi.id === poiId
                    ? {
                        ...poi,
                        name: patch.name.trim() || poi.name,
                        description: patch.description?.trim() || undefined,
                      }
                    : poi,
                ),
              ),
            },
          };
        }),
      removePoi: (poiId) =>
        set((state) => {
          if (!state.roadbook) return state;
          return {
            roadbook: {
              ...state.roadbook,
              pois: state.roadbook.pois.filter((poi) => poi.id !== poiId),
            },
          };
        }),
      clear: () =>
        set({ roadbook: null, activeStageIndex: 0, error: null, isLoading: false }),
    }),
    {
      name: "bikebook-roadbook",
      version: 1,
      partialize: (state) => ({
        roadbook: state.roadbook,
        activeStageIndex: state.activeStageIndex,
      }),
      migrate: (persisted, version) => {
        if (version === 0 || version === undefined) {
          const legacy = persisted as {
            roadbook?: unknown;
            activeStageIndex?: number;
          };
          const roadbook = migratePersistedRoadbook(legacy.roadbook);
          return {
            roadbook,
            activeStageIndex: legacy.activeStageIndex ?? 0,
            error: null,
            isLoading: false,
          };
        }
        return persisted as RoadbookState;
      },
    },
  ),
);

/** Derived stage view; memoized — do not use as a bare Zustand selector (new refs each call). */
export function useActiveStageView(): StageView | null {
  const roadbook = useRoadbookStore((state) => state.roadbook);
  const activeStageIndex = useRoadbookStore((state) => state.activeStageIndex);

  return useMemo(() => {
    if (!roadbook || roadbook.stages.length === 0) return null;
    return buildStageView(
      roadbook,
      clampStageIndex(roadbook, activeStageIndex),
    );
  }, [roadbook, activeStageIndex]);
}
