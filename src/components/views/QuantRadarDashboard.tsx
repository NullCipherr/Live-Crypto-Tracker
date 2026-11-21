import { useMemo } from 'react';
import type { ApexOptions } from 'apexcharts';
import type { CoinMarket } from '../../types/crypto';
import { usePreferences } from '../../hooks/usePreferences';
import { ApexChartWrapper } from '../analytics/ApexChartWrapper';
import { ChartCard, SectionHeader } from '../analytics/ChartCard';
import { PageHeader } from '../shell/PageHeader';

function pearsonArray(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 0 ? num / den : 0;
}

interface QuantRadarDashboardProps {
  coins: CoinMarket[];
  onOpenAsset: (coinId: string) => void;
}

const COLORS = ['#F7931A', '#627EEA', '#14F195', '#82B4FF', '#F472B6', '#A78BFA'];

function computeSparkStats(coin: CoinMarket) {
  const pts = coin.sparkline7d;
  if (pts.length < 10 || pts[0] <= 0) return null;
  const returns: number[] = [];
  let peak = pts[0];
  let maxDd = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i - 1] > 0) {
      returns.push(((pts[i] - pts[i - 1]) / pts[i - 1]) * 100);
    }
    if (pts[i] > peak) peak = pts[i];
    const dd = peak > 0 ? ((pts[i] - peak) / peak) * 100 : 0;
    if (dd < maxDd) maxDd = dd;
  }
  const mean = returns.reduce((s, v) => s + v, 0) / (returns.length || 1);
  const variance =
    returns.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(1, returns.length - 1);
  const vol = Math.sqrt(variance);
  const ret7d = ((pts[pts.length - 1] - pts[0]) / pts[0]) * 100;
  const distPeak = peak > 0 ? ((pts[pts.length - 1] - peak) / peak) * 100 : 0;
  const avg7d = pts.reduce((s, v) => s + v, 0) / pts.length;
  const aboveAvg = pts[pts.length - 1] >= avg7d;
  const efficiency = vol > 0 ? ret7d / vol : 0;

  return { coin, returns, vol, ret7d, maxDd, distPeak, aboveAvg, efficiency };
}

