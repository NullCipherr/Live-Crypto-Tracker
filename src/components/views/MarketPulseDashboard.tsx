import { useMemo, useState } from 'react';
import type { ApexOptions } from 'apexcharts';
import type { CoinMarket } from '../../types/crypto';
import { formatCompactNumber, formatPercent } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { ApexChartWrapper } from '../analytics/ApexChartWrapper';
import { ChartCard, SectionHeader } from '../analytics/ChartCard';
import { Interactive3DSunburst } from '../analytics/Interactive3DSunburst';
import { PageHeader, HeaderSegmented } from '../shell/PageHeader';

interface MarketPulseDashboardProps {
  coins: CoinMarket[];
  onOpenAsset: (coinId: string) => void;
}

const COLORS = ['#82B4FF', '#34D399', '#FBBF24', '#F472B6', '#A78BFA', '#38BDF8', '#FB7185', '#2DD4BF'];

export function MarketPulseDashboard({ coins, onOpenAsset }: MarketPulseDashboardProps) {
  const { preferences } = usePreferences();
  const [scope, setScope] = useState<'all' | 'top100' | 'top250'>('all');

  const scoped = useMemo(() => {
    if (scope === 'top100') return coins.slice(0, 100);
    if (scope === 'top250') return coins.slice(0, 250);
    return coins;
  }, [coins, scope]);

  // 1. Return distribution histogram
  const distData = useMemo(() => {
    const labels = ['< -10%', '-10 a -5%', '-5 a -2%', '-2 a 0%', '0 a +2%', '+2 a +5%', '+5 a +10%', '> +10%'];
    const counts = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const c of scoped) {
      const v = c.priceChange24h;
      if (v < -10) counts[0]++;
      else if (v < -5) counts[1]++;
      else if (v < -2) counts[2]++;
      else if (v < 0) counts[3]++;
      else if (v <= 2) counts[4]++;
      else if (v <= 5) counts[5]++;
      else if (v <= 10) counts[6]++;
      else counts[7]++;
    }
    return { labels, counts };
  }, [scoped]);

  // 2. Breadth donut (up / flat / down)
  const breadthCounts = useMemo(() => {
    let up = 0;
    let flat = 0;
    let down = 0;
    for (const c of scoped) {
      if (c.priceChange24h > 0.25) up++;
      else if (c.priceChange24h < -0.25) down++;
      else flat++;
    }
    return [up, down, flat];
  }, [scoped]);

  // 3. Top 10 Liquidity Leaders
  const topVolume = useMemo(
    () => [...scoped].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 10),
    [scoped]
  );

  // 4. Turnover Rate (Volume / MarketCap %)
  const topTurnover = useMemo(
    () =>
      scoped
        .filter((c) => c.marketCap > 10_000_000 && c.totalVolume > 0)
        .map((c) => ({
          symbol: c.symbol.toUpperCase(),
          turnover: Number(((c.totalVolume / c.marketCap) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.turnover - a.turnover)
        .slice(0, 10),
    [scoped]
  );

  // 5. Market Cap Concentration (Top 4 vs Rest)
  const capPie = useMemo(() => {
    const sorted = [...scoped].sort((a, b) => b.marketCap - a.marketCap);
    const top4 = sorted.slice(0, 4);
    const restCap = sorted.slice(4).reduce((s, c) => s + c.marketCap, 0);
    return {
      labels: [...top4.map((c) => c.symbol.toUpperCase()), 'Restante'],
      values: [...top4.map((c) => Math.round(c.marketCap / 1e9)), Math.round(restCap / 1e9)],
    };
  }, [scoped]);

  // 6. Average Intraday Range % by Rank Tier
  const tierSpread = useMemo(() => {
    const avgRange = (arr: CoinMarket[]) => {
      const valid = arr.filter((c) => c.low24h > 0 && c.high24h >= c.low24h);
      if (valid.length === 0) return 0;
      const sum = valid.reduce((s, c) => s + ((c.high24h - c.low24h) / c.low24h) * 100, 0);
      return Number((sum / valid.length).toFixed(2));
    };
    return [
      avgRange(coins.slice(0, 10)),
      avgRange(coins.slice(10, 50)),
      avgRange(coins.slice(50, 250)),
      avgRange(coins.slice(250, 1000)),
    ];
  }, [coins]);

  // 7. 7d Relative Strength (Top 6 weekly gainers with sparkline7d)
  const relStrength7d = useMemo(() => {
    const withSpark = scoped
      .filter((c) => c.sparkline7d.length >= 24 && c.sparkline7d[0] > 0)
      .map((c) => {
        const base = c.sparkline7d[0];
        const last = c.sparkline7d[c.sparkline7d.length - 1];
        return { coin: c, ret7d: ((last - base) / base) * 100 };
      })
      .sort((a, b) => b.ret7d - a.ret7d)
      .slice(0, 6);

    return withSpark.map((item, idx) => {
      const pts = item.coin.sparkline7d;
      const base = pts[0] || 1;
      const step = Math.max(1, Math.floor(pts.length / 24));
      const sampled: [number, number][] = [];
      for (let i = 0; i < pts.length; i += step) {
        sampled.push([i, Number((((pts[i] - base) / base) * 100).toFixed(2))]);
      }
      return {
        name: item.coin.symbol.toUpperCase(),
        color: COLORS[idx % COLORS.length],
        data: sampled,
      };
    });
  }, [scoped]);

  // 8. Scatter: Log10 Volume vs 24h Change (Top 40)
  const scatterLiquidity = useMemo(
    () =>
      scoped
        .slice(0, 40)
        .filter((c) => c.totalVolume > 0)
        .map((c) => ({
          name: c.symbol.toUpperCase(),
          data: [[Number(Math.log10(c.totalVolume).toFixed(2)), Number(c.priceChange24h.toFixed(2))]],
        })),
    [scoped]
  );

  // 9. Treemap Top 24 by Market Cap
  const treemapData = useMemo(
    () =>
      scoped.slice(0, 24).map((c) => ({
        x: `${c.symbol.toUpperCase()} (${formatPercent(c.priceChange24h, preferences.numberLocale)})`,
        y: Math.max(1, Math.round(c.marketCap / 1e6)),
      })),
    [preferences.numberLocale, scoped]
  );

  // 10. Average 24h Range Position (Radial)
  const avgRangePos = useMemo(() => {
    const top20 = scoped.slice(0, 20).filter((c) => c.high24h > c.low24h);
    if (top20.length === 0) return 50;
    const avg =
      top20.reduce((s, c) => s + ((c.currentPrice - c.low24h) / (c.high24h - c.low24h)) * 100, 0) /
      top20.length;
    return Math.round(Math.min(100, Math.max(0, avg)));
  }, [scoped]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Pulso de mercado"
        subtitle={`10 indicadores de amplitude, liquidez e fluxo sobre ${scoped.length} ativos (sem requisições extras)`}
        actions={
          <HeaderSegmented
            value={scope}
            onChange={setScope}
            options={[
              { id: 'all', label: `Todos (${coins.length})` },
              { id: 'top250', label: 'Top 250' },
              { id: 'top100', label: 'Top 100' },
            ]}
          />
        }
      />

      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-6">
          {/* Seção 1: Amplitude & Distribuição */}
          <section className="space-y-4">
            <SectionHeader
              title="Amplitude e distribuição (24h)"
              description="Leitura transversal de quantos ativos sobem ou caem e da pressão compradora intradiária"
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Distribuição de retornos (24h)"
                subtitle="Quantidade de ativos por faixa de variação diária"
              >
                <ApexChartWrapper
                  type="bar"
                  series={[{ name: 'Ativos', data: distData.counts }]}
                  options={{
                    colors: ['#82B4FF'],
                    xaxis: { categories: distData.labels },
                    plotOptions: { bar: { borderRadius: 4, columnWidth: '58%' } },
                  }}
                />
              </ChartCard>

              <div className="grid gap-6 sm:grid-cols-2">
                <ChartCard
                  title="Amplitude de mercado (24h)"
                  subtitle="Altas vs. quedas vs. estáveis"
                >
                  <ApexChartWrapper
                    type="donut"
                    series={breadthCounts}
                    options={{
                      labels: ['Em alta', 'Em queda', 'Estáveis'],
                      colors: ['#34D399', '#F43F5E', '#64748B'],
                      stroke: { width: 0 },
                      dataLabels: { enabled: false },
                      legend: {
                        position: 'bottom',
                        markers: { strokeWidth: 0 },
                      },
                      plotOptions: {
                        pie: {
                          donut: {
                            size: '68%',
                            labels: {
                              show: true,
                              name: {
                                show: true,
                                fontSize: '11px',
                                color: '#94A3B8',
                                offsetY: 16,
                              },
                              value: {
                                show: true,
                                fontSize: '22px',
                                fontWeight: 700,
                                offsetY: -14,
                              },
                              total: {
                                show: true,
                                label: 'Ativos',
                                fontSize: '11px',
                                color: '#94A3B8',
                                formatter: () => String(scoped.length),
                              },
                            },
                          },
                        },
                      },
                    }}
                  />
                </ChartCard>

                <ChartCard
                  title="Pressão na faixa 24h (Top 20)"
                  subtitle="Posição média entre mínima e máxima"
                >
                  <ApexChartWrapper
                    type="radialBar"
                    series={[avgRangePos]}
                    options={{
                      labels: ['Média na faixa'],
                      colors: [avgRangePos >= 50 ? '#34D399' : '#FBBF24'],
                      stroke: { lineCap: 'round' },
                      plotOptions: {
                        radialBar: {
                          startAngle: -135,
                          endAngle: 135,
                          hollow: { size: '68%' },
                          track: {
                            background: 'rgba(148, 163, 184, 0.14)',
                            strokeWidth: '100%',
                          },
                          dataLabels: {
                            name: {
                              show: true,
                              fontSize: '11px',
                              fontWeight: 500,
                              color: '#94A3B8',
                              offsetY: 22,
                            },
                            value: {
                              show: true,
                              fontSize: '28px',
                              fontWeight: 700,
                              offsetY: -10,
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
          </section>

          {/* Seção 2: Liquidez & Rotação de Capital */}
          <section className="space-y-4">
            <SectionHeader
              title="Liquidez e rotação de capital"
              description="Onde está concentrado o volume negociado, giro relativo e dispersão de retornos"
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Líderes de liquidez (Volume 24h)"
                subtitle="Top 10 maiores volumes negociados em USD"
              >
                <ApexChartWrapper
                  type="bar"
                  series={[
                    {
                      name: 'Volume (US$ bi)',
                      data: topVolume.map((c) => Number((c.totalVolume / 1e9).toFixed(2))),
                    },
                  ]}
                  options={{
                    colors: ['#38BDF8'],
                    plotOptions: { bar: { horizontal: true, borderRadius: 3 } },
                    xaxis: { categories: topVolume.map((c) => c.symbol.toUpperCase()) },
                    tooltip: {
                      y: {
                        formatter: (_v, opts) => {
                          const coin = opts ? topVolume[opts.dataPointIndex] : undefined;
                          return coin
                            ? `US$ ${formatCompactNumber(coin.totalVolume, preferences.numberLocale)}`
                            : '';
                        },
                      },
                    },
                  }}
                />
              </ChartCard>

              <ChartCard
                title="Taxa de giro (Volume / Cap. %)"
                subtitle="Ativos com maior rotação de capital em 24h"
              >
                <ApexChartWrapper
                  type="bar"
                  series={[{ name: 'Giro (%)', data: topTurnover.map((t) => t.turnover) }]}
                  options={{
                    colors: ['#A78BFA'],
                    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
                    xaxis: { categories: topTurnover.map((t) => t.symbol) },
                    yaxis: { labels: { formatter: (v: number) => `${v.toFixed(0)}%` } },
                  }}
                />
              </ChartCard>

              <ChartCard
                title="Dispersão Liquidez × Retorno 24h"
                subtitle="Escala log10(Volume USD) vs. Variação em 24h (Top 40)"
              >
                <ApexChartWrapper
                  type="scatter"
                  series={scatterLiquidity}
                  options={
                    {
                      legend: { show: false },
                      markers: { size: 6 },
                      xaxis: {
                        type: 'numeric',
                        tickAmount: 5,
                        labels: { formatter: (v: string) => `10^${Number(v).toFixed(1)}` },
                      },
                      yaxis: { labels: { formatter: (v: number) => `${v.toFixed(1)}%` } },
                    } satisfies ApexOptions
                  }
                />
              </ChartCard>

              <ChartCard
                title="Amplitude média diária por tier (%)"
                subtitle="Variação média (Máxima - Mínima) / Mínima por faixa de ranking"
              >
                <ApexChartWrapper
                  type="bar"
                  series={[{ name: 'Amplitude (%)', data: tierSpread }]}
                  options={{
                    colors: ['#FBBF24'],
                    plotOptions: { bar: { borderRadius: 4, columnWidth: '48%' } },
                    xaxis: { categories: ['Top 10', '11–50', '51–250', '251–1000'] },
                    yaxis: { labels: { formatter: (v: number) => `${v.toFixed(1)}%` } },
                  }}
                />
              </ChartCard>
            </div>
          </section>

          {/* Seção 3: Estrutura & Força Relativa */}
          <section className="space-y-4">
            <SectionHeader
              title="Estrutura e força relativa"
              description="Concentração de capitalização, líderes semanais e mapa proporcional do universo"
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Concentração de capitalização"
                subtitle="Participação dos 4 maiores ativos vs. restante do universo"
              >
                <ApexChartWrapper
                  type="donut"
                  series={capPie.values}
                  options={{
                    labels: capPie.labels,
                    colors: COLORS,
                    stroke: { width: 0 },
                    dataLabels: { enabled: false },
                    legend: {
                      position: 'bottom',
                      markers: { strokeWidth: 0 },
                    },
                    tooltip: {
                      y: {
                        formatter: (val: number) => `${val.toFixed(1)}%`,
                      },
                    },
                    plotOptions: {
                      pie: {
                        donut: {
                          size: '68%',
                          labels: {
                            show: true,
                            name: {
                              show: true,
                              fontSize: '11px',
                              color: '#94A3B8',
                              offsetY: 16,
                            },
                            value: {
                              show: true,
                              fontSize: '22px',
                              fontWeight: 700,
                              offsetY: -14,
                              formatter: (val: string) => `${Number(val).toFixed(1)}%`,
                            },
                            total: {
                              show: true,
                              label: 'Top 4',
                              fontSize: '11px',
                              color: '#94A3B8',
                              formatter: () => {
                                const top4 = capPie.values.slice(0, 4).reduce((s, v) => s + v, 0);
                                return `${top4.toFixed(1)}%`;
                              },
                            },
                          },
                        },
                      },
                    },
                  }}
                />
              </ChartCard>

              <ChartCard
                title="Força relativa semanal (Top 6 em 7d)"
                subtitle="Retorno acumulado normalizado em 0% no início da janela"
              >
                <ApexChartWrapper
                  type="line"
                  series={relStrength7d}
                  options={{
                    stroke: { curve: 'smooth', width: 2 },
                    xaxis: { type: 'numeric', labels: { show: false } },
                    yaxis: {
                      labels: { formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%` },
                    },
                  }}
                />
              </ChartCard>

              <ChartCard
                title="Mapa proporcional por capitalização (Top 24)"
                subtitle="Área proporcional ao valor de mercado"
                heightClass="h-[560px]"
                className="lg:col-span-2"
              >
                <ApexChartWrapper
                  type="treemap"
                  series={[{ data: treemapData }]}
                  options={{
                    legend: { show: false },
                    colors: ['#1F6FEB', '#2563EB', '#0EA5E9', '#10B981', '#6366F1'],
                    dataLabels: {
                      enabled: true,
                      style: {
                        fontSize: '12px',
                        fontWeight: 600,
                      },
                    },
                  }}
                />
              </ChartCard>

              <Interactive3DSunburst coins={scoped} onOpenAsset={onOpenAsset} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
