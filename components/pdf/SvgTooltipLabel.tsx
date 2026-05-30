import { Circle, G, Line, Rect, Text } from "@react-pdf/renderer";
import type { PlacedLabel } from "@/lib/pdf/label-layout";
import {
  LABEL_LINE_GAP,
  LABEL_PAD_X,
  LABEL_PAD_Y,
  LABEL_RADIUS,
  LABEL_SUBTITLE_LINE,
  LABEL_SUBTITLE_SIZE,
  LABEL_TITLE_LINE,
  LABEL_TITLE_SIZE,
  MARKER_RADIUS,
  markerTipY,
  verticalLeaderAttach,
} from "@/lib/pdf/label-layout";

interface SvgTooltipLabelsProps {
  labels: PlacedLabel[];
}

function FinishFlag({ x, y, size = 9 }: { x: number; y: number; size?: number }) {
  const left = x - size / 2;
  const top = y - size / 2;
  const half = size / 2;

  return (
    <>
      <Rect x={left} y={top} width={size} height={size} fill="#ffffff" stroke="#18181b" strokeWidth={1} />
      <Rect x={left} y={top} width={half} height={half} fill="#18181b" />
      <Rect x={left + half} y={top + half} width={half} height={half} fill="#18181b" />
    </>
  );
}

function MarkerAtAnchor({ label }: { label: PlacedLabel }) {
  const kind = label.markerKind ?? "poi";

  if (kind === "finish") {
    return <FinishFlag x={label.anchorX} y={label.anchorY} />;
  }

  if (kind === "start") {
    return (
      <>
        <Circle cx={label.anchorX} cy={label.anchorY} r={MARKER_RADIUS + 1.5} fill="#ffffff" />
        <Circle
          cx={label.anchorX}
          cy={label.anchorY}
          r={MARKER_RADIUS}
          fill="#22c55e"
          stroke="#ffffff"
          strokeWidth={1.2}
        />
      </>
    );
  }

  return (
    <>
      <Circle cx={label.anchorX} cy={label.anchorY} r={MARKER_RADIUS + 1.5} fill="#ffffff" />
      <Circle
        cx={label.anchorX}
        cy={label.anchorY}
        r={MARKER_RADIUS}
        fill="#2563eb"
        stroke="#ffffff"
        strokeWidth={1.2}
      />
      {label.markerNumber != null ? (
        <Text
          x={label.anchorX}
          y={label.anchorY + 2.5}
          style={{
            fontSize: label.markerNumber > 9 ? 6 : 7,
            fill: "#ffffff",
            textAnchor: "middle",
            fontFamily: "Helvetica-Bold",
          }}
        >
          {String(label.markerNumber)}
        </Text>
      ) : null}
    </>
  );
}

function LeaderLine({ label }: { label: PlacedLabel }) {
  const tipY = markerTipY(label);
  const attach = verticalLeaderAttach(label);

  if (Math.abs(label.anchorX - attach.leaderX) < 0.75) {
    return (
      <Line
        x1={attach.leaderX}
        y1={attach.leaderY}
        x2={label.anchorX}
        y2={tipY}
        stroke="#a1a1aa"
        strokeWidth={0.75}
        strokeLinecap="round"
      />
    );
  }

  const elbowY = attach.leaderY + (tipY - attach.leaderY) * 0.45;

  return (
    <G>
      <Line
        x1={attach.leaderX}
        y1={attach.leaderY}
        x2={attach.leaderX}
        y2={elbowY}
        stroke="#a1a1aa"
        strokeWidth={0.75}
        strokeLinecap="round"
      />
      <Line
        x1={attach.leaderX}
        y1={elbowY}
        x2={label.anchorX}
        y2={elbowY}
        stroke="#a1a1aa"
        strokeWidth={0.75}
        strokeLinecap="round"
      />
      <Line
        x1={label.anchorX}
        y1={elbowY}
        x2={label.anchorX}
        y2={tipY}
        stroke="#a1a1aa"
        strokeWidth={0.75}
        strokeLinecap="round"
      />
    </G>
  );
}

function TooltipCard({ label }: { label: PlacedLabel }) {
  const { left, top, width, height, content } = label;
  const titleY = top + LABEL_PAD_Y + LABEL_TITLE_SIZE;
  const subtitleY = titleY + LABEL_LINE_GAP + LABEL_SUBTITLE_LINE;

  return (
    <G>
      <Rect
        x={left + 0.6}
        y={top + 1.2}
        width={width}
        height={height}
        fill="#e4e4e7"
        rx={LABEL_RADIUS}
      />
      <Rect
        x={left}
        y={top}
        width={width}
        height={height}
        fill="#ffffff"
        stroke="#d4d4d8"
        strokeWidth={0.85}
        rx={LABEL_RADIUS}
      />
      <Text
        x={left + LABEL_PAD_X}
        y={titleY}
        style={{ fontSize: LABEL_TITLE_SIZE, fontFamily: "Helvetica-Bold", fill: "#18181b" }}
      >
        {content.title}
      </Text>
      <Text
        x={left + LABEL_PAD_X}
        y={subtitleY}
        style={{ fontSize: LABEL_SUBTITLE_SIZE, fill: "#71717a" }}
      >
        {content.subtitle}
      </Text>
    </G>
  );
}

export function SvgTooltipLabels({ labels }: SvgTooltipLabelsProps) {
  return (
    <>
      {labels.map((label) => (
        <LeaderLine key={`leader-${label.id}`} label={label} />
      ))}
      {labels.map((label) => (
        <MarkerAtAnchor key={`marker-${label.id}`} label={label} />
      ))}
      {labels.map((label) => (
        <TooltipCard key={`card-${label.id}`} label={label} />
      ))}
    </>
  );
}
