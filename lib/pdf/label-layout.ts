import { truncateText } from "@/lib/pdf/chart-labels";

export interface LabelContent {
  title: string;
  subtitle: string;
  description?: string;
}

export interface LabelAnchor {
  id: string;
  anchorX: number;
  anchorY: number;
  content: LabelContent;
  markerKind?: "poi" | "start" | "finish";
  markerNumber?: number;
  sortKey?: number;
}

export interface LabelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type LabelSide = "above" | "below";

export interface PlacedLabel extends LabelAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
  side: LabelSide;
  leaderX: number;
  leaderY: number;
}

export interface LayoutOptions {
  labelsAboveOnly?: boolean;
  avoidPoints?: Array<{ x: number; y: number }>;
  avoidBuffer?: number;
  compact?: boolean;
}

export const LABEL_PAD_X = 8;
export const LABEL_PAD_Y = 5;
export const LABEL_TITLE_SIZE = 7;
export const LABEL_SUBTITLE_SIZE = 6.5;
export const LABEL_DESC_SIZE = 6;
export const LABEL_TITLE_LINE = 8;
export const LABEL_SUBTITLE_LINE = 7.5;
export const LABEL_DESC_LINE = 7;
export const LABEL_LINE_GAP = 1.5;
export const LABEL_RADIUS = 4;
export const LABEL_GAP = 14;
export const LABEL_MIN_WIDTH = 50;
export const LABEL_MAX_WIDTH = 108;
export const LABEL_MAX_WIDTH_COMPACT = 78;
export const MARKER_RADIUS = 4;
const TRACK_BUFFER = 8;
const LEADER_CLEARANCE = 3;
const LABEL_OVERLAP_GAP = 12;
const MIN_XOVERLAP_VERTICAL_GAP = 14;
const CLOSE_ANCHOR_DISTANCE = 64;
const ANCHOR_INSET = 6;

function charWidth(text: string, size: number): number {
  return text.length * (size * 0.52);
}

export function compactLabelContent(content: LabelContent, maxTitle = 12): LabelContent {
  return {
    title: truncateText(content.title, maxTitle),
    subtitle: content.subtitle,
  };
}

