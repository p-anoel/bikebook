"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MouseHandlerDataParam } from "recharts";
import { useTranslations } from "next-intl";
import { ProfileGradeFill } from "@/components/elevation/ProfileGradeFill";
import { ClimbList } from "@/components/elevation/ClimbList";
import { ClimbProfileHighlights } from "@/components/elevation/ClimbProfileHighlights";
import {
  applyWheelZoom,
  applyHorizontalPan,
  buildGradientProfile,
  buildGradientProfileForRange,
  clampZoomDomain,
  climbZoomDomain,
  poiZoomDomain,
  getElevationAxisConfig,
  getProfileAtDistance,
  isFullZoomDomain,
  MIN_ZOOM_SPAN_KM,
  type ClimbSegment,
} from "@/lib/gpx/gradient";
import {
  buildElevationPoiPoints,
  buildStartFinishMarkers,
  getElevationChartDomain,
} from "@/lib/pdf/elevation-chart";
import type { Poi, TrackPoint } from "@/types/roadbook";
import { withPoiStats } from "@/lib/gpx/poi-intervals";

interface ElevationProfileProps {
  track: TrackPoint[];
  pois: Poi[];
  locale: string;
  selectedPoiId?: string | null;
  onPoiSelect?: (poiId: string | null) => void;
  hoveredPoiId?: string | null;
  onPoiHover?: (poiId: string | null) => void;
}

interface TooltipState {
  distanceKm: number;
  elevation: number;
  gradePct: number;
  climb: ClimbSegment | null;
  name?: string;
  poiNumber?: number;
  kind?: "start" | "finish";
  cumulativeGainM?: number;
  intervalGainM?: number | null;
  coordinate?: { x: number; y: number };
}

interface DragSelection {
  anchorKm: number;
  focusKm: number;
}

const CHART_MARGIN = { top: 8, right: 12, left: 0, bottom: 18 };
const Y_AXIS_WIDTH = 34;
const PLOT_LEFT_GUTTER = Y_AXIS_WIDTH;
const MIN_SELECTION_KM = 0.3;
const WHEEL_ZOOM_SENSITIVITY = 0.006;
const WHEEL_PAN_SENSITIVITY = 1;
const ZOOM_DETAIL_DEBOUNCE_MS = 120;
const ZOOM_FAST_MAX_POINTS = 350;
const TOOLTIP_CURSOR_GAP_PX = 35;

function kmFromPlotX(
  plotX: number,
  containerWidth: number,
  domain: [number, number],
): number {
  const plotWidth = containerWidth - PLOT_LEFT_GUTTER - CHART_MARGIN.right;
  if (plotWidth <= 0 || domain[1] === domain[0]) return domain[0];
  const ratio = Math.max(0, Math.min(1, (plotX - PLOT_LEFT_GUTTER) / plotWidth));
  return domain[0] + ratio * (domain[1] - domain[0]);
}

function plotXFromKm(
  km: number,
  containerWidth: number,
  domain: [number, number],
): number {
  const plotWidth = containerWidth - PLOT_LEFT_GUTTER - CHART_MARGIN.right;
  if (domain[1] === domain[0]) return PLOT_LEFT_GUTTER;
  const ratio = (km - domain[0]) / (domain[1] - domain[0]);
  return PLOT_LEFT_GUTTER + ratio * plotWidth;
}

function TooltipMetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 text-[11px] leading-snug">
      <span className="shrink-0 text-zinc-400">{label}</span>
      <span className="font-medium tabular-nums text-zinc-100">{value}</span>
    </div>
  );
}

