import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface CoinSparklineProps {
  data: number[];
  positive: boolean;
}

export function CoinSparkline({ data, positive }: CoinSparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            dot={false}
            stroke={positive ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
