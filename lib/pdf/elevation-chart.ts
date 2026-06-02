import type { Poi, TrackPoint } from "@/types/roadbook";
import { getElevationAtDistance } from "@/lib/gpx/elevation";
import { sortPoisByDistance } from "@/lib/gpx/poi";
import {
  buildDistanceTicksForRange,
  buildGradientProfile,
  buildGradientProfileForRange,
  colorForGradePct,
  detectClimbs,
  getElevationAxisConfig,
  sliceTrackByDistance,
  type ClimbSegment,
} from "@/lib/gpx/gradient";

export interface ElevationChartPoint {
  distanceKm: number;
  elevation: number;
}

export interface ElevationPoiPoint {
  id: string;
  number: number;
  name: string;
  distanceKm: number;
  elevation: number;
  description?: string;
}

export interface ElevationMarkerPoint {
  kind: "start" | "finish";
  distanceKm: number;
  elevation: number;
}

export const PDF_PROFILE_LEFT_GUTTER = 34;
export const PDF_PROFILE_RIGHT_PADDING = 12;
export const PDF_PROFILE_TOP_PADDING = 34;
export const PDF_PROFILE_BOTTOM_PADDING = 18;

export interface ChartLayout {
  width: number;
  height: number;
  plotLeft: number;
  plotTop: number;
  plotRight: number;
  plotBottom: number;
  maxDistanceKm: number;
  distanceDomain: [number, number];
  yDomain: [number, number];
  areaBaseline: number;
  showSeaLevel: boolean;
  toXY: (distanceKm: number, elevation: number) => { x: number; y: number };
  elevationToY: (elevation: number) => number;
}

export interface PdfClimbHighlight {
  id: number;
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  badgeX: number;
  badgeY: number;
  badgeR: number;
}

export function buildPdfClimbHighlights(
  climbs: ClimbSegment[],
  layout: ChartLayout,
): PdfClimbHighlight[] {
  const height = layout.plotBottom - layout.plotTop;
  if (height <= 0 || climbs.length === 0) return [];

  return climbs.map((climb) => {
    const startKm = climb.startDistanceM / 1000;
    const endKm = climb.endDistanceM / 1000;
    const xStart = layout.toXY(startKm, layout.yDomain[0]).x;
    const xEnd = layout.toXY(endKm, layout.yDomain[0]).x;
    const x = Math.min(xStart, xEnd);
    const width = Math.max(Math.abs(xEnd - xStart), 3);

    return {
      id: climb.id,
      number: climb.id,
      x,
      y: layout.plotTop,
      width,
      height,
      badgeX: x + width / 2,
      badgeY: layout.plotTop + 9,
      badgeR: climb.id > 9 ? 7 : 6,
    };
  });
}

export { detectClimbs, type ClimbSegment };

export interface PdfGradeSegment {
  key: string;
  d: string;
  fill: string;
}

export interface PdfAxisTick {
  value: number;
  x: number;
  y: number;
  label: string;
}

export interface PdfElevationChartModel {
  layout: ChartLayout;
  gradeSegments: PdfGradeSegment[];
  profileLinePath: string;
  xGridLines: number[];
  xTicks: PdfAxisTick[];
  yGridLines: number[];
  yTicks: PdfAxisTick[];
  seaLevelY: number | null;
  variant: "standard" | "strip";
}

export function buildElevationChartData(track: TrackPoint[]): ElevationChartPoint[] {
  return track.map((point) => ({
    distanceKm: point.distanceM / 1000,
    elevation: point.ele,
  }));
}

export function buildElevationPoiPoints(
  track: TrackPoint[],
  pois: Poi[],
): ElevationPoiPoint[] {
  return sortPoisByDistance(pois).map((poi, index) => ({
    id: poi.id,
    number: index + 1,
    name: poi.name,
    distanceKm: poi.distanceFromStartM / 1000,
    elevation: getElevationAtDistance(track, poi.distanceFromStartM),
    description: poi.description,
  }));
}