export function measureLabelBox(content: LabelContent, compact = false): { width: number; height: number } {
  const titleW = charWidth(content.title, LABEL_TITLE_SIZE);
  const subtitleW = charWidth(content.subtitle, LABEL_SUBTITLE_SIZE);
  const maxWidth = compact ? LABEL_MAX_WIDTH_COMPACT : LABEL_MAX_WIDTH;

  const width = Math.min(
    maxWidth,
    Math.max(LABEL_MIN_WIDTH, Math.max(titleW, subtitleW) + LABEL_PAD_X * 2),
  );

  return {
    width,
    height: LABEL_PAD_Y * 2 + LABEL_TITLE_LINE + LABEL_LINE_GAP + LABEL_SUBTITLE_LINE,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fitsBounds(rect: Pick<PlacedLabel, "left" | "top" | "width" | "height">, bounds: LabelBounds): boolean {
  return (
    rect.left >= bounds.minX &&
    rect.top >= bounds.minY &&
    rect.left + rect.width <= bounds.maxX + 0.01 &&
    rect.top + rect.height <= bounds.maxY + 0.01
  );
}

function xRangesOverlap(
  a: Pick<PlacedLabel, "left" | "width">,
  b: Pick<PlacedLabel, "left" | "width">,
  gap = 4,
): boolean {
  return !(a.left + a.width + gap <= b.left || b.left + b.width + gap <= a.left);
}

function verticalGap(
  a: Pick<PlacedLabel, "top" | "height">,
  b: Pick<PlacedLabel, "top" | "height">,
): number {
  if (a.top >= b.top + b.height) return a.top - (b.top + b.height);
  if (b.top >= a.top + a.height) return b.top - (a.top + a.height);
  return 0;
}

function overlaps(
  a: Pick<PlacedLabel, "left" | "top" | "width" | "height">,
  b: Pick<PlacedLabel, "left" | "top" | "width" | "height">,
  gap = LABEL_OVERLAP_GAP,
): boolean {
  return !(
    a.left + a.width + gap <= b.left ||
    b.left + b.width + gap <= a.left ||
    a.top + a.height + gap <= b.top ||
    b.top + b.height + gap <= a.top
  );
}

function rectClearance(
  a: Pick<PlacedLabel, "left" | "top" | "width" | "height">,
  b: Pick<PlacedLabel, "left" | "top" | "width" | "height">,
): number {
  if (overlaps(a, b, 0)) return 0;
  const dx = Math.max(0, Math.max(b.left - (a.left + a.width), a.left - (b.left + b.width)));
  const dy = Math.max(0, Math.max(b.top - (a.top + a.height), a.top - (b.top + b.height)));
  return Math.hypot(dx, dy);
}

function anchorOnCard(anchorX: number, left: number, width: number): boolean {
  return anchorX >= left + ANCHOR_INSET && anchorX <= left + width - ANCHOR_INSET;
}

export function leftForAnchor(anchorX: number, width: number, bounds: LabelBounds): number | null {
  if (width > bounds.maxX - bounds.minX) return null;

  let left = clamp(anchorX - width / 2, bounds.minX, bounds.maxX - width);
  left = clamp(left, anchorX - width + ANCHOR_INSET, anchorX - ANCHOR_INSET);
  left = clamp(left, bounds.minX, bounds.maxX - width);

  return anchorOnCard(anchorX, left, width) ? left : null;
}

function horizontalCandidates(anchorX: number, width: number, bounds: LabelBounds): number[] {
  const values = new Set<number>();
  const primary = leftForAnchor(anchorX, width, bounds);
  if (primary != null) values.add(primary);

  for (const ratio of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    const left = clamp(anchorX - width * ratio, bounds.minX, bounds.maxX - width);
    if (anchorOnCard(anchorX, left, width)) values.add(left);
  }

  return [...values];
}

function rectHitsPoints(
  rect: Pick<PlacedLabel, "left" | "top" | "width" | "height">,
  points: Array<{ x: number; y: number }>,
  buffer: number,
): boolean {
  for (const point of points) {
    if (
      point.x >= rect.left - buffer &&
      point.x <= rect.left + rect.width + buffer &&
      point.y >= rect.top - buffer &&
      point.y <= rect.top + rect.height + buffer
    ) {
      return true;
    }
  }
  return false;
}

function verticalLeaderCrossesRect(
  anchorX: number,
  y1: number,
  y2: number,
  rect: Pick<PlacedLabel, "left" | "top" | "width" | "height">,
): boolean {
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  if (anchorX < rect.left - LEADER_CLEARANCE || anchorX > rect.left + rect.width + LEADER_CLEARANCE) {
    return false;
  }
  return bottom >= rect.top - LEADER_CLEARANCE && top <= rect.top + rect.height + LEADER_CLEARANCE;
}

export function verticalLeaderAttach(
  label: Pick<PlacedLabel, "left" | "top" | "width" | "height" | "anchorX" | "side">,
): { leaderX: number; leaderY: number } {
  return {
    leaderX: clamp(label.anchorX, label.left + ANCHOR_INSET, label.left + label.width - ANCHOR_INSET),
    leaderY: label.side === "above" ? label.top + label.height : label.top,
  };
}

export function leaderAttachPoint(
  label: Pick<PlacedLabel, "left" | "top" | "width" | "height" | "anchorX" | "anchorY" | "side">,
): { x: number; y: number } {
  const attach = verticalLeaderAttach(label);
  return { x: attach.leaderX, y: attach.leaderY };
}

function topForPlacement(anchorY: number, height: number, side: LabelSide, tier: number): number {
  const step = height + 14;
  const offset = LABEL_GAP + MARKER_RADIUS + tier * step;
  return side === "above" ? anchorY - height - offset : anchorY + offset;
}

export function markerTipY(label: Pick<PlacedLabel, "anchorY" | "side" | "markerKind">): number {
  const kind = label.markerKind ?? "poi";
  if (kind === "finish" && label.side === "above") return label.anchorY - 4.5;
  if (kind === "finish") return label.anchorY + 4.5;
  return label.side === "above"
    ? label.anchorY - MARKER_RADIUS
    : label.anchorY + MARKER_RADIUS;
}

function withLeaders(label: PlacedLabel): PlacedLabel {
  const attach = verticalLeaderAttach(label);
  return { ...label, leaderX: attach.leaderX, leaderY: attach.leaderY };
}

function anchorDistance(a: LabelAnchor, b: LabelAnchor): number {
  return Math.hypot(a.anchorX - b.anchorX, a.anchorY - b.anchorY);
}

function preferredSides(
  anchor: LabelAnchor,
  index: number,
  placed: PlacedLabel[],
  labelsAboveOnly?: boolean,
): LabelSide[] {
  if (labelsAboveOnly) return ["above", "below"];

  let nearest: PlacedLabel | undefined;
  let nearestDist = Infinity;

  for (const other of placed) {
    const dist = anchorDistance(anchor, other);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = other;
    }
  }

  if (nearest && nearestDist < CLOSE_ANCHOR_DISTANCE) {
    const opposite = nearest.side === "above" ? "below" : "above";
    return [opposite, nearest.side];
  }

  return index % 2 === 0 ? ["above", "below"] : ["below", "above"];
}

function spacingConflict(
  rect: Pick<PlacedLabel, "left" | "top" | "width" | "height">,
  placed: PlacedLabel[],
): boolean {
  for (const other of placed) {
    if (overlaps(rect, other)) return true;
    if (
      xRangesOverlap(rect, other) &&
      verticalGap(rect, other) < MIN_XOVERLAP_VERTICAL_GAP
    ) {
      return true;
    }
  }
  return false;
}

function isValidPlacement(
  anchor: LabelAnchor,
  rect: Pick<PlacedLabel, "left" | "top" | "width" | "height">,
  side: LabelSide,
  placed: PlacedLabel[],
  bounds: LabelBounds,
  options: LayoutOptions,
): boolean {
  if (!fitsBounds(rect, bounds)) return false;
  if (!anchorOnCard(anchor.anchorX, rect.left, rect.width)) return false;
  if (spacingConflict(rect, placed)) return false;

  const buffer = options.avoidBuffer ?? TRACK_BUFFER;
  if (options.avoidPoints?.length && rectHitsPoints(rect, options.avoidPoints, buffer)) {
    return false;
  }

  const draft = { ...anchor, ...rect, side, leaderX: 0, leaderY: 0 };
  const attach = verticalLeaderAttach(draft);
  const tipY = markerTipY(draft);

  if (placed.some((other) => verticalLeaderCrossesRect(attach.leaderX, attach.leaderY, tipY, other))) {
    return false;
  }

  return true;
}

function scorePlacement(
  rect: Pick<PlacedLabel, "left" | "top" | "width" | "height">,
  side: LabelSide,
  anchor: LabelAnchor,
  placed: PlacedLabel[],
): number {
  if (placed.length === 0) return 100;

  let minClearance = Infinity;
  let oppositeBonus = 0;

  for (const other of placed) {
    const clearance = rectClearance(rect, other);
    if (clearance === 0) return -1;
    minClearance = Math.min(minClearance, clearance);

    if (anchorDistance(anchor, other) < CLOSE_ANCHOR_DISTANCE && other.side !== side) {
      oppositeBonus += 20;
    }
  }

  return minClearance + oppositeBonus;
}

function* generateCandidates(
  anchor: LabelAnchor,
  width: number,
  height: number,
  bounds: LabelBounds,
  index: number,
  placed: PlacedLabel[],
  options: LayoutOptions,
): Generator<{ left: number; top: number; side: LabelSide }> {
  for (const side of preferredSides(anchor, index, placed, options.labelsAboveOnly)) {
    for (let tier = 0; tier < 28; tier += 1) {
      const top = topForPlacement(anchor.anchorY, height, side, tier);
      for (const left of horizontalCandidates(anchor.anchorX, width, bounds)) {
        yield { left, top, side };
      }
    }
  }
}

function findBestPlacement(
  anchor: LabelAnchor,
  index: number,
  width: number,
  height: number,
  placed: PlacedLabel[],
  bounds: LabelBounds,
  options: LayoutOptions,
): PlacedLabel | null {
  let best: PlacedLabel | null = null;
  let bestScore = -1;

  for (const candidate of generateCandidates(anchor, width, height, bounds, index, placed, options)) {
    const rect = { ...candidate, width, height };
    if (!isValidPlacement(anchor, rect, candidate.side, placed, bounds, options)) continue;

    const score = scorePlacement(rect, candidate.side, anchor, placed);
    if (score > bestScore) {
      bestScore = score;
      best = withLeaders({ ...anchor, ...rect, leaderX: 0, leaderY: 0 });
    }
  }

  return best;
}

function nudgeApart(a: PlacedLabel, b: PlacedLabel, bounds: LabelBounds): void {
  if (!overlaps(a, b, 2) && !(xRangesOverlap(a, b) && verticalGap(a, b) < MIN_XOVERLAP_VERTICAL_GAP)) {
    return;
  }

  const moveB = b.sortKey != null && a.sortKey != null ? b.sortKey >= a.sortKey : b.top >= a.top;
  const upper = moveB ? a : b;
  const lower = moveB ? b : a;

  if (xRangesOverlap(upper, lower)) {
    if (upper.side === "above" && lower.side === "above") {
      lower.top = upper.top - lower.height - LABEL_OVERLAP_GAP;
    } else if (upper.side === "below" && lower.side === "below") {
      lower.top = upper.top + upper.height + LABEL_OVERLAP_GAP;
    } else if (lower.side === "above") {
      lower.top = upper.top - lower.height - LABEL_OVERLAP_GAP;
    } else {
      lower.top = upper.top + upper.height + LABEL_OVERLAP_GAP;
    }
  } else if (overlaps(a, b, 2)) {
    lower.top = lower.side === "above"
      ? upper.top - lower.height - LABEL_OVERLAP_GAP
      : upper.top + upper.height + LABEL_OVERLAP_GAP;
  }

  lower.top = clamp(lower.top, bounds.minY, bounds.maxY - lower.height);
  Object.assign(lower, withLeaders(lower));
}

function resolveOverlaps(labels: PlacedLabel[], bounds: LabelBounds): PlacedLabel[] {
  const resolved = labels.map((label) => ({ ...label }));

  for (let pass = 0; pass < 80; pass += 1) {
    let moved = false;

    for (let i = 0; i < resolved.length; i += 1) {
      for (let j = i + 1; j < resolved.length; j += 1) {
        const beforeTop = resolved[j].top;
        nudgeApart(resolved[i], resolved[j], bounds);
        if (resolved[j].top !== beforeTop) moved = true;
      }
    }

    if (!moved) break;
  }

  return resolved.map((label) => {
    label.top = clamp(label.top, bounds.minY, bounds.maxY - label.height);
    const left = leftForAnchor(label.anchorX, label.width, bounds);
    if (left != null) label.left = left;
    return withLeaders(label);
  });
}

function prepareAnchor(anchor: LabelAnchor, compact?: boolean): LabelAnchor {
  if (!compact) return anchor;
  return { ...anchor, content: compactLabelContent(anchor.content) };
}

export function layoutLabels(
  anchors: LabelAnchor[],
  bounds: LabelBounds,
  options: LayoutOptions = {},
): PlacedLabel[] {
  const sorted = [...anchors].sort(
    (a, b) => (a.sortKey ?? a.anchorX) - (b.sortKey ?? b.anchorX) || a.anchorY - b.anchorY,
  );

  const placed: PlacedLabel[] = [];

  sorted.forEach((rawAnchor, index) => {
    const anchor = prepareAnchor(rawAnchor, options.compact);
    const { width, height } = measureLabelBox(anchor.content, options.compact);

    const found = findBestPlacement(anchor, index, width, height, placed, bounds, options);
    if (found) {
      placed.push(found);
      return;
    }

    const left = leftForAnchor(anchor.anchorX, width, bounds);
    if (left == null) return;

    const sides = preferredSides(anchor, index, placed, options.labelsAboveOnly);
    for (const side of sides) {
      for (let tier = 0; tier < 30; tier += 1) {
        const top = clamp(topForPlacement(anchor.anchorY, height, side, tier), bounds.minY, bounds.maxY - height);
        const rect = { left, top, width, height };
        if (!spacingConflict(rect, placed) && fitsBounds(rect, bounds)) {
          placed.push(withLeaders({ ...anchor, ...rect, side, leaderX: 0, leaderY: 0 }));
          return;
        }
      }
    }
  });

  return resolveOverlaps(placed, bounds);
}

export function assertLabelsValid(labels: PlacedLabel[], bounds: LabelBounds): boolean {
  if (!labels.every((label) => fitsBounds(label, bounds))) return false;

  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      if (overlaps(labels[i], labels[j], 2)) return false;
      if (
        xRangesOverlap(labels[i], labels[j]) &&
        verticalGap(labels[i], labels[j]) < MIN_XOVERLAP_VERTICAL_GAP - 1
      ) {
        return false;
      }
    }
  }

  return true;
}
