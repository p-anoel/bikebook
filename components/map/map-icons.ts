import L from "leaflet";

const START_SIZE = 12;
const FINISH_SIZE = 12;

export interface PoiMapIconState {
  selected?: boolean;
  hovered?: boolean;
}

export function createPoiMapIcon(number: number, state: PoiMapIconState = {}): L.DivIcon {
  const { selected = false, hovered = false } = state;
  const label = String(number);
  const baseSize = label.length > 1 ? 16 : 14;
  const size = selected ? baseSize + 6 : hovered ? baseSize + 3 : baseSize;
  const fontSize = label.length > 1 ? 8 : 9;
  const ring = selected
    ? `<div style="position:absolute;inset:-5px;border-radius:9999px;border:2.5px solid #f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.35)"></div>`
    : hovered
      ? `<div style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid #60a5fa;box-shadow:0 0 0 2px rgba(96,165,250,.35)"></div>`
      : "";

  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px;transition:transform .12s ease">
      ${ring}
      <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${selected ? "#1d4ed8" : hovered ? "#3b82f6" : "#2563eb"};border:2px solid #fff;box-shadow:0 ${hovered || selected ? "2px 6px" : "1px 3px"} rgba(0,0,0,${hovered || selected ? ".32" : ".28"});display:flex;align-items:center;justify-content:center;color:#fff;font-size:${fontSize}px;font-weight:700;line-height:1;font-family:system-ui,sans-serif">${label}</div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** @deprecated Use createPoiMapIcon(number) */
export const poiMapIcon = createPoiMapIcon(1);

export const startMapIcon = L.divIcon({
  className: "",
  html: `<div style="width:${START_SIZE}px;height:${START_SIZE}px;border-radius:9999px;background:#22c55e;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.28)"></div>`,
  iconSize: [START_SIZE, START_SIZE],
  iconAnchor: [START_SIZE / 2, START_SIZE / 2],
});

export interface WaterPointMapIconState {
  hovered?: boolean;
  added?: boolean;
}

export function createWaterPointMapIcon(state: WaterPointMapIconState = {}): L.DivIcon {
  const { hovered = false, added = false } = state;
  const size = hovered ? 20 : 18;
  const fill = added ? "#94a3b8" : hovered ? "#0284c7" : "#0ea5e9";

  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.28))">
        <path d="M12 2.5c-3.2 0-5.8 2.4-5.8 5.4 0 4.1 5.8 11.1 5.8 11.1s5.8-7 5.8-11.1c0-3-2.6-5.4-5.8-5.4z" fill="${fill}" stroke="#fff" stroke-width="1.5"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

export interface CityLimitMapIconState {
  hovered?: boolean;
  added?: boolean;
}

export function createCityLimitMapIcon(state: CityLimitMapIconState = {}): L.DivIcon {
  const { hovered = false, added = false } = state;
  const size = hovered ? 22 : 20;
  const border = added ? "#94a3b8" : hovered ? "#b91c1c" : "#dc2626";
  const fill = added ? "#f4f4f5" : "#ffffff";

  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      <div style="width:${size}px;height:${Math.round(size * 0.72)}px;background:${fill};border:2px solid ${border};border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center">
        <div style="width:${Math.round(size * 0.55)}px;height:2px;background:${border};border-radius:1px"></div>
      </div>
    </div>`,
    iconSize: [size, Math.round(size * 0.72)],
    iconAnchor: [size / 2, Math.round(size * 0.72) / 2],
  });
}

export const finishMapIcon = L.divIcon({
  className: "",
  html: `<div style="width:${FINISH_SIZE}px;height:${FINISH_SIZE}px;border:1.5px solid #18181b;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.28);position:relative;overflow:hidden">
    <div style="position:absolute;left:0;top:0;width:50%;height:50%;background:#18181b"></div>
    <div style="position:absolute;right:0;bottom:0;width:50%;height:50%;background:#18181b"></div>
  </div>`,
  iconSize: [FINISH_SIZE, FINISH_SIZE],
  iconAnchor: [FINISH_SIZE / 2, FINISH_SIZE / 2],
});
