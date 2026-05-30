import type { RoadbookBounds } from "@/types/roadbook";

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Coordinates for overlay — in PDF display points (not image pixels). */
export interface MapProjectionMeta {
  zoom: number;
  originWorldX: number;
  originWorldY: number;
  pixelWidth: number;
  pixelHeight: number;
  /** Full PDF frame size (includes letterbox padding). */
  outputWidth: number;
  outputHeight: number;
  /** Map content area inside the frame. */
  contentWidth: number;
  contentHeight: number;
  contentOffsetX: number;
  contentOffsetY: number;
}

export interface StaticMapResult {
  buffer: Buffer;
  bounds: GeoBounds;
  projection: MapProjectionMeta;
}

const TILE_SIZE = 256;

export function expandBounds(bounds: RoadbookBounds, margin = 0.05): GeoBounds {
  const [[swLat, swLng], [neLat, neLng]] = bounds;
  const latSpan = neLat - swLat || 0.001;
  const lngSpan = neLng - swLng || 0.001;

  return {
    minLat: swLat - latSpan * margin,
    maxLat: neLat + latSpan * margin,
    minLng: swLng - lngSpan * margin,
    maxLng: neLng + lngSpan * margin,
  };
}

export function latLngToWorldPixel(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

export function worldPixelToLatLng(
  x: number,
  y: number,
  zoom: number,
): { lat: number; lng: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

/** Expands bounds so their Mercator aspect matches the PDF map frame. */
export function expandBoundsToAspect(
  bounds: RoadbookBounds,
  targetWidth: number,
  targetHeight: number,
  margin = 0.05,
): GeoBounds {
  const expanded = expandBounds(bounds, margin);
  const targetAspect = targetWidth / targetHeight;
  const zoom = 10;

  const nw = latLngToWorldPixel(expanded.maxLat, expanded.minLng, zoom);
  const se = latLngToWorldPixel(expanded.minLat, expanded.maxLng, zoom);

  let minX = nw.x;
  let maxX = se.x;
  let minY = nw.y;
  let maxY = se.y;
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const currentAspect = w / h;

  if (currentAspect < targetAspect) {
    const pad = (h * targetAspect - w) / 2;
    minX -= pad;
    maxX += pad;
  } else if (currentAspect > targetAspect) {
    const pad = (w / targetAspect - h) / 2;
    minY -= pad;
    maxY += pad;
  }

  const sw = worldPixelToLatLng(minX, maxY, zoom);
  const ne = worldPixelToLatLng(maxX, minY, zoom);

  return {
    minLat: Math.min(sw.lat, ne.lat),
    maxLat: Math.max(sw.lat, ne.lat),
    minLng: Math.min(sw.lng, ne.lng),
    maxLng: Math.max(sw.lng, ne.lng),
  };
}

export function latLngToProjectedPixel(
  lat: number,
  lng: number,
  projection: MapProjectionMeta,
): { x: number; y: number } {
  const world = latLngToWorldPixel(lat, lng, projection.zoom);
  return {
    x: round(
      ((world.x - projection.originWorldX) / projection.pixelWidth) *
        projection.contentWidth +
        projection.contentOffsetX,
    ),
    y: round(
      ((world.y - projection.originWorldY) / projection.pixelHeight) *
        projection.contentHeight +
        projection.contentOffsetY,
    ),
  };
}

/** PDF frame size — always uses the full rectangular slot in the page layout. */
export function pdfMapDisplaySize(
  _bounds: GeoBounds,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  return { width: maxWidth, height: maxHeight };
}

export interface PdfPoint {
  x: number;
  y: number;
}

export function pointsToPathD(points: PdfPoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const segments = rest.map((p) => `L ${p.x} ${p.y}`).join(" ");
  return `M ${first.x} ${first.y} ${segments}`;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** @deprecated use pdfMapDisplaySize */
export function mapDimensionsForBounds(
  bounds: GeoBounds,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  return pdfMapDisplaySize(bounds, maxWidth, maxHeight);
}
