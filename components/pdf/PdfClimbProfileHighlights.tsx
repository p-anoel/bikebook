import { Circle, G, Rect, Text } from "@react-pdf/renderer";
import type { PdfClimbHighlight } from "@/lib/pdf/elevation-chart";

interface PdfClimbProfileHighlightsProps {
  highlights: PdfClimbHighlight[];
}

export function PdfClimbProfileHighlights({ highlights }: PdfClimbProfileHighlightsProps) {
  if (highlights.length === 0) return null;

  return (
    <>
      {highlights.map((highlight) => (
        <G key={`climb-${highlight.id}`}>
          <Rect
            x={highlight.x}
            y={highlight.y}
            width={highlight.width}
            height={highlight.height}
            fill="#f59e0b"
            fillOpacity={0.14}
            stroke="#f59e0b"
            strokeOpacity={0.85}
            strokeWidth={1.5}
          />
          <Circle
            cx={highlight.badgeX}
            cy={highlight.badgeY}
            r={highlight.badgeR + 1}
            fill="#ffffff"
          />
          <Circle
            cx={highlight.badgeX}
            cy={highlight.badgeY}
            r={highlight.badgeR}
            fill="#f59e0b"
          />
          <Text
            x={highlight.badgeX}
            y={highlight.badgeY + (highlight.number > 9 ? 2.5 : 2.8)}
            style={{
              fontSize: highlight.number > 9 ? 6 : 7,
              fill: "#ffffff",
              textAnchor: "middle",
              fontFamily: "Helvetica-Bold",
            }}
          >
            {String(highlight.number)}
          </Text>
        </G>
      ))}
    </>
  );
}
