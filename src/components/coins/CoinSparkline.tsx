import { memo, useMemo } from 'react';

interface CoinSparklineProps {
  data: number[];
}

const WIDTH = 96;
const HEIGHT = 24;
const PADDING = 2;

export const CoinSparkline = memo(function CoinSparkline({ data }: CoinSparklineProps) {
  const points = useMemo(() => {
    if (data.length < 2) return '';

    let min = Infinity;
    let max = -Infinity;
    for (const value of data) {
      if (value < min) min = value;
      if (value > max) max = value;
    }

    const range = max - min || 1;
    const innerHeight = HEIGHT - PADDING * 2;
    const stepX = WIDTH / (data.length - 1);

    return data
      .map((value, index) => {
        const x = (index * stepX).toFixed(2);
        const y = (HEIGHT - PADDING - ((value - min) / range) * innerHeight).toFixed(2);
        return `${x},${y}`;
      })
      .join(' ');
  }, [data]);

  if (!points) {
    return <span className="inline-block h-6 w-20" aria-hidden="true" />;
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-6 w-20 overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={points}
      />
    </svg>
  );
});
