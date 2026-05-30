function ErmineSpot({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${scale})`}
      fill="#000000"
      d="M0 -2.4 L0.85 -0.95 L0.55 0.35 L0 1.65 L-0.55 0.35 L-0.85 -0.95 Z M0 -1.55 L0.35 -0.55 L0 0.15 L-0.35 -0.55 Z"
    />
  );
}

/** Gwenn ha du — 9 bandes horizontales, canton ermine en haut à gauche. */
export function BrittanyFlag({ className }: { className?: string }) {
  const width = 60;
  const height = 40;
  const stripeHeight = height / 9;
  const cantonWidth = width / 2;
  const cantonHeight = stripeHeight * 4;

  const ermineRows = [
    [5, 11, 17, 23],
    [8, 14, 20],
    [5, 11, 17, 23],
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: 9 }, (_, index) => (
        <rect
          key={index}
          y={index * stripeHeight}
          width={width}
          height={stripeHeight}
          fill={index % 2 === 0 ? "#000000" : "#ffffff"}
        />
      ))}

      <rect x={0} y={0} width={cantonWidth} height={cantonHeight} fill="#ffffff" />

      {ermineRows.map((row, rowIndex) =>
        row.map((x) => (
          <ErmineSpot
            key={`${rowIndex}-${x}`}
            x={x}
            y={stripeHeight * 0.9 + rowIndex * (stripeHeight * 0.95)}
            scale={0.72}
          />
        )),
      )}
    </svg>
  );
}
