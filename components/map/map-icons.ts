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

const WIND_COLORS = {
  headwind: "#ef4444",
  tailwind: "#22c55e",
  crosswind: "#f59e0b",
} as const;

export interface WindMapIconState {
  selected?: boolean;
  hovered?: boolean;
}

export function createWindMapIcon(
  windRelative: keyof typeof WIND_COLORS,
  windDirectionDeg: number,
  state: WindMapIconState = {},
): L.DivIcon {
  const { selected = false, hovered = false } = state;
  const size = selected ? 22 : hovered ? 20 : 18;
  const color = WIND_COLORS[windRelative];
  const rotation = (windDirectionDeg + 180) % 360;
  const ring = selected
    ? `<div style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid #f59e0b"></div>`
    : hovered
      ? `<div style="position:absolute;inset:-3px;border-radius:9999px;border:2px solid #60a5fa"></div>`
      : "";

  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      ${ring}
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform:rotate(${rotation}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))">
        <path d="M12 3 L12 18 M12 18 L7 13 M12 18 L17 13" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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
