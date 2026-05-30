import { Line, Path, Svg, Text } from "@react-pdf/renderer";
import { buildPdfElevationChartModel, buildPdfClimbHighlights } from "@/lib/pdf/elevation-chart";
import type { ClimbSegment } from "@/lib/gpx/gradient";
import type { PlacedLabel } from "@/lib/pdf/label-layout";
import type { TrackPoint } from "@/types/roadbook";
import { PdfClimbProfileHighlights } from "@/components/pdf/PdfClimbProfileHighlights";
import { SvgTooltipLabels } from "@/components/pdf/SvgTooltipLabel";

interface ElevationProfileChartProps {
  track: TrackPoint[];
  width: number;
  height: number;
  locale: string;
  labels: PlacedLabel[];
  kmUnit: string;
  seaLevelLabel: string;
  climbs?: ClimbSegment[];
  maxProfilePoints?: number;
  profileStrokeWidth?: number;
  variant?: "standard" | "strip";
}

export function ElevationProfileChart({
  track,
  width,
  height,
  locale,
  labels,
  kmUnit,
  seaLevelLabel,
  climbs = [],
  maxProfilePoints,
  profileStrokeWidth = 1.2,
  variant = "standard",
}: ElevationProfileChartProps) {
  const model = buildPdfElevationChartModel(
    track,
    width,
    height,
    locale,
    undefined,
    undefined,
    undefined,
    undefined,
    { maxProfilePoints, variant },
  );
  const { layout } = model;
  const isStrip = variant === "strip";
  const axisFontSize = isStrip ? 6 : 8;
  const fillOpacity = isStrip ? 1 : 0.85;
  const climbHighlights = !isStrip ? buildPdfClimbHighlights(climbs, layout) : [];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {model.yGridLines.map((y, index) => (
        <Line
          key={`grid-y-${index}`}
          x1={layout.plotLeft}
          y1={y}
          x2={layout.plotRight}
          y2={y}
          stroke="#e4e4e7"
          strokeWidth={0.5}
        />
      ))}
      {model.xGridLines.map((x, index) => (
        <Line
          key={`grid-x-${index}`}
          x1={x}
          y1={layout.plotTop}
          x2={x}
          y2={layout.plotBottom}
          stroke="#e4e4e7"
          strokeWidth={0.5}
        />
      ))}

      {climbHighlights.length > 0 ? (
        <PdfClimbProfileHighlights highlights={climbHighlights} />
      ) : null}

      {model.gradeSegments.map((segment) => (
        <Path key={segment.key} d={segment.d} fill={segment.fill} fillOpacity={fillOpacity} />
      ))}

      {!isStrip && model.profileLinePath ? (
        <Path
          d={model.profileLinePath}
          stroke="#1e40af"
          strokeWidth={profileStrokeWidth}
          fill="none"
        />
      ) : null}

      {!isStrip && model.seaLevelY != null ? (
        <>
          <Line
            x1={layout.plotLeft}
            y1={model.seaLevelY}
            x2={layout.plotRight}
            y2={model.seaLevelY}
            stroke="#0ea5e9"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <Text
            x={layout.plotLeft + 2}
            y={model.seaLevelY - 3}
            style={{ fontSize: axisFontSize, fill: "#0284c7" }}
          >
            {seaLevelLabel}
          </Text>
        </>
      ) : null}

      {model.yTicks.map((tick) => (
        <Text
          key={`ylabel-${tick.value}`}
          x={layout.plotLeft - 4}
          y={tick.y + 3}
          style={{ fontSize: axisFontSize, fill: "#71717a", textAnchor: "end" }}
        >
          {tick.label}
        </Text>
      ))}

      {model.xTicks.map((tick) => (
        <Text
          key={`xlabel-${tick.value}`}
          x={tick.x}
          y={layout.plotBottom + (isStrip ? 9 : 11)}
          style={{ fontSize: axisFontSize, fill: "#71717a", textAnchor: "middle" }}
        >
          {tick.label}
        </Text>
      ))}

      {!isStrip ? (
        <>
          <Text
            x={layout.plotRight - 2}
            y={layout.plotBottom + 11}
            style={{ fontSize: axisFontSize, fill: "#a1a1aa", textAnchor: "end" }}
          >
            {kmUnit}
          </Text>
          <Text
            x={layout.plotLeft - 4}
            y={layout.plotTop + 2}
            style={{ fontSize: axisFontSize, fill: "#a1a1aa", textAnchor: "end" }}
          >
            m
          </Text>
        </>
      ) : null}

      {!isStrip && labels.length > 0 ? <SvgTooltipLabels labels={labels} /> : null}
    </Svg>
  );
}
