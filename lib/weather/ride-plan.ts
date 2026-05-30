import { DEFAULT_AVG_SPEED_KMH } from "@/lib/weather/segments";

export type RidePlanningMode = "speed" | "arrival";

export interface RidePlanInput {
  mode: RidePlanningMode;
  distanceKm: number;
  departureAt: string;
  avgSpeedKmh?: number;
  arrivalAt?: string;
  pauseMinutes?: number;
}

export interface RidePlanResult {
  avgSpeedKmh: number;
  departureAt: string;
  arrivalAt: string;
  pauseMinutes: number;
  distanceKm: number;
  ridingMinutes: number;
}

export function defaultArrivalFromDeparture(
  departureAt: string,
  distanceKm: number,
  avgSpeedKmh = DEFAULT_AVG_SPEED_KMH,
  pauseMinutes = 0,
): string {
  const departureMs = new Date(departureAt).getTime();
  if (Number.isNaN(departureMs) || avgSpeedKmh <= 0 || distanceKm <= 0) {
    return departureAt;
  }
  const ridingMs = (distanceKm / avgSpeedKmh) * 3_600_000;
  return new Date(departureMs + pauseMinutes * 60_000 + ridingMs).toISOString();
}

export function computeRidePlan(input: RidePlanInput): RidePlanResult {
  const pauseMinutes = Math.max(0, input.pauseMinutes ?? 0);
  const distanceKm = input.distanceKm;
  const departureAt = new Date(input.departureAt).toISOString();

  if (Number.isNaN(new Date(departureAt).getTime())) {
    throw new Error("INVALID_DEPARTURE");
  }
  if (distanceKm <= 0) {
    throw new Error("INVALID_DISTANCE");
  }

  if (input.mode === "speed") {
    const avgSpeedKmh = input.avgSpeedKmh ?? DEFAULT_AVG_SPEED_KMH;
    if (avgSpeedKmh <= 0) throw new Error("INVALID_SPEED");

    const ridingMinutes = (distanceKm / avgSpeedKmh) * 60;
    const arrivalAt = defaultArrivalFromDeparture(
      departureAt,
      distanceKm,
      avgSpeedKmh,
      pauseMinutes,
    );

    return {
      avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
      departureAt,
      arrivalAt,
      pauseMinutes,
      distanceKm,
      ridingMinutes: Math.round(ridingMinutes),
    };
  }

  if (!input.arrivalAt) throw new Error("MISSING_ARRIVAL");

  const arrivalAt = new Date(input.arrivalAt).toISOString();
  const arrivalMs = new Date(arrivalAt).getTime();
  const departureMs = new Date(departureAt).getTime();

  if (Number.isNaN(arrivalMs)) throw new Error("INVALID_ARRIVAL");
  if (arrivalMs <= departureMs + pauseMinutes * 60_000) {
    throw new Error("ARRIVAL_BEFORE_DEPARTURE");
  }

  const ridingMs = arrivalMs - departureMs - pauseMinutes * 60_000;
  const ridingHours = ridingMs / 3_600_000;
  const avgSpeedKmh = distanceKm / ridingHours;

  if (avgSpeedKmh <= 0) throw new Error("INVALID_SPEED");

  return {
    avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
    departureAt,
    arrivalAt,
    pauseMinutes,
    distanceKm,
    ridingMinutes: Math.round(ridingHours * 60),
  };
}

export function ridePlanErrorKey(code: string): string {
  switch (code) {
    case "INVALID_DEPARTURE":
      return "planErrors.invalidDeparture";
    case "INVALID_ARRIVAL":
      return "planErrors.invalidArrival";
    case "ARRIVAL_BEFORE_DEPARTURE":
      return "planErrors.arrivalBeforeDeparture";
    case "INVALID_SPEED":
      return "planErrors.invalidSpeed";
    case "INVALID_DISTANCE":
      return "planErrors.invalidDistance";
    case "MISSING_ARRIVAL":
      return "planErrors.missingArrival";
    default:
      return "planErrors.invalidPlan";
  }
}
