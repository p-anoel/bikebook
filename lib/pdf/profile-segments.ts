import type { ClimbSegment } from "@/lib/gpx/gradient";
import type { Poi, TrackPoint } from "@/types/roadbook";

/** Max distance (km) on one landscape profile page before a new page. */
export const LANDSCAPE_PROFILE_PAGE_MAX_KM = 250;

/** Number of elevation strips (rows) per landscape profile page. */
export const LANDSCAPE_PROFILE_STRIPS_PER_PAGE = 4;

export interface ProfileDistanceChunk {
  startKm: number;
  endKm: number;
  index: number;
}

/**
 * Builds landscape profile pages: each page covers up to {@link LANDSCAPE_PROFILE_PAGE_MAX_KM}
 * and is split into {@link LANDSCAPE_PROFILE_STRIPS_PER_PAGE} equal-distance strips.
 */
export function buildLandscapeProfilePages(
  totalDistanceKm: number,
): ProfileDistanceChunk[][] {
  if (totalDistanceKm <= 0) {
    return [[{ startKm: 0, endKm: 0, index: 0 }]];
  }

  const pages: ProfileDistanceChunk[][] = [];
  let pageStartKm = 0;
  let globalIndex = 0;

  while (pageStartKm < totalDistanceKm - 1e-6) {
    const pageEndKm = Math.min(
      pageStartKm + LANDSCAPE_PROFILE_PAGE_MAX_KM,
      totalDistanceKm,
    );
    const pageSpanKm = pageEndKm - pageStartKm;
    const stripSpanKm = pageSpanKm / LANDSCAPE_PROFILE_STRIPS_PER_PAGE;
    const strips: ProfileDistanceChunk[] = [];

    for (let strip = 0; strip < LANDSCAPE_PROFILE_STRIPS_PER_PAGE; strip += 1) {
      const startKm = pageStartKm + strip * stripSpanKm;
      const endKm =
        strip === LANDSCAPE_PROFILE_STRIPS_PER_PAGE - 1
          ? pageEndKm
          : pageStartKm + (strip + 1) * stripSpanKm;
      strips.push({ startKm, endKm, index: globalIndex });
      globalIndex += 1;
    }

    pages.push(strips);
    pageStartKm = pageEndKm;
  }

  return pages;
}

export function climbsInDistanceRange(
  climbs: ClimbSegment[],
  startKm: number,
  endKm: number,
): ClimbSegment[] {
  const startM = startKm * 1000;
  const endM = endKm * 1000;
  return climbs.filter(
    (climb) => climb.endDistanceM > startM && climb.startDistanceM < endM,
  );
}

export function poisInDistanceRange<T extends Pick<Poi, "distanceFromStartM">>(
  pois: T[],
  startKm: number,
  endKm: number,
): T[] {
  const startM = startKm * 1000;
  const endM = endKm * 1000;
  const exclusiveStart = startKm > 0.001;
  return pois.filter((poi) => {
    const d = poi.distanceFromStartM;
    if (d > endM) return false;
    if (exclusiveStart) return d > startM && d <= endM;
    return d >= startM && d <= endM;
  });
}

export function formatProfileChunkLabel(
  startKm: number,
  endKm: number,
  locale: string,
): string {
  const fmt = (km: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(km));
  return `Km ${fmt(startKm)} – ${fmt(endKm)}`;
}

export function endpointMarkersForChunk(
  track: TrackPoint[],
  startKm: number,
  endKm: number,
): { showStart: boolean; showFinish: boolean } {
  const totalKm = (track[track.length - 1]?.distanceM ?? 0) / 1000;
  return {
    showStart: startKm <= 0.001,
    showFinish: endKm >= totalKm - 0.001,
  };
}

const LANDSCAPE_PAGE_CONTENT_HEIGHT = 515;
const LANDSCAPE_HEADER_HEIGHT = 50;
const CHART_BOX_VERTICAL_PADDING = 16;
const STRIP_LABEL_HEIGHT = 14;
const STRIP_GAP = 8;
const STRIP_MAX_HEIGHT = 220;
/** Extra vertical slack so react-pdf does not split the last strip across pages. */
const STRIP_PAGE_SAFETY_MARGIN = 16;

function landscapeStripAvailableHeight(stripCount: number): number {
  return (
    LANDSCAPE_PAGE_CONTENT_HEIGHT -
    LANDSCAPE_HEADER_HEIGHT -
    CHART_BOX_VERTICAL_PADDING -
    STRIP_PAGE_SAFETY_MARGIN -
    stripCount * (STRIP_LABEL_HEIGHT + STRIP_GAP)
  );
}

function landscapeStripHeightUncapped(stripCount: number): number {
  if (stripCount <= 0) return STRIP_MAX_HEIGHT;
  return Math.floor(landscapeStripAvailableHeight(stripCount) / stripCount);
}

/** Evenly divides the landscape chart area among the strips on one page. */
export function landscapeStripHeightForPage(stripCount: number): number {
  if (stripCount <= 0) return STRIP_MAX_HEIGHT;
  return Math.min(STRIP_MAX_HEIGHT, landscapeStripHeightUncapped(stripCount));
}
