"use client";

import { memo, useMemo } from "react";
import { useXAxisScale, useYAxisScale } from "recharts";
import { colorForGradePct, type ProfileChartPoint } from "@/lib/gpx/gradient";

interface ProfileGradeFillProps {
  data: ProfileChartPoint[];
  baseline: number;
}

function ProfileGradeFillComponent({ data, baseline }: ProfileGradeFillProps) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();

  const segments = useMemo(() => {
    if (!xScale || !yScale || data.length < 2) {
      return [];
    }

    const baselineY = yScale(baseline);
    if (baselineY == null || Number.isNaN(baselineY)) {
      return [];
    }

    return data.slice(1).flatMap((point, index) => {
      const prev = data[index];
      const x0 = xScale(prev.distanceKm);
      const x1 = xScale(point.distanceKm);
      const y0 = yScale(prev.elevation);
      const y1 = yScale(point.elevation);

      if (
        x0 == null ||
        x1 == null ||
        y0 == null ||
        y1 == null ||
        Number.isNaN(x0) ||
        Number.isNaN(x1) ||
        Number.isNaN(y0) ||
        Number.isNaN(y1)
      ) {
        return [];
      }

      const segmentGrade = (prev.gradePct + point.gradePct) / 2;

      return [
        {
          key: `${prev.distanceKm}-${point.distanceKm}-${index}`,
          d: `M ${x0} ${y0} L ${x1} ${y1} L ${x1} ${baselineY} L ${x0} ${baselineY} Z`,
          fill: colorForGradePct(segmentGrade),
        },
      ];
    });
  }, [baseline, data, xScale, yScale]);

  if (segments.length === 0) {
    return null;
  }

  return (
    <g className="recharts-profile-grade-fill">
      {segments.map((segment) => (
        <path
          key={segment.key}
          d={segment.d}
          fill={segment.fill}
          fillOpacity={0.85}
          stroke="none"
        />
      ))}
    </g>
  );
}

export const ProfileGradeFill = memo(ProfileGradeFillComponent);
