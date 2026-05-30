import { NextResponse } from "next/server";
import {
  buildRouteWeatherSnapshot,
  validateWeatherRouteRequest,
} from "@/lib/weather/route-weather";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = validateWeatherRouteRequest(body);

    if (!payload) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Invalid weather route request" } },
        { status: 400 },
      );
    }

    const snapshot = await buildRouteWeatherSnapshot(payload);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather fetch failed";
    return NextResponse.json(
      { error: { code: "WEATHER_FETCH_FAILED", message } },
      { status: 502 },
    );
  }
}
