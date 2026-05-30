import { getElevationAtDistance, haversineDistanceM } from "@/lib/gpx/elevation";
import { roundDistanceKm } from "@/lib/pdf/elevation-chart";
import type { TrackPoint } from "@/types/roadbook";

export const MIN_ZOOM_SPAN_KM = 2;

export type GradeBand = "flat" | "moderate" | "steep";

export interface ClimbSegment {
  id: number;
  startDistanceM: number;
  endDistanceM: number;
  gainM: number;
  lengthM: number;
  avgGradePct: number;
}

export interface ProfileChartPoint {
  distanceKm: number;
  elevation: number;
  gradePct: number;
  band: GradeBand;
  flat: number | null;
  moderate: number | null;
  steep: number | null;
  climb: ClimbSegment | null;
}

export const GRADE_BAND_COLORS: Record<GradeBand, string> = {
  flat: "#93c5fd",
  moderate: "#fde047",
  steep: "#fb923c",
};

const GRADE_COLOR_STOPS: Array<{ grade: number; color: string }> = [
  { grade: -8, color: "#dbeafe" },
  { grade: -2, color: "#bfdbfe" },
  { grade: 0, color: "#93c5fd" },
  { grade: 2, color: "#7dd3fc" },
  { grade: 4, color: "#fde047" },
  { grade: 6, color: "#fb923c" },
  { grade: 8, color: "#f97316" },
  { grade: 10, color: "#ef4444" },
  { grade: 14, color: "#dc2626" },
];

/** Richer palette for the interactive map track and its legend. */
export const MAP_GRADE_COLOR_STOPS: Array<{ grade: number; color: string }> = [
  { grade: -8, color: "#3b82f6" },
  { grade: -2, color: "#0ea5e9" },
  { grade: 0, color: "#06b6d4" },
  { grade: 2, color: "#14b8a6" },
  { grade: 4, color: "#eab308" },
  { grade: 6, color: "#f97316" },
  { grade: 8, color: "#ea580c" },
  { grade: 10, color: "#ef4444" },
  { grade: 14, color: "#b91c1c" },
];

