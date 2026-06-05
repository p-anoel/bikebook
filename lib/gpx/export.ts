import type { Multitour, Poi, TrackPoint } from "@/types/roadbook";
import { buildStageView } from "@/lib/gpx/stage-slice";

export interface GpxExportRoadbook {
  name: string;
  track: TrackPoint[];
  pois: Poi[];
}

const GPX_CREATOR = "BikeBook";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sanitizeGpxFilename(name: string): string {
  const base = name
    .trim()
    .replace(/[^a-z0-9-_]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${base || "roadbook"}.gpx`;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function formatElevation(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function sortedPois(pois: Poi[]): Poi[] {
  return [...pois].sort((a, b) => a.distanceFromStartM - b.distanceFromStartM);
}

function buildTrackSegment(track: TrackPoint[]): string {
  const points = track
    .map(
      (pt) =>
        `      <trkpt lat="${formatCoordinate(pt.lat)}" lon="${formatCoordinate(pt.lng)}">\n` +
        `        <ele>${formatElevation(pt.ele)}</ele>\n` +
        `      </trkpt>`,
    )
    .join("\n");

  return `    <trkseg>\n${points}\n    </trkseg>`;
}

function buildWaypoint(poi: Poi): string {
  const lines = [
    `  <wpt lat="${formatCoordinate(poi.lat)}" lon="${formatCoordinate(poi.lng)}">`,
    `    <name>${escapeXml(poi.name)}</name>`,
  ];

  if (poi.description?.trim()) {
    lines.push(`    <desc>${escapeXml(poi.description.trim())}</desc>`);
  }

  if (poi.ele !== undefined) {
    lines.push(`    <ele>${formatElevation(poi.ele)}</ele>`);
  }

  lines.push("  </wpt>");
  return lines.join("\n");
}

export function buildGpxDocument(roadbook: GpxExportRoadbook): string {
  const escapedName = escapeXml(roadbook.name.trim() || "Roadbook");
  const waypoints = sortedPois(roadbook.pois).map(buildWaypoint).join("\n");

  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${GPX_CREATOR}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    "  <metadata>",
    `    <name>${escapedName}</name>`,
    "  </metadata>",
    "  <trk>",
    `    <name>${escapedName}</name>`,
    buildTrackSegment(roadbook.track),
    "  </trk>",
  ];

  if (waypoints) {
    parts.push(waypoints);
  }

  parts.push("</gpx>");
  return `${parts.join("\n")}\n`;
}

export function buildStageGpxExport(
  multitour: Multitour,
  stageIndex: number,
  stageLabel: string,
): GpxExportRoadbook {
  const view = buildStageView(multitour, stageIndex);
  return {
    name: `${multitour.name.trim() || "Roadbook"} — ${stageLabel}`,
    track: view.track,
    pois: view.pois,
  };
}

export function buildStageGpxDocument(
  multitour: Multitour,
  stageIndex: number,
  stageLabel: string,
): string {
  return buildGpxDocument(buildStageGpxExport(multitour, stageIndex, stageLabel));
}

export function stageGpxFilename(
  tourName: string,
  stageIndex: number,
  stageLabel: string,
): string {
  const base = sanitizeGpxFilename(tourName).replace(/\.gpx$/, "");
  const safeLabel = stageLabel
    .trim()
    .replace(/[^a-z0-9-_]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${base}_stage_${stageIndex + 1}${safeLabel ? `_${safeLabel}` : ""}.gpx`;
}
