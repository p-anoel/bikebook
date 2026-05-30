import { NextResponse } from "next/server";
import { renderStaticMap } from "@/lib/pdf/osm-static-map";
import type { RoadbookBounds } from "@/types/roadbook";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const swLat = Number.parseFloat(searchParams.get("swLat") ?? "");
    const swLng = Number.parseFloat(searchParams.get("swLng") ?? "");
    const neLat = Number.parseFloat(searchParams.get("neLat") ?? "");
    const neLng = Number.parseFloat(searchParams.get("neLng") ?? "");
    const width = Number.parseInt(searchParams.get("w") ?? "475", 10);
    const height = Number.parseInt(searchParams.get("h") ?? "200", 10);
    const wantsJson = searchParams.get("format") === "json";

    if (
      [swLat, swLng, neLat, neLng].some((value) => Number.isNaN(value)) ||
      width <= 0 ||
      height <= 0
    ) {
      return NextResponse.json({ error: "Invalid map parameters." }, { status: 400 });
    }

    const bounds: RoadbookBounds = [
      [swLat, swLng],
      [neLat, neLng],
    ];

    const { buffer, projection } = await renderStaticMap(bounds, width, height);

    if (wantsJson) {
      return NextResponse.json({
        image: `data:image/png;base64,${buffer.toString("base64")}`,
        projection,
      });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Static map generation failed:", error);
    return NextResponse.json(
      { error: "Unable to generate static map." },
      { status: 500 },
    );
  }
}