function parseHexColor(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function toHexColor(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function lerpHexColor(from: string, to: string, ratio: number): string {
  const [r1, g1, b1] = parseHexColor(from);
  const [r2, g2, b2] = parseHexColor(to);
  const t = Math.max(0, Math.min(1, ratio));
  return toHexColor(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function colorFromGradeStops(
  gradePct: number,
  stops: Array<{ grade: number; color: string }>,
): string {
  const grade = Math.max(stops[0].grade, Math.min(gradePct, stops.at(-1)!.grade));

  for (let index = 1; index < stops.length; index += 1) {
    const prev = stops[index - 1];
    const next = stops[index];
    if (grade <= next.grade) {
      const span = next.grade - prev.grade;
      const ratio = span === 0 ? 0 : (grade - prev.grade) / span;
      return lerpHexColor(prev.color, next.color, ratio);
    }
  }

  return stops.at(-1)!.color;
}

/** Continuous grade color from descent (pale blue) to steep climb (red). */
export function colorForGradePct(gradePct: number): string {
  return colorFromGradeStops(gradePct, GRADE_COLOR_STOPS);
}

/** Saturated grade colors for the map track. */
export function colorForMapGradePct(gradePct: number): string {
  return colorFromGradeStops(gradePct, MAP_GRADE_COLOR_STOPS);
}

export function buildMapGradeLegendGradient(
  stops: Array<{ grade: number; color: string }> = MAP_GRADE_COLOR_STOPS,
): string {
  const minGrade = stops[0].grade;
  const maxGrade = stops.at(-1)!.grade;
  const span = maxGrade - minGrade;
  const cssStops = stops.map(({ grade, color }) => {
    const pct = span === 0 ? 0 : ((grade - minGrade) / span) * 100;
    return `${color} ${pct.toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${cssStops.join(", ")})`;
}

const MODERATE_GRADE_PCT = 3;
const STEEP_GRADE_PCT = 6;
const GRADE_WINDOW_M = 60;
const TOOLTIP_GRADE_WINDOW_M = 30;
const CLIMB_MIN_GAIN_M = 12;
const CLIMB_MIN_LENGTH_M = 350;
const CLIMB_MIN_AVG_GRADE_PCT = 2.5;
const CLIMB_BREAK_DROP_M = 10;
const CLIMB_BREAK_FLAT_M = 150;

function segmentGradePct(prev: TrackPoint, curr: TrackPoint): number {
  const horizontalM = haversineDistanceM(prev.lat, prev.lng, curr.lat, curr.lng);
  if (horizontalM < 1) return 0;
  return ((curr.ele - prev.ele) / horizontalM) * 100;
}

export function gradeBandForPct(gradePct: number): GradeBand {
  const climbing = Math.max(gradePct, 0);
  if (climbing >= STEEP_GRADE_PCT) return "steep";
  if (climbing >= MODERATE_GRADE_PCT) return "moderate";
  return "flat";
}

/** Grade over a symmetric distance window around a point on the track. */
export function instantGradeAtDistance(
  track: TrackPoint[],
  distanceM: number,
  halfWindowM = GRADE_WINDOW_M / 2,
): number {
  if (track.length < 2) return 0;

  const maxDistance = track[track.length - 1].distanceM;
  const fromM = Math.max(0, distanceM - halfWindowM);
  const toM = Math.min(maxDistance, distanceM + halfWindowM);
  const spanM = toM - fromM;

  if (spanM < 20) return 0;

  const eleFrom = getElevationAtDistance(track, fromM);
  const eleTo = getElevationAtDistance(track, toM);

  return ((eleTo - eleFrom) / spanM) * 100;
}

export function detectClimbs(track: TrackPoint[]): ClimbSegment[] {
  if (track.length < 2) return [];

  const climbs: ClimbSegment[] = [];
  let startIndex = -1;
  let peakIndex = -1;
  let peakEle = -Infinity;
  let dropSincePeakM = 0;
  let descentLengthM = 0;

  const closeClimb = (endIndex: number) => {
    if (startIndex < 0 || peakIndex < 0) return;

    const start = track[startIndex];
    const end = track[endIndex];
    const climbGain = end.ele - start.ele;
    let climbLength = 0;
    for (let i = startIndex + 1; i <= endIndex; i += 1) {
      const prev = track[i - 1];
      const curr = track[i];
      climbLength += haversineDistanceM(prev.lat, prev.lng, curr.lat, curr.lng);
    }

    if (
      climbGain >= CLIMB_MIN_GAIN_M &&
      climbLength >= CLIMB_MIN_LENGTH_M &&
      (climbGain / climbLength) * 100 >= CLIMB_MIN_AVG_GRADE_PCT
    ) {
      climbs.push({
        id: climbs.length + 1,
        startDistanceM: start.distanceM,
        endDistanceM: end.distanceM,
        gainM: Math.round(climbGain),
        lengthM: Math.round(climbLength),
        avgGradePct: Math.round((climbGain / climbLength) * 1000) / 10,
      });
    }

    startIndex = -1;
    peakIndex = -1;
    peakEle = -Infinity;
    dropSincePeakM = 0;
    descentLengthM = 0;
  };

  const tryStartClimb = (index: number, horizontalM: number, deltaEle: number) => {
    if (startIndex >= 0 || horizontalM < 1 || deltaEle <= 0) return;
    const grade = (deltaEle / horizontalM) * 100;
    if (grade >= CLIMB_MIN_AVG_GRADE_PCT) {
      startIndex = index - 1;
      peakIndex = index;
      peakEle = track[index].ele;
      dropSincePeakM = 0;
      descentLengthM = 0;
    }
  };

  for (let index = 1; index < track.length; index += 1) {
    const prev = track[index - 1];
    const curr = track[index];
    const deltaEle = curr.ele - prev.ele;
    const horizontalM = haversineDistanceM(prev.lat, prev.lng, curr.lat, curr.lng);

    if (startIndex < 0) {
      tryStartClimb(index, horizontalM, deltaEle);
      if (startIndex >= 0 && index === track.length - 1) {
        closeClimb(index);
      }
      continue;
    }

    if (deltaEle > 0) {
      peakIndex = index;
      peakEle = curr.ele;
      dropSincePeakM = 0;
      descentLengthM = 0;
    } else {
      dropSincePeakM = peakEle - curr.ele;
      descentLengthM += horizontalM;
    }

    const endOfClimb =
      dropSincePeakM >= CLIMB_BREAK_DROP_M ||
      descentLengthM >= CLIMB_BREAK_FLAT_M ||
      index === track.length - 1;

    if (endOfClimb) {
      const endIndex = dropSincePeakM >= CLIMB_BREAK_DROP_M ? peakIndex : index;
      closeClimb(endIndex);
      if (index < track.length - 1 && deltaEle > 0) {
        tryStartClimb(index, horizontalM, deltaEle);
      }
    }
  }

  return climbs;
}

function climbAtDistance(climbs: ClimbSegment[], distanceM: number): ClimbSegment | null {
  return (
    climbs.find(
      (climb) => distanceM >= climb.startDistanceM && distanceM <= climb.endDistanceM,
    ) ?? null
  );
}

export function sampleProfileTrack(track: TrackPoint[], maxPoints = 1200): TrackPoint[] {
  if (track.length <= maxPoints) return track;
  const step = Math.ceil(track.length / maxPoints);
  return track.filter((_, index) => index % step === 0 || index === track.length - 1);
}

export function buildGradientProfile(
  track: TrackPoint[],
  maxPoints = 1200,
): {
  profile: ProfileChartPoint[];
  climbs: ClimbSegment[];
} {
  if (track.length === 0) return { profile: [], climbs: [] };

  const displayTrack = sampleProfileTrack(track, maxPoints);
  const climbs = detectClimbs(track);

  const profile = displayTrack.map((point) => {
    const gradePct = Math.round(instantGradeAtDistance(track, point.distanceM) * 10) / 10;
    const elevation = point.ele;
    const climb = climbAtDistance(climbs, point.distanceM);

    return {
      distanceKm: point.distanceM / 1000,
      elevation,
      gradePct,
      band: gradeBandForPct(gradePct),
      flat: null,
      moderate: null,
      steep: null,
      climb,
    };
  });

  return { profile, climbs };
}

export function getProfileAtDistance(
  track: TrackPoint[],
  distanceKm: number,
  climbs: ClimbSegment[],
): { distanceKm: number; elevation: number; gradePct: number; climb: ClimbSegment | null } | null {
  if (track.length === 0) return null;

  const distanceM = Math.max(0, Math.min(distanceKm * 1000, track[track.length - 1].distanceM));
  const elevation = getElevationAtDistance(track, distanceM);
  const gradePct =
    Math.round(instantGradeAtDistance(track, distanceM, TOOLTIP_GRADE_WINDOW_M / 2) * 10) / 10;

  return {
    distanceKm: distanceM / 1000,
    elevation: Math.round(elevation),
    gradePct,
    climb: climbAtDistance(climbs, distanceM),
  };
}

export interface ElevationAxisConfig {
  yDomain: [number, number];
  areaBaseline: number;
  showSeaLevel: boolean;
}

export function getElevationAxisConfig(track: TrackPoint[]): ElevationAxisConfig {
  if (track.length === 0) {
    return { yDomain: [0, 100], areaBaseline: 0, showSeaLevel: false };
  }

  const eles = track.map((point) => point.ele);
  const min = Math.min(...eles);
  const max = Math.max(...eles);
  const span = max - min || 20;
  const padding = Math.max(8, Math.round(span * 0.08));

  let domainMin = Math.floor(min - padding);
  let domainMax = Math.ceil(max + padding);

  const crossesSeaLevel = min < 0 && max > 0;
  const nearSeaLevel = min >= 0 && min < 20;
  const belowSeaLevelOnly = max <= 0;
  const showSeaLevel = crossesSeaLevel || nearSeaLevel || belowSeaLevelOnly;

  if (showSeaLevel) {
    domainMin = Math.min(domainMin, 0);
  }
  if (belowSeaLevelOnly) {
    domainMax = Math.max(domainMax, 0);
  }

  if (domainMax - domainMin < 20) {
    const mid = (min + max) / 2;
    domainMin = Math.floor(mid - 10);
    domainMax = Math.ceil(mid + 10);
    if (showSeaLevel) {
      domainMin = Math.min(domainMin, 0);
    }
  }

  const yDomain: [number, number] = [domainMin, domainMax];
  const areaBaseline =
    crossesSeaLevel || nearSeaLevel ? 0 : yDomain[0];

  return { yDomain, areaBaseline, showSeaLevel };
}

export function getElevationYDomain(track: TrackPoint[]): [number, number] {
  return getElevationAxisConfig(track).yDomain;
}

export function buildDistanceTicks(maxDistanceKm: number): number[] {
  return buildDistanceTicksForRange(0, maxDistanceKm);
}

export function buildDistanceTicksForRange(startKm: number, endKm: number): number[] {
  if (endKm <= startKm) {
    return [roundTickValue(startKm, 0.2)];
  }

  const span = endKm - startKm;
  let step =
    span <= 1 ? 0.2 : span <= 3 ? 0.5 : span <= 10 ? 1 : span <= 30 ? 2 : span <= 100 ? 2 : span <= 150 ? 5 : 10;

  const maxTicks = 14;
  while (span / step > maxTicks) {
    step *= 2;
  }

  const seen = new Set<number>();
  const ticks: number[] = [];

  const addTick = (km: number) => {
    const rounded = roundTickValue(km, step);
    const key = Math.round(rounded * 1000);
    if (seen.has(key)) return;
    seen.add(key);
    ticks.push(rounded);
  };

  addTick(startKm);

  const first = Math.ceil(startKm / step) * step;
  for (let km = first; km < endKm - step * 0.2; km += step) {
    addTick(km);
  }

  addTick(endKm);

  return ticks.sort((a, b) => a - b);
}

function roundTickValue(km: number, step: number): number {
  if (step >= 5) return Math.round(km);
  if (step >= 1) return Math.round(km * 10) / 10;
  return Math.round(km * 100) / 100;
}

export function sliceTrackByDistance(
  track: TrackPoint[],
  startKm: number,
  endKm: number,
): TrackPoint[] {
  const startM = startKm * 1000;
  const endM = endKm * 1000;
  return track.filter((point) => point.distanceM >= startM && point.distanceM <= endM);
}

export function maxPointsForSpan(spanKm: number): number {
  if (spanKm <= 0.5) return 3000;
  if (spanKm <= 2) return 2500;
  if (spanKm <= 8) return 2000;
  if (spanKm <= 20) return 1500;
  return 1200;
}

export function clampZoomDomain(
  domain: [number, number],
  fullDomain: [number, number],
  minSpanKm = MIN_ZOOM_SPAN_KM,
): [number, number] {
  const [fullStart, fullEnd] = fullDomain;
  const fullSpan = fullEnd - fullStart;
  const minSpan = Math.min(minSpanKm, fullSpan);
  let span = Math.max(minSpan, Math.min(domain[1] - domain[0], fullSpan));
  let start = domain[0];
  let end = start + span;

  if (start < fullStart) {
    start = fullStart;
    end = start + span;
  }
  if (end > fullEnd) {
    end = fullEnd;
    start = end - span;
  }

  return [start, end];
}

export function applyWheelZoom(
  domain: [number, number],
  fullDomain: [number, number],
  centerKm: number,
  deltaY: number,
  sensitivity = 0.006,
): [number, number] | null {
  const span = domain[1] - domain[0];
  if (span <= 0) return null;

  const factor = Math.exp(deltaY * sensitivity);
  const newSpan = span * factor;
  const ratio = (centerKm - domain[0]) / span;
  const next: [number, number] = [
    centerKm - newSpan * ratio,
    centerKm + newSpan * (1 - ratio),
  ];
  const clamped = clampZoomDomain(next, fullDomain);
  return isFullZoomDomain(clamped, fullDomain) ? null : clamped;
}

export function climbZoomDomain(
  climb: ClimbSegment,
  fullDomain: [number, number],
  paddingRatio = 0.08,
): [number, number] {
  const startKm = climb.startDistanceM / 1000;
  const endKm = climb.endDistanceM / 1000;
  const span = endKm - startKm;
  const pad = Math.max(span * paddingRatio, 0.2);
  return clampZoomDomain([startKm - pad, endKm + pad], fullDomain);
}

export function poiZoomDomain(
  distanceKm: number,
  fullDomain: [number, number],
  paddingKm = 0.5,
): [number, number] {
  const pad = Math.max(paddingKm, 0.2);
  return clampZoomDomain([distanceKm - pad, distanceKm + pad], fullDomain);
}

export function applyHorizontalPan(
  domain: [number, number],
  fullDomain: [number, number],
  panKm: number,
): [number, number] {
  if (panKm === 0) return domain;
  return clampZoomDomain([domain[0] + panKm, domain[1] + panKm], fullDomain);
}

export function isFullZoomDomain(
  domain: [number, number],
  fullDomain: [number, number],
  toleranceKm = 0.05,
): boolean {
  return (
    Math.abs(domain[0] - fullDomain[0]) <= toleranceKm &&
    Math.abs(domain[1] - fullDomain[1]) <= toleranceKm
  );
}

function profilePointAtDistance(
  track: TrackPoint[],
  distanceM: number,
  climbs: ClimbSegment[],
): ProfileChartPoint {
  const gradePct = Math.round(instantGradeAtDistance(track, distanceM) * 10) / 10;

  return {
    distanceKm: distanceM / 1000,
    elevation: getElevationAtDistance(track, distanceM),
    gradePct,
    band: gradeBandForPct(gradePct),
    flat: null,
    moderate: null,
    steep: null,
    climb: climbAtDistance(climbs, distanceM),
  };
}

function withDomainEndpoints(
  profile: ProfileChartPoint[],
  track: TrackPoint[],
  startKm: number,
  endKm: number,
  climbs: ClimbSegment[],
): ProfileChartPoint[] {
  if (profile.length === 0) return profile;

  const startM = startKm * 1000;
  const endM = endKm * 1000;
  const result = [...profile];

  if (result[0].distanceKm * 1000 > startM + 0.5) {
    result.unshift(profilePointAtDistance(track, startM, climbs));
  }
  if (result[result.length - 1].distanceKm * 1000 < endM - 0.5) {
    result.push(profilePointAtDistance(track, endM, climbs));
  }

  return result;
}

export function buildGradientProfileForRange(
  track: TrackPoint[],
  startKm: number,
  endKm: number,
  climbs: ClimbSegment[],
  maxPointsOverride?: number,
): ProfileChartPoint[] {
  const slice = sliceTrackByDistance(track, startKm, endKm);
  if (slice.length === 0) return [];

  const spanKm = endKm - startKm;
  const maxPoints = maxPointsOverride ?? maxPointsForSpan(spanKm);
  const displayTrack = sampleProfileTrack(slice, maxPoints);

  const seen = new Set<number>();

  return withDomainEndpoints(
    displayTrack.flatMap((point) => {
      const distanceKm = roundDistanceKm(point.distanceM / 1000);
      const key = Math.round(distanceKm * 100);
      if (seen.has(key)) return [];
      seen.add(key);

      const gradePct = Math.round(instantGradeAtDistance(track, point.distanceM) * 10) / 10;

      return [
        {
          distanceKm,
          elevation: point.ele,
          gradePct,
          band: gradeBandForPct(gradePct),
          flat: null,
          moderate: null,
          steep: null,
          climb: climbAtDistance(climbs, point.distanceM),
        },
      ];
    }),
    track,
    startKm,
    endKm,
    climbs,
  );
}

/** @deprecated Used by tests — prefer instantGradeAtDistance on full track. */
export function getGradeAtDistance(
  profile: ProfileChartPoint[],
  distanceKm: number,
  climbs: ClimbSegment[],
): { gradePct: number; elevation: number; climb: ClimbSegment | null } | null {
  if (profile.length === 0) return null;

  const distanceM = distanceKm * 1000;
  if (distanceM <= profile[0].distanceKm * 1000) {
    return {
      gradePct: profile[0].gradePct,
      elevation: profile[0].elevation,
      climb: climbAtDistance(climbs, distanceM),
    };
  }

  const last = profile[profile.length - 1];
  if (distanceM >= last.distanceKm * 1000) {
    return {
      gradePct: last.gradePct,
      elevation: last.elevation,
      climb: climbAtDistance(climbs, distanceM),
    };
  }

  for (let index = 1; index < profile.length; index += 1) {
    const curr = profile[index];
    const prev = profile[index - 1];
    const currM = curr.distanceKm * 1000;
    const prevM = prev.distanceKm * 1000;

    if (distanceM <= currM) {
      const span = currM - prevM;
      const ratio = span === 0 ? 0 : (distanceM - prevM) / span;
      return {
        gradePct: Math.round((prev.gradePct + ratio * (curr.gradePct - prev.gradePct)) * 10) / 10,
        elevation: Math.round(prev.elevation + ratio * (curr.elevation - prev.elevation)),
        climb: climbAtDistance(climbs, distanceM),
      };
    }
  }

  return null;
}

/** Segment grades between consecutive points (for tests). */
export function segmentGrades(track: TrackPoint[]): number[] {
  if (track.length < 2) return [];
  return track.slice(1).map((point, index) => segmentGradePct(track[index], point));
}
