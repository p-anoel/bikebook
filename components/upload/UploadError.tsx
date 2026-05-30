"use client";

import { useRoadbookStore } from "@/lib/store/roadbook-store";

export function UploadError() {
  const error = useRoadbookStore((state) => state.error);

  if (!error) return null;

  return (
    <p
      role="alert"
      className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {error}
    </p>
  );
}