function TooltipCard({
  title,
  distanceKm,
  elevation,
  gradePct,
  climb,
  locale,
  labels,
  cumulativeGainM,
  intervalGainM,
}: {
  title?: string;
  distanceKm: number;
  elevation: number;
  gradePct: number;
  climb: ClimbSegment | null;
  locale: string;
  labels: {
    distance: string;
    elevation: string;
    grade: string;
    cumulativeGain: string;
    intervalGain: string;
    climbTitle: string;
    climbGain: string;
    climbLength: string;
    climbGrade: string;
  };
  cumulativeGainM?: number;
  intervalGainM?: number | null;
}) {
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const fmtEle = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const climbLengthKm = climb ? Math.round((climb.lengthM / 1000) * 10) / 10 : 0;

  return (
    <div className="min-w-[168px] rounded-md bg-zinc-900 px-3 py-2.5 text-xs text-white shadow-lg">
      {title ? <p className="mb-2 border-b border-zinc-700 pb-1.5 font-semibold">{title}</p> : null}
      <div className="space-y-1">
        <TooltipMetricRow
          label={labels.distance}
          value={`${fmt.format(distanceKm)} km`}
        />
        <TooltipMetricRow
          label={labels.elevation}
          value={`${fmtEle.format(elevation)} m`}
        />
        <TooltipMetricRow
          label={labels.grade}
          value={`${fmt.format(gradePct)} %`}
        />
      </div>
      {cumulativeGainM !== undefined ? (
        <div className="mt-2 space-y-1 border-t border-zinc-700 pt-2">
          <TooltipMetricRow
            label={labels.cumulativeGain}
            value={`${fmtEle.format(cumulativeGainM)} m`}
          />
          {intervalGainM != null ? (
            <TooltipMetricRow
              label={labels.intervalGain}
              value={`+${fmtEle.format(intervalGainM)} m`}
            />
          ) : null}
        </div>
      ) : null}
      {climb ? (
        <div className="mt-2 border-t border-zinc-700 pt-2">
          <p className="mb-1.5 text-[11px] font-medium text-amber-300">
            {labels.climbTitle}
          </p>
          <div className="space-y-1">
            <TooltipMetricRow
              label={labels.climbGain}
              value={`+${fmtEle.format(climb.gainM)} m`}
            />
            <TooltipMetricRow
              label={labels.climbLength}
              value={`${fmt.format(climbLengthKm)} km`}
            />
            <TooltipMetricRow
              label={labels.climbGrade}
              value={`${fmt.format(climb.avgGradePct)} %`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PoiProfileMarker({
  cx = 0,
  cy = 0,
  number,
  selected = false,
  hovered = false,
}: {
  cx?: number;
  cy?: number;
  number: number;
  selected?: boolean;
  hovered?: boolean;
}) {
  const label = String(number);
  const active = selected || hovered;
  const radius = selected
    ? label.length > 1
      ? 9
      : 8
    : hovered
      ? label.length > 1
        ? 8
        : 7
      : label.length > 1
        ? 7
        : 6;

  return (
    <g pointerEvents="none">
      {selected ? (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 5}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2.5}
          opacity={0.95}
        />
      ) : hovered ? (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 4}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={2}
          opacity={0.95}
        />
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={selected ? "#1d4ed8" : hovered ? "#3b82f6" : "#2563eb"}
        stroke="#ffffff"
        strokeWidth={active ? 2.5 : 2}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={label.length > 1 ? 7 : 8}
        fontWeight={700}
      >
        {label}
      </text>
    </g>
  );
}

function StartMarker(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  return (
    <circle cx={cx} cy={cy} r={6} fill="#22c55e" stroke="#ffffff" strokeWidth={2} />
  );
}

function FinishMarker(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  const size = 12;
  const x = cx - size / 2;
  const y = cy - size / 2;
  const cell = size / 2;

  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={size} height={size} fill="#ffffff" stroke="#18181b" strokeWidth={1.5} />
      <rect x={x} y={y} width={cell} height={cell} fill="#18181b" />
      <rect x={x + cell} y={y + cell} width={cell} height={cell} fill="#18181b" />
    </g>
  );
}

export function ElevationProfile({
  track,
  pois,
  locale,
  selectedPoiId = null,
  onPoiSelect,
  hoveredPoiId = null,
  onPoiHover,
}: ElevationProfileProps) {
  const t = useTranslations("roadbook");
  const tA11y = useTranslations("a11y");
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [selectedClimbId, setSelectedClimbId] = useState<number | null>(null);
  const [hoveredClimbId, setHoveredClimbId] = useState<number | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [, startTransition] = useTransition();
  const isDraggingRef = useRef(false);
  const dragSelectionRef = useRef<DragSelection | null>(null);
  const wheelFrameRef = useRef<number | null>(null);
  const wheelDeltaXRef = useRef(0);
  const wheelDeltaYRef = useRef(0);
  const wheelClientXRef = useRef(0);
  const zoomDomainRef = useRef<[number, number] | null>(null);
  const zoomIdleTimerRef = useRef<number | null>(null);
  const fullXDomainRef = useRef<[number, number]>([0, 1]);

  const { climbs } = useMemo(() => buildGradientProfile(track), [track]);

  const fullXDomain = useMemo(() => getElevationChartDomain(track), [track]);
  fullXDomainRef.current = fullXDomain;
  zoomDomainRef.current = zoomDomain;

  const visibleXDomain = zoomDomain ?? fullXDomain;

  const xTickCount = useMemo(() => {
    const span = visibleXDomain[1] - visibleXDomain[0];
    if (span <= 0.5) return 5;
    if (span <= 2) return 6;
    if (span <= 8) return 8;
    if (span <= 25) return 10;
    return 12;
  }, [visibleXDomain]);

  const chartData = useMemo(
    () =>
      buildGradientProfileForRange(
        track,
        visibleXDomain[0],
        visibleXDomain[1],
        climbs,
        isZooming ? ZOOM_FAST_MAX_POINTS : undefined,
      ),
    [track, visibleXDomain, climbs, isZooming],
  );

  const yAxis = useMemo(() => getElevationAxisConfig(track), [track]);

  const { yDomain, areaBaseline, showSeaLevel } = yAxis;

  const poiDots = useMemo(
    () => buildElevationPoiPoints(track, pois),
    [track, pois],
  );

  const poiStatsById = useMemo(() => {
    const stats = withPoiStats(track, pois);
    return new Map(stats.map((poi) => [poi.id, poi]));
  }, [track, pois]);

  const markers = useMemo(() => buildStartFinishMarkers(track), [track]);
  const isZoomed = zoomDomain !== null;

  const visiblePoiDots = useMemo(
    () =>
      poiDots.filter(
        (poi) =>
          poi.distanceKm >= visibleXDomain[0] && poi.distanceKm <= visibleXDomain[1],
      ),
    [poiDots, visibleXDomain],
  );

  const startPoint = markers.find((m) => m.kind === "start");
  const finishPoint = markers.find((m) => m.kind === "finish");

  const showStart =
    startPoint &&
    startPoint.distanceKm >= visibleXDomain[0] &&
    startPoint.distanceKm <= visibleXDomain[1];
  const showFinish =
    finishPoint &&
    finishPoint.distanceKm >= visibleXDomain[0] &&
    finishPoint.distanceKm <= visibleXDomain[1];

  const poiHitRadiusKm = useMemo(() => {
    const span = visibleXDomain[1] - visibleXDomain[0];
    return Math.max(span * 0.015, 0.05);
  }, [visibleXDomain]);

  const resetZoom = useCallback(() => {
    setZoomDomain(null);
    setDragSelection(null);
    setSelectedClimbId(null);
    isDraggingRef.current = false;
  }, []);

  const markZoomActivity = useCallback(() => {
    setIsZooming(true);
    if (zoomIdleTimerRef.current != null) {
      window.clearTimeout(zoomIdleTimerRef.current);
    }
    zoomIdleTimerRef.current = window.setTimeout(() => {
      startTransition(() => {
        setIsZooming(false);
      });
    }, ZOOM_DETAIL_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (wheelFrameRef.current != null) {
        cancelAnimationFrame(wheelFrameRef.current);
      }
      if (zoomIdleTimerRef.current != null) {
        window.clearTimeout(zoomIdleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    dragSelectionRef.current = dragSelection;
  }, [dragSelection]);

  useEffect(() => {
    resetZoom();
  }, [track, resetZoom]);

  const applyZoomDomain = useCallback(
    (next: [number, number]) => {
      const clamped = clampZoomDomain(next, fullXDomain);
      if (isFullZoomDomain(clamped, fullXDomain)) {
        setZoomDomain(null);
      } else {
        setZoomDomain(clamped);
      }
    },
    [fullXDomain],
  );

  const handleClimbHover = useCallback(
    (climbId: number | null) => {
      setHoveredClimbId((current) => (current === climbId ? current : climbId));
      if (climbId != null) onPoiHover?.(null);
    },
    [onPoiHover],
  );

  useEffect(() => {
    if (hoveredPoiId) setHoveredClimbId(null);
  }, [hoveredPoiId]);

  const handleClimbSelect = useCallback(
    (climb: ClimbSegment) => {
      setSelectedClimbId(climb.id);
      setHoveredClimbId(null);
      onPoiSelect?.(null);
      markZoomActivity();
      applyZoomDomain(climbZoomDomain(climb, fullXDomain));
    },
    [applyZoomDomain, fullXDomain, markZoomActivity, onPoiSelect],
  );

  const prevSelectedPoiIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedPoiId === prevSelectedPoiIdRef.current) return;
    prevSelectedPoiIdRef.current = selectedPoiId;
    if (!selectedPoiId) return;

    const poi = poiDots.find((item) => item.id === selectedPoiId);
    if (!poi) return;

    setSelectedClimbId(null);
    markZoomActivity();
    applyZoomDomain(poiZoomDomain(poi.distanceKm, fullXDomain));
  }, [selectedPoiId, poiDots, fullXDomain, applyZoomDomain, markZoomActivity]);

  const distanceKmFromEvent = useCallback(
    (clientX: number, domain: [number, number]) => {
      const container = containerRef.current;
      if (!container) return domain[0];
      const rect = container.getBoundingClientRect();
      const plotX = clientX - rect.left;
      return kmFromPlotX(plotX, rect.width, domain);
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const flushWheel = () => {
      wheelFrameRef.current = null;
      const deltaX = wheelDeltaXRef.current;
      const deltaY = wheelDeltaYRef.current;
      wheelDeltaXRef.current = 0;
      wheelDeltaYRef.current = 0;
      if (deltaX === 0 && deltaY === 0) return;

      const rect = container.getBoundingClientRect();
      const plotX = wheelClientXRef.current - rect.left;
      const plotWidth = rect.width - PLOT_LEFT_GUTTER - CHART_MARGIN.right;

      setZoomDomain((current) => {
        let domain: [number, number] | null = current;
        const full = fullXDomainRef.current;

        if (domain && deltaX !== 0 && plotWidth > 0) {
          const span = domain[1] - domain[0];
          const panKm = ((deltaX * WHEEL_PAN_SENSITIVITY) / plotWidth) * span;
          domain = applyHorizontalPan(domain, full, panKm);
        }

        if (deltaY !== 0) {
          const visible = domain ?? full;
          const centerKm = kmFromPlotX(plotX, rect.width, visible);
          domain = applyWheelZoom(
            visible,
            full,
            centerKm,
            deltaY,
            WHEEL_ZOOM_SENSITIVITY,
          );
        }

        return domain;
      });
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const isZoomed = zoomDomainRef.current !== null;

      if (isZoomed) {
        wheelDeltaXRef.current += event.deltaX;
      }
      wheelDeltaYRef.current += event.deltaY;
      wheelClientXRef.current = event.clientX;
      markZoomActivity();

      if (wheelFrameRef.current == null) {
        wheelFrameRef.current = requestAnimationFrame(flushWheel);
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (wheelFrameRef.current != null) {
        cancelAnimationFrame(wheelFrameRef.current);
      }
    };
  }, [markZoomActivity]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.shiftKey) return;
      event.preventDefault();
      isDraggingRef.current = true;
      setTooltip(null);
      const anchorKm = distanceKmFromEvent(event.clientX, visibleXDomain);
      setDragSelection({ anchorKm, focusKm: anchorKm });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [distanceKmFromEvent, visibleXDomain],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const focusKm = distanceKmFromEvent(event.clientX, visibleXDomain);
      setDragSelection((current) =>
        current ? { ...current, focusKm } : { anchorKm: focusKm, focusKm },
      );
    },
    [distanceKmFromEvent, visibleXDomain],
  );

  const finishDragSelection = useCallback(
    (selection: DragSelection | null) => {
      if (!selection) return;
      const startKm = Math.min(selection.anchorKm, selection.focusKm);
      const endKm = Math.max(selection.anchorKm, selection.focusKm);
      if (endKm - startKm >= MIN_SELECTION_KM) {
        markZoomActivity();
        applyZoomDomain([startKm, endKm]);
      }
    },
    [applyZoomDomain, markZoomActivity],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      finishDragSelection(dragSelectionRef.current);
      setDragSelection(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [finishDragSelection],
  );

  const handleDoubleClick = useCallback(() => {
    resetZoom();
  }, [resetZoom]);

  const handleMouseMove = useCallback(
    (state: MouseHandlerDataParam, event: React.MouseEvent) => {
      if (isDraggingRef.current) return;

      if (state.activeLabel == null) {
        setTooltip(null);
        onPoiHover?.(null);
        handleClimbHover(null);
        return;
      }

      const distanceKm = Number(state.activeLabel);
      if (Number.isNaN(distanceKm)) {
        setTooltip(null);
        onPoiHover?.(null);
        handleClimbHover(null);
        return;
      }

      const coordinate =
        state.activeCoordinate?.x != null && state.activeCoordinate?.y != null
          ? {
              x: state.activeCoordinate.x + PLOT_LEFT_GUTTER,
              y: state.activeCoordinate.y + CHART_MARGIN.top,
            }
          : containerRef.current
            ? {
                x: event.clientX - containerRef.current.getBoundingClientRect().left,
                y: event.clientY - containerRef.current.getBoundingClientRect().top,
              }
            : undefined;

      const nearestPoi = visiblePoiDots.find(
        (poi) => Math.abs(poi.distanceKm - distanceKm) <= poiHitRadiusKm,
      );
      onPoiHover?.(nearestPoi?.id ?? null);

      if (nearestPoi) {
        handleClimbHover(null);
        const sample = getProfileAtDistance(track, nearestPoi.distanceKm, climbs);
        const stats = poiStatsById.get(nearestPoi.id);
        setTooltip({
          distanceKm: nearestPoi.distanceKm,
          elevation: nearestPoi.elevation,
          gradePct: sample?.gradePct ?? 0,
          climb: sample?.climb ?? null,
          name: nearestPoi.name,
          poiNumber: nearestPoi.number,
          cumulativeGainM: stats?.cumulativeElevationGainM,
          intervalGainM: stats?.intervalElevationGainM ?? null,
          coordinate,
        });
        return;
      }

      if (showStart && startPoint && Math.abs(startPoint.distanceKm - distanceKm) <= poiHitRadiusKm) {
        handleClimbHover(null);
        setTooltip({
          distanceKm: startPoint.distanceKm,
          elevation: startPoint.elevation,
          gradePct: 0,
          climb: null,
          kind: "start",
          coordinate,
        });
        return;
      }

      if (
        showFinish &&
        finishPoint &&
        Math.abs(finishPoint.distanceKm - distanceKm) <= poiHitRadiusKm
      ) {
        handleClimbHover(null);
        setTooltip({
          distanceKm: finishPoint.distanceKm,
          elevation: finishPoint.elevation,
          gradePct: 0,
          climb: null,
          kind: "finish",
          coordinate,
        });
        return;
      }

      const sample = getProfileAtDistance(track, distanceKm, climbs);
      if (!sample) {
        setTooltip(null);
        handleClimbHover(null);
        return;
      }

      handleClimbHover(sample.climb?.id ?? null);

      setTooltip({
        distanceKm: sample.distanceKm,
        elevation: sample.elevation,
        gradePct: sample.gradePct,
        climb: sample.climb,
        coordinate,
      });
    },
    [
      track,
      climbs,
      visiblePoiDots,
      poiHitRadiusKm,
      poiStatsById,
      showStart,
      showFinish,
      startPoint,
      finishPoint,
      onPoiHover,
      handleClimbHover,
    ],
  );

  const handleChartClick = useCallback(
    (state: MouseHandlerDataParam) => {
      if (!onPoiSelect || state.activeLabel == null) return;

      const distanceKm = Number(state.activeLabel);
      if (Number.isNaN(distanceKm)) return;

      const nearestPoi = visiblePoiDots.find(
        (poi) => Math.abs(poi.distanceKm - distanceKm) <= poiHitRadiusKm,
      );
      if (nearestPoi) {
        onPoiSelect(selectedPoiId === nearestPoi.id ? null : nearestPoi.id);
      }
    },
    [onPoiSelect, visiblePoiDots, poiHitRadiusKm, selectedPoiId],
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDraggingRef.current) {
      setTooltip(null);
      onPoiHover?.(null);
      handleClimbHover(null);
    }
  }, [onPoiHover, handleClimbHover]);

  const tooltipTitle = tooltip
    ? tooltip.kind === "start"
      ? t("markers.start")
      : tooltip.kind === "finish"
        ? t("markers.finish")
        : tooltip.poiNumber != null && tooltip.name
          ? t("profile.poiTooltipTitle", { number: tooltip.poiNumber, name: tooltip.name })
          : tooltip.name
    : undefined;

  const tooltipLabels = useMemo(
    () => ({
      distance: t("profile.tooltipDistance"),
      elevation: t("profile.tooltipElevation"),
      grade: t("profile.tooltipGrade"),
      cumulativeGain: t("poiColumns.cumulativeGain"),
      intervalGain: t("poiColumns.intervalGain"),
      climbTitle:
        tooltip?.climb != null
          ? t("profile.climbTitle", {
              index: tooltip.climb.id,
              total: climbs.length,
            })
          : "",
      climbGain: t("profile.climbGain"),
      climbLength: t("profile.climbLength"),
      climbGrade: t("profile.climbGrade"),
    }),
    [t, tooltip?.climb, climbs.length],
  );

  const selectionStyle = useMemo(() => {
    if (!dragSelection || !containerRef.current) return null;
    const width = containerRef.current.getBoundingClientRect().width;
    const leftKm = Math.min(dragSelection.anchorKm, dragSelection.focusKm);
    const rightKm = Math.max(dragSelection.anchorKm, dragSelection.focusKm);
    const left = plotXFromKm(leftKm, width, visibleXDomain);
    const right = plotXFromKm(rightKm, width, visibleXDomain);
    return {
      left,
      width: Math.max(1, right - left),
    };
  }, [dragSelection, visibleXDomain]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          {t("profile.zoomHint", { minKm: MIN_ZOOM_SPAN_KM })}
        </p>
        {isZoomed ? (
          <button
            type="button"
            onClick={resetZoom}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            {t("profile.resetZoom")}
          </button>
        ) : null}
      </div>
      <div
        ref={containerRef}
        className={`relative z-0 h-[clamp(200px,45vw,280px)] w-full min-w-0 ${dragSelection ? "cursor-col-resize" : ""}`}
        role="img"
        aria-label={tA11y("elevationChart")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {tooltip && !dragSelection ? (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: tooltip.coordinate?.x ?? 0,
              top: tooltip.coordinate?.y ?? 0,
              transform: `translate(-50%, calc(-100% - ${TOOLTIP_CURSOR_GAP_PX}px))`,
            }}
          >
            <TooltipCard
              title={tooltipTitle}
              distanceKm={tooltip.distanceKm}
              elevation={tooltip.elevation}
              gradePct={tooltip.gradePct}
              climb={tooltip.climb}
              locale={locale}
              labels={tooltipLabels}
              cumulativeGainM={tooltip.cumulativeGainM}
              intervalGainM={tooltip.intervalGainM}
            />
          </div>
        ) : null}
        {selectionStyle ? (
          <div
            className="pointer-events-none absolute z-20 border border-blue-500 bg-blue-400/20"
            style={{
              top: CHART_MARGIN.top,
              bottom: CHART_MARGIN.bottom,
              left: selectionStyle.left,
              width: selectionStyle.width,
            }}
          />
        ) : null}
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={chartData}
            margin={CHART_MARGIN}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleChartClick}
          >
            <CartesianGrid stroke="#e4e4e7" strokeWidth={0.5} vertical horizontal />
            <XAxis
              type="number"
              dataKey="distanceKm"
              domain={visibleXDomain}
              scale="linear"
              tickCount={xTickCount}
              allowDecimals
              padding={{ left: 0, right: 8 }}
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickFormatter={(value: number) =>
                `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}`
              }
              label={{
                value: "km",
                position: "insideBottomRight",
                offset: -2,
                style: { fontSize: 10, fill: "#a1a1aa" },
              }}
            />
            <YAxis
              domain={yDomain}
              allowDataOverflow
              tick={{ fontSize: 10, fill: "#71717a" }}
              width={Y_AXIS_WIDTH}
              tickFormatter={(value: number) => `${value}`}
              label={{
                value: "m",
                angle: -90,
                position: "insideLeft",
                offset: 8,
                style: { fontSize: 10, fill: "#a1a1aa" },
              }}
            />
            <Tooltip cursor={{ stroke: "#71717a", strokeWidth: 1 }} content={() => null} />
            {showSeaLevel ? (
              <ReferenceLine
                y={0}
                stroke="#0ea5e9"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                label={{
                  value: t("profile.seaLevel"),
                  position: "insideTopLeft",
                  fill: "#0284c7",
                  fontSize: 10,
                }}
              />
            ) : null}
            <ClimbProfileHighlights
              climbs={climbs}
              visibleXDomain={visibleXDomain}
              yDomain={yDomain}
              hoveredClimbId={hoveredClimbId}
              selectedClimbId={selectedClimbId}
            />
            <ProfileGradeFill data={chartData} baseline={areaBaseline} />
            <Area
              type="linear"
              dataKey="elevation"
              stroke="#1e40af"
              strokeWidth={1.2}
              fill="none"
              isAnimationActive={false}
              activeDot={{ r: 3, fill: "#1e40af", stroke: "#fff", strokeWidth: 1.5 }}
              dot={false}
            />
            {visiblePoiDots.map((poi) => (
              <ReferenceDot
                key={poi.id}
                x={poi.distanceKm}
                y={poi.elevation}
                shape={(props) => (
                  <PoiProfileMarker
                    {...props}
                    number={poi.number}
                    selected={poi.id === selectedPoiId}
                    hovered={poi.id === hoveredPoiId && poi.id !== selectedPoiId}
                  />
                )}
                ifOverflow="visible"
              />
            ))}
            {showStart && startPoint ? (
              <ReferenceDot
                x={startPoint.distanceKm}
                y={startPoint.elevation}
                shape={StartMarker}
                ifOverflow="visible"
              />
            ) : null}
            {showFinish && finishPoint ? (
              <ReferenceDot
                x={finishPoint.distanceKm}
                y={finishPoint.elevation}
                shape={FinishMarker}
                ifOverflow="visible"
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ClimbList
        climbs={climbs}
        locale={locale}
        selectedClimbId={selectedClimbId}
        hoveredClimbId={hoveredClimbId}
        onSelect={handleClimbSelect}
        onHover={handleClimbHover}
      />
    </div>
  );
}
