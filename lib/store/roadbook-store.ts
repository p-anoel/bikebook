import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Roadbook } from "@/types/roadbook";

interface RoadbookState {
  roadbook: Roadbook | null;
  error: string | null;
  isLoading: boolean;
  setRoadbook: (roadbook: Roadbook | null) => void;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
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
      clear: () => set({ roadbook: null, error: null, isLoading: false }),
    }),
    {
      name: "bikebook-roadbook",
      partialize: (state) => ({ roadbook: state.roadbook }),
    },
  ),
);