export function buildStartFinishMarkers(track: TrackPoint[]): ElevationMarkerPoint[] {
  if (track.length === 0) return [];

  const start = track[0];
  const finish = track[track.length - 1];

  return [
    {
      kind: "start",
      distanceKm: start.distanceM / 1000,
      elevation: start.ele,
    },
    {
      kind: "finish",
      distanceKm: finish.distanceM / 1000,
      elevation: finish.ele,
    },
  ];
}

export function roundDistanceKm(km: number): number {
  return Math.round(km * 100) / 100;
}

export function getElevationChartDomain(track: TrackPoint[]): [number, number] {
  const maxDistanceKm = (track[track.length - 1]?.distanceM ?? 0) / 1000;
  return [0, roundDistanceKm(maxDistanceKm)];
}

function elevationAxisForTrack(
  track: TrackPoint[],
  distanceDomain?: [number, number],
): ReturnType<typeof getElevationAxisConfig> {
  if (!distanceDomain) return getElevationAxisConfig(track);

  const [startKm, endKm] = distanceDomain;
  const slice = sliceTrackByDistance(track, startKm, endKm);
  if (slice.length >= 2) return getElevationAxisConfig(slice);
  return getElevationAxisConfig(track);
}

export function buildChartLayout(
  track: TrackPoint[],
  width: number,
  height: number,
  plotLeft = PDF_PROFILE_LEFT_GUTTER,
  plotTop = PDF_PROFILE_TOP_PADDING,
  plotRight?: number,
  plotBottom?: number,
  distanceDomain?: [number, number],
): ChartLayout {
  const right = plotRight ?? width - PDF_PROFILE_RIGHT_PADDING;
  const bottom = plotBottom ?? height - PDF_PROFILE_BOTTOM_PADDING;
  const domainStart = distanceDomain?.[0] ?? 0;
  const domainEnd =
    distanceDomain?.[1] ?? (track[track.length - 1]?.distanceM ?? 0) / 1000;
  const maxDistanceKm = Math.max(domainEnd - domainStart, 0);
  const { yDomain, areaBaseline, showSeaLevel } = elevationAxisForTrack(
    track,
    distanceDomain,
  );
  const plotWidth = right - plotLeft;
  const plotHeight = bottom - plotTop;
  const ySpan = yDomain[1] - yDomain[0] || 1;

  const elevationToY = (elevation: number) =>
    round(plotTop + plotHeight - ((elevation - yDomain[0]) / ySpan) * plotHeight);

  const toXY = (distanceKm: number, elevation: number) => ({
    x: round(
      plotLeft +
        (maxDistanceKm > 0
          ? ((distanceKm - domainStart) / maxDistanceKm) * plotWidth
          : 0),
    ),
    y: elevationToY(elevation),
  });

  return {
    width,
    height,
    plotLeft,
    plotTop,
    plotRight: right,
    plotBottom: bottom,
    maxDistanceKm,
    distanceDomain: [domainStart, domainEnd],
    yDomain,
    areaBaseline,
    showSeaLevel,
    toXY,
    elevationToY,
  };
}

function buildElevationTicks(yDomain: [number, number], maxTicks = 6): number[] {
  const [min, max] = yDomain;
  const span = max - min;
  if (span <= 0) return [Math.round(min)];

  const rawStep = span / Math.max(maxTicks - 1, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / magnitude;
  let step = magnitude;
  if (norm > 5) step = 10 * magnitude;
  else if (norm > 2) step = 5 * magnitude;
  else if (norm > 1) step = 2 * magnitude;

  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let value = start; value <= max + step * 0.001; value += step) {
    ticks.push(Math.round(value));
  }

  if (ticks.length === 0) {
    return [Math.round(min), Math.round(max)];
  }

  return ticks;
}

export interface PdfElevationChartOptions {
  maxProfilePoints?: number;
  variant?: "standard" | "strip";
  distanceDomain?: [number, number];
  segmentClimbs?: ClimbSegment[];
}

