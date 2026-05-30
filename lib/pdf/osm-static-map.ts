import type { RoadbookBounds } from "@/types/roadbook";
import {
  expandBoundsToAspect,
  latLngToWorldPixel,
  type GeoBounds,
  type MapProjectionMeta,
  type StaticMapResult,
} from "@/lib/pdf/geo-bounds";

export type { GeoBounds, MapProjectionMeta, StaticMapResult };

const TILE_SIZE = 256;
const MAX_TILES = 80;
const RENDER_SCALE = 2;
const OSM_TILE_URL = "https://tile.openstreetmap.org";
const USER_AGENT = "BikeBook/1.0 (roadbook PDF export)";
const MAP_PADDING_PX = 32;

function latRad(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
  return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
}

function calculateBoundsZoom(
  bounds: GeoBounds,
  width: number,
  height: number,
  padding = MAP_PADDING_PX,
): number {
  const latFraction = (latRad(bounds.maxLat) - latRad(bounds.minLat)) / Math.PI;
  const lngDiff = bounds.maxLng - bounds.minLng;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const latZoom = Math.floor(
    Math.log((height - padding * 2) / TILE_SIZE / Math.max(latFraction, 0.0001)) / Math.LN2,
  );
  const lngZoom = Math.floor(
    Math.log((width - padding * 2) / TILE_SIZE / Math.max(lngFraction, 0.00001)) / Math.LN2,
  );

  return Math.max(3, Math.min(latZoom, lngZoom, 17));
}

function countTiles(bounds: GeoBounds, zoom: number): number {
  const nw = latLngToWorldPixel(bounds.maxLat, bounds.minLng, zoom);
  const se = latLngToWorldPixel(bounds.minLat, bounds.maxLng, zoom);
  const minTileX = Math.floor(nw.x / TILE_SIZE);
  const maxTileX = Math.floor(se.x / TILE_SIZE);
  const minTileY = Math.floor(nw.y / TILE_SIZE);
  const maxTileY = Math.floor(se.y / TILE_SIZE);
  return (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
}

function pickZoom(bounds: GeoBounds, width: number, height: number): number {
  let zoom = calculateBoundsZoom(bounds, width, height);
  while (zoom > 3 && countTiles(bounds, zoom) > MAX_TILES) {
    zoom -= 1;
  }
  return zoom;
}

async function fetchTile(z: number, x: number, y: number): Promise<Buffer> {
  const response = await fetch(`${OSM_TILE_URL}/${z}/${x}/${y}.png`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OSM tile ${z}/${x}/${y}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * @param displayWidth  Target width in PDF points
 * @param displayHeight Target height in PDF points
 */
export async function renderStaticMap(
  bounds: RoadbookBounds,
  displayWidth: number,
  displayHeight: number,
): Promise<StaticMapResult> {
  const geoBounds = expandBoundsToAspect(bounds, displayWidth, displayHeight, 0.05);
  const renderWidth = displayWidth * RENDER_SCALE;
  const renderHeight = displayHeight * RENDER_SCALE;
  const zoom = pickZoom(geoBounds, renderWidth, renderHeight);

  const nw = latLngToWorldPixel(geoBounds.maxLat, geoBounds.minLng, zoom);
  const se = latLngToWorldPixel(geoBounds.minLat, geoBounds.maxLng, zoom);

  const minTileX = Math.floor(nw.x / TILE_SIZE);
  const maxTileX = Math.floor(se.x / TILE_SIZE);
  const minTileY = Math.floor(nw.y / TILE_SIZE);
  const maxTileY = Math.floor(se.y / TILE_SIZE);

  const stitchW = (maxTileX - minTileX + 1) * TILE_SIZE;
  const stitchH = (maxTileY - minTileY + 1) * TILE_SIZE;

  const sharp = (await import("sharp")).default;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      const tile = await fetchTile(zoom, tx, ty);
      composites.push({
        input: tile,
        left: (tx - minTileX) * TILE_SIZE,
        top: (ty - minTileY) * TILE_SIZE,
      });
    }
  }

  const stitched = await sharp({
    create: {
      width: stitchW,
      height: stitchH,
      channels: 4,
      background: { r: 244, g: 244, b: 245, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const cropLeft = Math.max(0, Math.floor(nw.x - minTileX * TILE_SIZE));
  const cropTop = Math.max(0, Math.floor(nw.y - minTileY * TILE_SIZE));
  const cropWidth = Math.max(1, Math.ceil(se.x - nw.x));
  const cropHeight = Math.max(1, Math.ceil(se.y - nw.y));

  const cropped = await sharp(stitched)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: Math.min(cropWidth, stitchW - cropLeft),
      height: Math.min(cropHeight, stitchH - cropTop),
    })
    .png()
    .toBuffer();

  const displayScale = Math.max(displayWidth / cropWidth, displayHeight / cropHeight);
  const visibleCropWidth = displayWidth / displayScale;
  const visibleCropHeight = displayHeight / displayScale;
  const srcOffsetX = (cropWidth - visibleCropWidth) / 2;
  const srcOffsetY = (cropHeight - visibleCropHeight) / 2;

  const extractLeft = Math.max(0, Math.floor(srcOffsetX));
  const extractTop = Math.max(0, Math.floor(srcOffsetY));
  const extractWidth = Math.max(
    1,
    Math.min(Math.ceil(visibleCropWidth), cropWidth - extractLeft),
  );
  const extractHeight = Math.max(
    1,
    Math.min(Math.ceil(visibleCropHeight), cropHeight - extractTop),
  );

  const visibleCrop = await sharp(cropped)
    .extract({
      left: extractLeft,
      top: extractTop,
      width: extractWidth,
      height: extractHeight,
    })
    .png()
    .toBuffer();

  const buffer = await sharp(visibleCrop)
    .resize(renderWidth, renderHeight, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const projection: MapProjectionMeta = {
    zoom,
    originWorldX: minTileX * TILE_SIZE + cropLeft + srcOffsetX,
    originWorldY: minTileY * TILE_SIZE + cropTop + srcOffsetY,
    pixelWidth: visibleCropWidth,
    pixelHeight: visibleCropHeight,
    outputWidth: displayWidth,
    outputHeight: displayHeight,
    contentWidth: displayWidth,
    contentHeight: displayHeight,
    contentOffsetX: 0,
    contentOffsetY: 0,
  };

  return { buffer, bounds: geoBounds, projection };
}
