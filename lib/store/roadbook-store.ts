import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mergePois } from "@/lib/gpx/poi-manage";
import type { Poi, Roadbook } from "@/types/roadbook";

interface RoadbookState {
  roadbook: Roadbook | null;
  error: string | null;
  isLoading: boolean;
  setRoadbook: (roadbook: Roadbook | null) => void;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  addPoi: (poi: Poi) => void;
  updatePoi: (poiId: string, patch: Pick<Poi, "name" | "description">) => void;
  removePoi: (poiId: string) => void;
  clear: () => void;
}

export const useRoadbookStore = create<RoadbookState>()(
  persist(
    (set) => ({
      roadbook: null,
      error: null,
      isLoading: false,
      setRoadbook: (roadbook) => set({ roadbook, error: null }),
      setError: (error) => set({ error }),
      setIsLoading: (isLoading) => set({ isLoading }),
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
      clear: () => set({ roadbook: null, error: null, isLoading: false }),
    }),
    {
      name: "bikebook-roadbook",
      partialize: (state) => ({ roadbook: state.roadbook }),
    },
  ),
);