/** Integer km grid lines within a distance domain (absolute route km). */
function buildEveryKmGridInRange(startKm: number, endKm: number): number[] {
  if (endKm <= startKm) {
    return [roundDistanceKm(startKm)];
  }

  const ticks: number[] = [];
  const first = Math.floor(startKm + 1e-9);
  const last = Math.ceil(endKm - 1e-9);
  for (let km = first; km <= last; km += 1) {
    if (km >= startKm - 1e-6 && km <= endKm + 1e-6) {
      ticks.push(km);
    }
  }

  return ticks.length > 0 ? ticks : [roundDistanceKm(startKm), roundDistanceKm(endKm)];
}

export function buildPdfElevationChartModel(
  track: TrackPoint[],
  width: number,
  height: number,
  locale: string,
  plotLeft?: number,
  plotTop?: number,
  plotRight?: number,
  plotBottom?: number,
  options: PdfElevationChartOptions = {},
): PdfElevationChartModel {
  const isStrip = options.variant === "strip";
  const resolvedPlotTop = plotTop ?? (isStrip ? 8 : PDF_PROFILE_TOP_PADDING);
  const resolvedPlotBottom =
    plotBottom ?? (isStrip ? height - 16 : height - PDF_PROFILE_BOTTOM_PADDING);
  const resolvedPlotLeft = plotLeft ?? PDF_PROFILE_LEFT_GUTTER;
  const resolvedPlotRight = plotRight ?? width - (isStrip ? 8 : PDF_PROFILE_RIGHT_PADDING);

  const distanceDomain = options.distanceDomain;
  const layout = buildChartLayout(
    track,
    width,
    height,
    resolvedPlotLeft,
    resolvedPlotTop,
    resolvedPlotRight,
    resolvedPlotBottom,
    distanceDomain,
  );
  const segmentClimbs = options.segmentClimbs ?? detectClimbs(track);
  const profile =
    distanceDomain != null
      ? buildGradientProfileForRange(
          track,
          distanceDomain[0],
          distanceDomain[1],
          segmentClimbs,
          options.maxProfilePoints,
        )
      : buildGradientProfile(track, options.maxProfilePoints).profile;
  const baselineY = layout.elevationToY(layout.areaBaseline);

  const gradeSegments: PdfGradeSegment[] = [];
  for (let index = 1; index < profile.length; index += 1) {
    const prev = profile[index - 1];
    const point = profile[index];
    const p0 = layout.toXY(prev.distanceKm, prev.elevation);
    const p1 = layout.toXY(point.distanceKm, point.elevation);
    const segmentGrade = (prev.gradePct + point.gradePct) / 2;

    gradeSegments.push({
      key: `${prev.distanceKm}-${point.distanceKm}-${index}`,
      d: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p1.x} ${baselineY} L ${p0.x} ${baselineY} Z`,
      fill: colorForGradePct(segmentGrade),
    });
  }

  const profileLinePath =
    profile.length === 0
      ? ""
      : profile
          .map((point, index) => {
            const { x, y } = layout.toXY(point.distanceKm, point.elevation);
            return `${index === 0 ? "M" : "L"} ${x} ${y}`;
          })
          .join(" ");

  const fmtX = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: false,
  });
  const fmtY = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  const [domainStart, domainEnd] = layout.distanceDomain;
  const xGridKm = isStrip
    ? buildEveryKmGridInRange(domainStart, domainEnd)
    : buildDistanceTicksForRange(domainStart, domainEnd);
  const xLabelKm = buildDistanceTicksForRange(domainStart, domainEnd);

  const xGridLines = xGridKm.map((km) => layout.toXY(km, layout.yDomain[0]).x);
  const xTicks: PdfAxisTick[] = xLabelKm.map((km) => {
    const { x } = layout.toXY(km, layout.yDomain[0]);
    return { value: km, x, y: layout.plotBottom, label: fmtX.format(km) };
  });

  const yTickValues = buildElevationTicks(layout.yDomain, isStrip ? 6 : 6);
  const yGridLines = yTickValues.map((elevation) => layout.elevationToY(elevation));
  const yTicks: PdfAxisTick[] = yTickValues.map((elevation) => ({
    value: elevation,
    x: layout.plotLeft,
    y: layout.elevationToY(elevation),
    label: fmtY.format(elevation),
  }));

  const seaLevelY = layout.showSeaLevel && !isStrip ? layout.elevationToY(0) : null;

  return {
    layout,
    gradeSegments,
    profileLinePath,
    xGridLines,
    xTicks,
    yGridLines,
    yTicks,
    seaLevelY,
    variant: isStrip ? "strip" : "standard",
  };
}

function sampleTrack(track: TrackPoint[], maxPoints = 200): TrackPoint[] {
  if (track.length <= maxPoints) return track;
  const step = Math.ceil(track.length / maxPoints);
  return track.filter((_, index) => index % step === 0 || index === track.length - 1);
}

function densifyPoints(points: Array<{ x: number; y: number }>, maxGap = 5): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;

  const dense: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(distance / maxGap));

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      dense.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
    }
  }

  return dense;
}

export interface ChartPoiMarker {
  id: string;
  number: number;
  name: string;
  distanceKm: number;
  elevationM: number;
  description?: string;
  x: number;
  y: number;
}

export interface ChartEndpointMarker {
  kind: "start" | "finish";
  distanceKm: number;
  elevationM: number;
  x: number;
  y: number;
}

export function smoothPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(index - 1, 0)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(index + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${round(cp1x)} ${round(cp1y)}, ${round(cp2x)} ${round(cp2y)}, ${round(p2.x)} ${round(p2.y)}`;
  }

  return path;
}

export function elevationProfilePathD(
  track: TrackPoint[],
  width: number,
  height: number,
  padding: number,
  topPadding = padding,
  distanceDomain?: [number, number],
): string {
  if (track.length === 0) return "";

  const layout = buildChartLayout(
    track,
    width,
    height,
    padding,
    topPadding,
    width - padding,
    undefined,
    distanceDomain,
  );
  const points = sampleTrack(track).map((point) =>
    layout.toXY(point.distanceM / 1000, point.ele),
  );

  return smoothPathFromPoints(points);
}

export function elevationProfilePoints(
  track: TrackPoint[],
  width: number,
  height: number,
  padding: number,
  topPadding = padding,
  distanceDomain?: [number, number],
): Array<{ x: number; y: number }> {
  const layout = buildChartLayout(
    track,
    width,
    height,
    padding,
    topPadding,
    width - padding,
    undefined,
    distanceDomain,
  );
  const points = sampleTrack(track).map((point) =>
    layout.toXY(point.distanceM / 1000, point.ele),
  );
  return densifyPoints(points);
}

export function elevationPoiPoints(
  track: TrackPoint[],
  pois: Poi[],
  width: number,
  height: number,
  padding: number,
  topPadding = padding,
  distanceDomain?: [number, number],
): ChartPoiMarker[] {
  const layout = buildChartLayout(
    track,
    width,
    height,
    padding,
    topPadding,
    width - padding,
    undefined,
    distanceDomain,
  );

  return sortPoisByDistance(pois).map((poi, index) => {
    const elevation = getElevationAtDistance(track, poi.distanceFromStartM);
    const { x, y } = layout.toXY(poi.distanceFromStartM / 1000, elevation);
    const number = "number" in poi && typeof poi.number === "number" ? poi.number : index + 1;
    return {
      id: poi.id,
      number,
      name: poi.name,
      distanceKm: poi.distanceFromStartM / 1000,
      elevationM: elevation,
      description: poi.description,
      x,
      y,
    };
  });
}

export function elevationMarkerPoints(
  track: TrackPoint[],
  width: number,
  height: number,
  padding: number,
  topPadding = padding,
  distanceDomain?: [number, number],
  endpointFilter?: { showStart: boolean; showFinish: boolean },
): ChartEndpointMarker[] {
  const layout = buildChartLayout(
    track,
    width,
    height,
    padding,
    topPadding,
    width - padding,
    undefined,
    distanceDomain,
  );

  const markers = buildStartFinishMarkers(track).filter((marker) => {
    if (!endpointFilter) return true;
    if (marker.kind === "start") return endpointFilter.showStart;
    return endpointFilter.showFinish;
  });

  return markers.map((marker) => {
    const { x, y } = layout.toXY(marker.distanceKm, marker.elevation);
    return { kind: marker.kind, distanceKm: marker.distanceKm, elevationM: marker.elevation, x, y };
  });
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
