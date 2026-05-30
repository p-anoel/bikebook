"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudSun, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WeatherSegmentList } from "@/components/weather/WeatherSegmentList";
import { DEFAULT_AVG_SPEED_KMH } from "@/lib/weather/segments";
import {
  computeRidePlan,
  defaultArrivalFromDeparture,
  ridePlanErrorKey,
  type RidePlanningMode,
} from "@/lib/weather/ride-plan";
import type { RouteWeatherSnapshot } from "@/lib/weather/types";
import type { TrackPoint } from "@/types/roadbook";

interface WeatherPanelProps {
  track: TrackPoint[];
  locale: string;
  onWeatherLoaded?: (snapshot: RouteWeatherSnapshot | null) => void;
  selectedSegmentId?: number | null;
  hoveredSegmentId?: number | null;
  onSelectSegment?: (segmentId: number | null) => void;
  onHoverSegment?: (segmentId: number | null) => void;
}

function defaultDepartureIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return defaultDepartureIso();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatPlanTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

const inputClassName =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900";

export function WeatherPanel({
  track,
  locale,
  onWeatherLoaded,
  selectedSegmentId = null,
  hoveredSegmentId = null,
  onSelectSegment,
  onHoverSegment,
}: WeatherPanelProps) {
  const t = useTranslations("roadbook.weather");
  const fmt = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );

  const distanceKm = useMemo(() => {
    if (track.length < 2) return 0;
    return track[track.length - 1].distanceM / 1000;
  }, [track]);

  const [planningMode, setPlanningMode] = useState<RidePlanningMode>("speed");
  const [departureInput, setDepartureInput] = useState(defaultDepartureIso);
  const [arrivalInput, setArrivalInput] = useState(() =>
    toDatetimeLocalValue(
      defaultArrivalFromDeparture(defaultDepartureIso(), 100, DEFAULT_AVG_SPEED_KMH, 0),
    ),
  );
  const [avgSpeedInput, setAvgSpeedInput] = useState(String(DEFAULT_AVG_SPEED_KMH));
  const [pauseMinutesInput, setPauseMinutesInput] = useState("0");
  const [snapshot, setSnapshot] = useState<RouteWeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const onWeatherLoadedRef = useRef(onWeatherLoaded);
  const trackRef = useRef(track);
  const planningRef = useRef({
    planningMode,
    departureInput,
    arrivalInput,
    avgSpeedInput,
    pauseMinutesInput,
    distanceKm,
  });

  onWeatherLoadedRef.current = onWeatherLoaded;
  trackRef.current = track;
  planningRef.current = {
    planningMode,
    departureInput,
    arrivalInput,
    avgSpeedInput,
    pauseMinutesInput,
    distanceKm,
  };

  const trackKey = useMemo(
    () => `${track.length}:${track[0]?.lat ?? 0}:${track[track.length - 1]?.lat ?? 0}`,
    [track],
  );

  useEffect(() => {
    setArrivalInput(
      toDatetimeLocalValue(
        defaultArrivalFromDeparture(
          departureInput,
          distanceKm,
          Number(avgSpeedInput) || DEFAULT_AVG_SPEED_KMH,
          Number(pauseMinutesInput) || 0,
        ),
      ),
    );
    // Keep default arrival in sync when the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, distanceKm]);

  const resolvedPlan = useMemo(() => {
    try {
      const pauseMinutes = Number(pauseMinutesInput) || 0;
      const plan = computeRidePlan({
        mode: planningMode,
        distanceKm,
        departureAt: departureInput,
        avgSpeedKmh: Number(avgSpeedInput) || DEFAULT_AVG_SPEED_KMH,
        arrivalAt: arrivalInput,
        pauseMinutes,
      });
      return { plan, error: null as string | null };
    } catch (err) {
      const code = err instanceof Error ? err.message : "INVALID_PLAN";
      return { plan: null, error: ridePlanErrorKey(code) };
    }
  }, [
    planningMode,
    distanceKm,
    departureInput,
    avgSpeedInput,
    arrivalInput,
    pauseMinutesInput,
  ]);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlanError(null);

    const {
      planningMode: mode,
      departureInput: departure,
      arrivalInput: arrival,
      avgSpeedInput: speed,
      pauseMinutesInput: pause,
      distanceKm: distance,
    } = planningRef.current;

    try {
      const pauseMinutes = Number(pause) || 0;
      const plan = computeRidePlan({
        mode,
        distanceKm: distance,
        departureAt: departure,
        avgSpeedKmh: Number(speed) || DEFAULT_AVG_SPEED_KMH,
        arrivalAt: arrival,
        pauseMinutes,
      });

      const response = await fetch("/api/weather/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: trackRef.current,
          departureAt: plan.departureAt,
          avgSpeedKmh: plan.avgSpeedKmh,
          pauseMinutes: plan.pauseMinutes,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? t("fetchError"));
      }

      const data = (await response.json()) as RouteWeatherSnapshot;
      setSnapshot(data);
      onWeatherLoadedRef.current?.(data);
    } catch (err) {
      if (err instanceof Error && ridePlanErrorKey(err.message) !== "planErrors.invalidPlan") {
        setPlanError(t(ridePlanErrorKey(err.message)));
      } else {
        const message = err instanceof Error ? err.message : t("fetchError");
        setError(message);
      }
      setSnapshot(null);
      onWeatherLoadedRef.current?.(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchWeather();
  }, [trackKey, fetchWeather]);

  const summary = snapshot?.summary;
  const ridePlan = snapshot?.ridePlan ?? resolvedPlan.plan;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3 rounded-xl border border-zinc-200 p-3 sm:p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-900">{t("planTitle")}</legend>
        <p className="text-[11px] text-zinc-500">{t("planHint")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="weather-departure" className="text-xs font-medium text-zinc-600">
              {t("departureLabel")}
            </label>
            <input
              id="weather-departure"
              type="datetime-local"
              value={toDatetimeLocalValue(departureInput)}
              onChange={(event) => setDepartureInput(event.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="weather-pause" className="text-xs font-medium text-zinc-600">
              {t("pauseLabel")}
            </label>
            <input
              id="weather-pause"
              type="number"
              min={0}
              step={5}
              value={pauseMinutesInput}
              onChange={(event) => setPauseMinutesInput(event.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-checked:border-zinc-900 has-checked:bg-zinc-50">
            <input
              type="radio"
              name="weather-plan-mode"
              value="speed"
              checked={planningMode === "speed"}
              onChange={() => setPlanningMode("speed")}
              className="accent-zinc-900"
            />
            {t("planMode.speed")}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-checked:border-zinc-900 has-checked:bg-zinc-50">
            <input
              type="radio"
              name="weather-plan-mode"
              value="arrival"
              checked={planningMode === "arrival"}
              onChange={() => setPlanningMode("arrival")}
              className="accent-zinc-900"
            />
            {t("planMode.arrival")}
          </label>
        </div>

        {planningMode === "speed" ? (
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <label htmlFor="weather-speed" className="text-xs font-medium text-zinc-600">
              {t("avgSpeedLabel")}
            </label>
            <input
              id="weather-speed"
              type="number"
              min={1}
              step={0.5}
              value={avgSpeedInput}
              onChange={(event) => setAvgSpeedInput(event.target.value)}
              className={inputClassName}
            />
            {resolvedPlan.plan ? (
              <p className="text-xs text-zinc-500">
                {t("derivedArrival", {
                  time: formatPlanTime(resolvedPlan.plan.arrivalAt, locale),
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <label htmlFor="weather-arrival" className="text-xs font-medium text-zinc-600">
              {t("arrivalLabel")}
            </label>
            <input
              id="weather-arrival"
              type="datetime-local"
              value={toDatetimeLocalValue(arrivalInput)}
              onChange={(event) => setArrivalInput(event.target.value)}
              className={inputClassName}
            />
            {resolvedPlan.plan ? (
              <p className="text-xs text-zinc-500">
                {t("derivedSpeed", {
                  speed: fmt.format(resolvedPlan.plan.avgSpeedKmh),
                })}
              </p>
            ) : null}
          </div>
        )}

        {resolvedPlan.error ? (
          <p className="text-xs text-amber-700">{t(resolvedPlan.error)}</p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading || Boolean(resolvedPlan.error)}
            onClick={() => void fetchWeather()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            {t("refresh")}
          </Button>
        </div>
      </fieldset>

      {planError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {planError}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading && !snapshot ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("loading")}
        </div>
      ) : null}

      {ridePlan ? (
        <div className="flex flex-wrap gap-2">
          <Badge className="px-2.5 py-1.5">
            <span className="text-zinc-500">{t("summary.plannedSpeed")}:</span>&nbsp;
            <span className="font-semibold text-zinc-900">
              {t("windSpeed", { speed: fmt.format(ridePlan.avgSpeedKmh) })}
            </span>
          </Badge>
          <Badge className="px-2.5 py-1.5">
            <span className="text-zinc-500">{t("summary.arrival")}:</span>&nbsp;
            <span className="font-semibold text-zinc-900">
              {formatPlanTime(ridePlan.arrivalAt, locale)}
            </span>
          </Badge>
          {ridePlan.pauseMinutes > 0 ? (
            <Badge className="px-2.5 py-1.5">
              <span className="text-zinc-500">{t("summary.pause")}:</span>&nbsp;
              <span className="font-semibold text-zinc-900">
                {t("pauseSummary", { minutes: ridePlan.pauseMinutes })}
              </span>
            </Badge>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <div className="flex flex-wrap gap-2">
          <Badge className="gap-1.5 px-2.5 py-1.5">
            <CloudSun className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
            <span className="text-zinc-500">{t("summary.dominant")}:</span>
            <span className="font-semibold text-zinc-900">
              {t(`windRelative.${summary.dominantWindRelative}`)}
            </span>
          </Badge>
          <Badge className="px-2.5 py-1.5">
            <span className="text-zinc-500">{t("summary.avgWind")}:</span>&nbsp;
            <span className="font-semibold text-zinc-900">
              {t("windSpeed", { speed: fmt.format(summary.avgWindSpeedKmh) })}
            </span>
          </Badge>
          <Badge className="px-2.5 py-1.5">
            <span className="text-zinc-500">{t("summary.temp")}:</span>&nbsp;
            <span className="font-semibold text-zinc-900">
              {t("tempRange", {
                min: fmt.format(summary.minTempC),
                max: fmt.format(summary.maxTempC),
              })}
            </span>
          </Badge>
          {summary.totalPrecipitationMm > 0 ? (
            <Badge className="px-2.5 py-1.5">
              <span className="text-zinc-500">{t("summary.precip")}:</span>&nbsp;
              <span className="font-semibold text-zinc-900">
                {t("precipitation", { value: fmt.format(summary.totalPrecipitationMm) })}
              </span>
            </Badge>
          ) : null}
        </div>
      ) : null}

      {snapshot ? (
        <WeatherSegmentList
          segments={snapshot.segments}
          locale={locale}
          selectedSegmentId={selectedSegmentId}
          hoveredSegmentId={hoveredSegmentId}
          onSelect={onSelectSegment}
          onHover={onHoverSegment}
        />
      ) : null}
    </div>
  );
}