export function QuantRadarDashboard({ coins }: QuantRadarDashboardProps) {
  const { preferences } = usePreferences();

  const quantList = useMemo(
    () =>
      coins
        .slice(0, 80)
        .map(computeSparkStats)
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [coins]
  );

  // 11. Efficiency Index (7d Return / 7d Volatility) - Top 12 by Cap
  const top12 = useMemo(() => quantList.slice(0, 12), [quantList]);

  // 12. Radar profile for top 3 (BTC, ETH, SOL/BNB)
  const radarSeries = useMemo(() => {
    const top3 = quantList.slice(0, 3);
    const maxVol = Math.max(...top3.map((q) => q.coin.totalVolume), 1);
    return top3.map((q, idx) => {
      const rangeSpan = Math.max(q.coin.high24h - q.coin.low24h, 0);
      const rangePos =
        rangeSpan > 0 ? ((q.coin.currentPrice - q.coin.low24h) / rangeSpan) * 100 : 50;
      const stability = Math.max(10, Math.min(100, 100 - q.vol * 25));
      const liqScore = Math.round((q.coin.totalVolume / maxVol) * 100);
      const retScore = Math.max(5, Math.min(100, 50 + q.ret7d * 2.5));
      const mom24Score = Math.max(5, Math.min(100, 50 + q.coin.priceChange24h * 4));
      return {
        name: q.coin.symbol.toUpperCase(),
        color: COLORS[idx % COLORS.length],
        data: [
          Math.round(retScore),
          liqScore,
          Math.round(stability),
          Math.round(rangePos),
          Math.round(mom24Score),
        ],
      };
    });
  }, [quantList]);

  // 13. Cumulative 7d Area curves (Top 5)
  const top5Area = useMemo(
    () =>
      quantList.slice(0, 5).map((q, idx) => {
        const pts = q.coin.sparkline7d;
        const base = pts[0] || 1;
        const step = Math.max(1, Math.floor(pts.length / 28));
        const sampled: [number, number][] = [];
        for (let i = 0; i < pts.length; i += step) {
          sampled.push([i, Number((((pts[i] - base) / base) * 100).toFixed(2))]);
        }
        return {
          name: q.coin.symbol.toUpperCase(),
          color: COLORS[idx % COLORS.length],
          data: sampled,
        };
      }),
    [quantList]
  );

  // 15. Correlation Heatmap (Top 6)
  const corrHeatmap = useMemo(() => {
    const top6 = quantList.slice(0, 6);
    return top6.map((row) => ({
      name: row.coin.symbol.toUpperCase(),
      data: top6.map((col) => ({
        x: col.coin.symbol.toUpperCase(),
        y: Number(pearsonArray(row.returns, col.returns).toFixed(2)),
      })),
    }));
  }, [quantList]);

  // 18. Volume Dominance by Tier
  const volTiers = useMemo(() => {
    const sumVol = (arr: CoinMarket[]) =>
      Math.round(arr.reduce((s, c) => s + c.totalVolume, 0) / 1e9);
    return [
      sumVol(coins.slice(0, 5)),
      sumVol(coins.slice(5, 20)),
      sumVol(coins.slice(20, 100)),
      sumVol(coins.slice(100, 1000)),
    ];
  }, [coins]);

  // 20. Momentum Thermometer (% above 7d mean)
  const aboveAvgPct = useMemo(() => {
    const slice50 = quantList.slice(0, 50);
    if (slice50.length === 0) return 0;
    const count = slice50.filter((q) => q.aboveAvg).length;
    return Math.round((count / slice50.length) * 100);
  }, [quantList]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Radar Quant"
        subtitle={`10 gráficos quantitativos de risco, eficiência, correlação e momentum (7 dias · ${preferences.timezone})`}
        actions={
          <span className="rounded border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
            Cálculo 100% local · {quantList.length} séries analisadas
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto grid w-full max-w-page gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <SectionHeader
              title="Eficiência, perfil e curvas semanais"
              description="Relação risco-retorno, perfil multidimensional e evolução acumulada em 7 dias"
            />
          </div>
          <ChartCard
            title="Índice de eficiência 7d (Retorno / Volatilidade)"
            subtitle="Top 12 ativos por capitalização"
          >
            <ApexChartWrapper
              type="bar"
              series={[
                {
                  name: 'Eficiência',
                  data: top12.map((q) => Number(q.efficiency.toFixed(2))),
                },
              ]}
              options={{
                colors: ['#82B4FF'],
                plotOptions: { bar: { borderRadius: 4, columnWidth: '56%' } },
                xaxis: { categories: top12.map((q) => q.coin.symbol.toUpperCase()) },
              }}
            />
          </ChartCard>

          <ChartCard
            title="Perfil multidimensional (Top 3)"
            subtitle="Retorno 7d, Liquidez, Estabilidade, Faixa 24h e Momentum"
          >
            <ApexChartWrapper
              type="radar"
              series={radarSeries}
              options={{
                xaxis: {
                  categories: ['Retorno 7d', 'Liquidez', 'Estabilidade', 'Faixa 24h', 'Momentum'],
                },
                yaxis: { show: false, max: 100 },
                stroke: { width: 2 },
                fill: { opacity: 0.16 },
              }}
            />
          </ChartCard>

          <ChartCard
            title="Curva acumulada em 7 dias (Top 5)"
            subtitle="Evolução percentual normalizada na janela semanal"
          >
            <ApexChartWrapper
              type="area"
              series={top5Area}
              options={{
                stroke: { curve: 'smooth', width: 2 },
                fill: { type: 'gradient', gradient: { opacityFrom: 0.22, opacityTo: 0.02 } },
                xaxis: { type: 'numeric', labels: { show: false } },
                yaxis: { labels: { formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%` } },
              }}
            />
          </ChartCard>

          <ChartCard
            title="Volatilidade realizada em 7d (Top 12)"
            subtitle="Desvio-padrão das variações amostrais (%)"
          >
            <ApexChartWrapper
              type="bar"
              series={[
                {
                  name: 'Volatilidade (%)',
                  data: top12.map((q) => Number(q.vol.toFixed(2))),
                },
              ]}
              options={{
                colors: ['#FBBF24'],
                plotOptions: { bar: { horizontal: true, borderRadius: 3 } },
                xaxis: { categories: top12.map((q) => q.coin.symbol.toUpperCase()) },
              }}
            />
          </ChartCard>

          <div className="pt-4 lg:col-span-2">
            <SectionHeader
              title="Volatilidade, correlação e momentum"
              description="Risco realizado, dependência entre ativos líderes, recuo semanal e termômetro"
            />
          </div>

          <ChartCard
            title="Matriz de correlação 7d (Top 6)"
            subtitle="Correlação de Pearson entre os principais ativos"
          >
            <ApexChartWrapper
              type="heatmap"
              series={corrHeatmap}
              options={{
                dataLabels: { enabled: true, style: { fontSize: '10px' } },
                plotOptions: {
                  heatmap: {
                    colorScale: {
                      ranges: [
                        { from: -1, to: 0.2, color: '#334155', name: 'Baixa' },
                        { from: 0.21, to: 0.65, color: '#2563EB', name: 'Moderada' },
                        { from: 0.66, to: 1, color: '#10B981', name: 'Forte' },
                      ],
                    },
                  },
                },
              }}
            />
          </ChartCard>

          <ChartCard
            title="Momentum 24h vs. 7d (Top 8)"
            subtitle="Comparação entre variação recente e tendência semanal"
          >
            <ApexChartWrapper
              type="bar"
              series={[
                {
                  name: '24h (%)',
                  data: quantList.slice(0, 8).map((q) => Number(q.coin.priceChange24h.toFixed(2))),
                },
                {
                  name: '7d (%)',
                  data: quantList.slice(0, 8).map((q) => Number(q.ret7d.toFixed(2))),
                },
              ]}
              options={{
                colors: ['#38BDF8', '#A78BFA'],
                plotOptions: { bar: { borderRadius: 3, columnWidth: '62%' } },
                xaxis: { categories: quantList.slice(0, 8).map((q) => q.coin.symbol.toUpperCase()) },
                yaxis: { labels: { formatter: (v: number) => `${v.toFixed(1)}%` } },
              }}
            />
          </ChartCard>

          <ChartCard
            title="Distância da máxima de 7 dias (%)"
            subtitle="Recuo atual em relação ao pico semanal (Top 12)"
          >
            <ApexChartWrapper
              type="bar"
              series={[
                {
                  name: 'Recuo (%)',
                  data: top12.map((q) => Number(q.distPeak.toFixed(2))),
                },
              ]}
              options={{
                colors: ['#F43F5E'],
                plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
                xaxis: { categories: top12.map((q) => q.coin.symbol.toUpperCase()) },
                yaxis: { labels: { formatter: (v: number) => `${v.toFixed(1)}%` } },
              }}
            />
          </ChartCard>

          <ChartCard
            title="Dominância de volume por tier (US$ bi)"
            subtitle="Distribuição do giro em 24h entre faixas de ranking"
          >
            <ApexChartWrapper
              type="donut"
              series={volTiers}
              options={{
                labels: ['Top 5', '6–20', '21–100', '101–1000'],
                colors: ['#82B4FF', '#34D399', '#FBBF24', '#64748B'],
                legend: { position: 'bottom' },
              }}
            />
          </ChartCard>

          <ChartCard
            title="Assimetria Risco × Retorno (7 dias)"
            subtitle="Volatilidade amostral (%) vs. Retorno semanal (%) — Top 20"
          >
            <ApexChartWrapper
              type="scatter"
              series={quantList.slice(0, 20).map((q, idx) => ({
                name: q.coin.symbol.toUpperCase(),
                color: COLORS[idx % COLORS.length],
                data: [[Number(q.vol.toFixed(2)), Number(q.ret7d.toFixed(2))]],
              }))}
              options={
                {
                  legend: { show: false },
                  markers: { size: 6 },
                  xaxis: {
                    type: 'numeric',
                    tickAmount: 5,
                    labels: { formatter: (v: string) => `${Number(v).toFixed(2)}%` },
                  },
                  yaxis: { labels: { formatter: (v: number) => `${v.toFixed(1)}%` } },
                } satisfies ApexOptions
              }
            />
          </ChartCard>

          <ChartCard
            title="Termômetro de momentum (Top 50)"
            subtitle="Percentual de ativos negociando acima da média de 7 dias"
          >
            <ApexChartWrapper
              type="radialBar"
              series={[aboveAvgPct]}
              options={{
                labels: ['Acima da média 7d'],
                colors: [aboveAvgPct >= 50 ? '#34D399' : '#F43F5E'],
                plotOptions: {
                  radialBar: {
                    hollow: { size: '62%' },
                    dataLabels: {
                      value: {
                        fontSize: '22px',
                        fontWeight: 700,
                        formatter: (val: number) => `${Math.round(val)}%`,
                      },
                    },
                  },
                },
              }}
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
