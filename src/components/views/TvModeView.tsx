import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Pause, Play, Settings, X } from 'lucide-react';
import type { CoinMarket } from '../../types/crypto';
import { fetchAssetFullChart } from '../../services/coingecko';
import {
  bucketByDay,
  computeDailyReturns,
  computeDistributionStats,
} from '../../lib/analytics';
import {
  formatCompactNumber,
  formatDateShort,
  formatPercent,
  formatPrice,
  formatTime,
} from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';

interface TvModeViewProps {
  coins: CoinMarket[];
  watchlist: string[];
  fetchedAt?: number;
  isError: boolean;
  onExit: () => void;
}

type TvPanelId = 'market' | 'participation' | 'risk';

const PANEL_LABELS: Record<TvPanelId, string> = {
  market: 'Mercado',
  participation: 'Participação',
  risk: 'Risco',
};

const SERIES_COLORS = ['#82B4FF', '#34D399', '#FBBF24', '#F472B6', '#A78BFA', '#38BDF8'];

export function TvModeView({
  coins,
  watchlist,
  fetchedAt,
  isError,
  onExit,
}: TvModeViewProps) {
  const { preferences } = usePreferences();

  const tvCoins = useMemo(() => {
    if (watchlist.length >= 2) {
      const set = new Set(watchlist);
      const favs = coins.filter((c) => set.has(c.id));
      if (favs.length >= 2) return favs.slice(0, 6);
    }
    return coins.slice(0, 6);
  }, [coins, watchlist]);

  const [enabledPanels, setEnabledPanels] = useState<Record<TvPanelId, boolean>>({
    market: true,
    participation: true,
    risk: true,
  });
  const [secondsPerPanel, setSecondsPerPanel] = useState<number>(20);
  const [largeText, setLargeText] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(20);
  const [controlsVisible, setControlsVisible] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  const hideTimerRef = useRef<number | null>(null);

  // Live clock every second
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Fetch 90d history for Screen 3 (Risco) using shared 15-min cache
  const riskQueries = useQueries({
    queries: tvCoins.map((coin) => ({
      queryKey: ['analytics-full', coin.id, '90'],
      queryFn: () => fetchAssetFullChart(coin.id, '90'),
      staleTime: 15 * 60_000,
      retry: 1,
    })),
  });

  const riskData = useMemo(() => {
    const items = tvCoins
      .map((coin, idx) => {
        const raw = riskQueries[idx]?.data;
        const daily = raw ? bucketByDay(raw.prices) : [];
        const returns = computeDailyReturns(daily);
        const stats = computeDistributionStats(daily, returns);
        return { coin, daily, returns, stats };
      })
      .filter((item) => item.stats.points.length >= 5);

    let worstDrop: {
      coin: CoinMarket;
      dayKey: string;
      timestamp: number;
      ret: number;
      btcRet?: number;
      ethRet?: number;
    } | null = null;

    const btcItem = items.find((i) => i.coin.symbol.toLowerCase() === 'btc');
    const ethItem = items.find((i) => i.coin.symbol.toLowerCase() === 'eth');

    let globalMin = -4;
    let globalMax = 4;
    let widestIqr = items[0] ?? null;

    for (const item of items) {
      if (item.stats.min < globalMin) globalMin = item.stats.min;
      if (item.stats.max > globalMax) globalMax = item.stats.max;
      if (!widestIqr || item.stats.iqr > widestIqr.stats.iqr) widestIqr = item;

      for (const pt of item.stats.points) {
        if (!worstDrop || pt.ret < worstDrop.ret) {
          worstDrop = {
            coin: item.coin,
            dayKey: pt.dayKey,
            timestamp: pt.timestamp,
            ret: pt.ret,
            btcRet: btcItem?.returns.get(pt.dayKey),
            ethRet: ethItem?.returns.get(pt.dayKey),
          };
        }
      }
    }

    const bound = Math.ceil(Math.max(Math.abs(globalMin), Math.abs(globalMax), 4) / 2) * 2;
    return { items, worstDrop, widestIqr, minScale: -bound, maxScale: bound };
  }, [riskQueries, tvCoins]);

  const activePanels = useMemo<TvPanelId[]>(() => {
    const list: TvPanelId[] = [];
    if (enabledPanels.market) list.push('market');
    if (enabledPanels.participation) list.push('participation');
    if (enabledPanels.risk && riskData.items.length > 0) list.push('risk');
    return list.length > 0 ? list : ['market'];
  }, [enabledPanels, riskData.items.length]);

  const safeIndex = activeIndex % activePanels.length;
  const currentPanel = activePanels[safeIndex];
  const nextPanel = activePanels[(safeIndex + 1) % activePanels.length];

  const goStep = useCallback(
    (delta: -1 | 1) => {
      setActiveIndex((prev) => (prev + delta + activePanels.length) % activePanels.length);
      setSecondsLeft(secondsPerPanel);
    },
    [activePanels.length, secondsPerPanel]
  );

  // Rotation countdown
  useEffect(() => {
    if (paused || settingsOpen || activePanels.length <= 1) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setActiveIndex((idx) => (idx + 1) % activePanels.length);
          return secondsPerPanel;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activePanels.length, paused, secondsPerPanel, settingsOpen]);

  // Reveal floating controls on mouse move
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, []);

  // Keyboard shortcuts: Space, ArrowLeft, ArrowRight, F, Esc
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) {
        if (e.key === 'Escape') setSettingsOpen(false);
        return;
      }
      revealControls();
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goStep(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goStep(-1);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          onExit();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goStep, onExit, revealControls, settingsOpen]);

  // Portfolio & Market computations
  const totalCap = tvCoins.reduce((s, c) => s + c.marketCap, 0) || 1;
  const totalVolume = tvCoins.reduce((s, c) => s + c.totalVolume, 0);
  const btcCap = tvCoins.find((c) => c.symbol.toLowerCase() === 'btc')?.marketCap ?? 0;
  const btcDom = (btcCap / totalCap) * 100;
  const upCoins = tvCoins.filter((c) => c.priceChange24h > 0);
  const downCoins = tvCoins.filter((c) => c.priceChange24h <= 0);

  const contributions = useMemo(() => {
    return tvCoins
      .map((coin) => {
        const weight = coin.marketCap / totalCap;
        const contribPp = weight * coin.priceChange24h;
        return { coin, weightPct: weight * 100, contribPp };
      })
      .sort((a, b) => b.contribPp - a.contribPp);
  }, [totalCap, tvCoins]);

  const portfolioReturn = contributions.reduce((s, c) => s + c.contribPp, 0);
  const topDriver = contributions[0];
  const maxAbsContrib = Math.max(...contributions.map((c) => Math.abs(c.contribPp)), 0.1);

  // 24h normalized SVG lines for Tela 1 (from sparkline7d last 24 samples)
  const marketChart = useMemo(() => {
    const seriesList = tvCoins.slice(0, 4).map((coin, idx) => {
      const pts = coin.sparkline7d.slice(-24);
      const base = pts[0] || coin.currentPrice || 1;
      const rets = pts.map((p) => ((p - base) / base) * 100);
      return { coin, color: SERIES_COLORS[idx % SERIES_COLORS.length], rets };
    });

    let minR = -2;
    let maxR = 2;
    for (const s of seriesList) {
      for (const r of s.rets) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
      }
    }
    const pad = Math.max((maxR - minR) * 0.15, 0.5);
    return { seriesList, minR: minR - pad, maxR: maxR + pad };
  }, [tvCoins]);

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const progressPct = Math.round(((secondsPerPanel - secondsLeft) / secondsPerPanel) * 100);

  return (
    <div
      onMouseMove={revealControls}
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-background text-foreground ${
        largeText ? 'text-base' : 'text-sm'
      }`}
    >
      {/* TV Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-nav px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent font-mono text-xs font-semibold text-accent-foreground">
            LC
          </span>
          <span className="text-sm font-semibold tracking-tight">LCT / LIVE CRYPTO TRACKER</span>
          <span className="rounded border border-accent/40 bg-accent/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
            MODO TV
          </span>
        </div>

        <div className="flex items-center gap-5 font-mono text-xs tabular-nums">
          <span className={isError ? 'text-warning' : 'text-positive'}>
            {isError
              ? `Dados de ${fetchedAt ? formatTime(fetchedAt, preferences.timezone) : '--:--'}`
              : `AO VIVO · ${fetchedAt ? formatTime(fetchedAt, preferences.timezone) : '--:--:--'}`}
          </span>
          <span className="text-muted-foreground">
            {formatTime(nowTs, preferences.timezone)}
          </span>
        </div>
      </header>

      {/* Main TV Canvas */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5">
        {currentPanel === 'market' ? (
          /* Tela 1 · Mercado */
          <div className="flex min-h-0 flex-1 flex-col gap-5">
            <div className="flex items-baseline justify-between">
              <h1 className={largeText ? 'text-2xl font-semibold' : 'text-xl font-semibold'}>
                Mercado em 24 horas
              </h1>
              <span className="font-mono text-xs text-muted-foreground">
                {watchlist.length >= 2 ? 'Favoritos' : 'Top cap'} / {tvCoins.length} ativos / USD
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-md border border-border bg-card p-4 shadow-card">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Retorno da carteira
                </p>
                <p
                  className={`mt-1.5 font-semibold tabular-nums ${
                    largeText ? 'text-3xl' : 'text-2xl'
                  } ${portfolioReturn >= 0 ? 'text-positive' : 'text-negative'}`}
                >
                  {formatPercent(portfolioReturn, preferences.numberLocale)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Ponderada por capitalização</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4 shadow-card">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Volume negociado
                </p>
                <p className={`mt-1.5 font-semibold tabular-nums ${largeText ? 'text-3xl' : 'text-2xl'}`}>
                  US$ {formatCompactNumber(totalVolume, preferences.numberLocale)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Últimas 24 horas</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4 shadow-card">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ativos em alta
                </p>
                <p className={`mt-1.5 font-semibold tabular-nums ${largeText ? 'text-3xl' : 'text-2xl'}`}>
                  {upCoins.length} de {tvCoins.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{downCoins.length} em queda</p>
              </div>
              <div className="rounded-md border border-border bg-card p-4 shadow-card">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Dominância BTC
                </p>
                <p className={`mt-1.5 font-semibold tabular-nums ${largeText ? 'text-3xl' : 'text-2xl'}`}>
                  {btcDom.toFixed(1).replace('.', ',')}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Neste universo</p>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              {/* 24h Performance SVG with Inline End-of-Line Labels */}
              <div className="flex min-h-0 flex-col rounded-md border border-border bg-card p-4 shadow-card">
                <p className="mb-2 text-xs font-semibold text-foreground">
                  Desempenho acumulado nas últimas 24 horas
                </p>
                <div className="relative min-h-0 flex-1">
                  <svg viewBox="0 0 760 280" className="h-full w-full overflow-visible">
                    {(() => {
                      const W = 640;
                      const H = 240;
                      const span = marketChart.maxR - marketChart.minR || 1;
                      const toY = (v: number) => 16 + ((marketChart.maxR - v) / span) * H;
                      const zeroY = toY(0);
                      return (
                        <>
                          <line
                            x1="0"
                            y1={zeroY}
                            x2={W}
                            y2={zeroY}
                            stroke="hsl(var(--border))"
                            strokeDasharray="4 4"
                          />
                          {marketChart.seriesList.map((s) => {
                            if (s.rets.length < 2) return null;
                            const pts = s.rets
                              .map((r, i) => {
                                const x = (i / (s.rets.length - 1)) * W;
                                const y = toY(r);
                                return `${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' ');
                            const lastR = s.rets[s.rets.length - 1];
                            const lastY = toY(lastR);
                            return (
                              <g key={s.coin.id}>
                                <polyline
                                  fill="none"
                                  stroke={s.color}
                                  strokeWidth={2.2}
                                  points={pts}
                                />
                                <circle cx={W} cy={lastY} r={3.5} fill={s.color} />
                                <text
                                  x={W + 8}
                                  y={lastY + 4}
                                  fill={s.color}
                                  fontSize="12"
                                  fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
                                  fontWeight="600"
                                >
                                  {s.coin.symbol.toUpperCase()} {formatPercent(lastR, preferences.numberLocale)}
                                </text>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>

              {/* Quotes Table */}
              <div className="flex min-h-0 flex-col rounded-md border border-border bg-card p-4 shadow-card">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Cotações</span>
                  <span className="font-mono">USD · 24h</span>
                </div>
                <div className="flex-1 divide-y divide-border overflow-y-auto tabular-nums">
                  {tvCoins.map((coin) => (
                    <div key={coin.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {coin.symbol.toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">{coin.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {formatPrice(coin.currentPrice, fmtOpts)}
                        </p>
                        <p
                          className={`font-mono text-xs font-medium ${
                            coin.priceChange24h >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : currentPanel === 'participation' ? (
          /* Tela 2 · Participação */
          <div className="flex min-h-0 flex-1 flex-col gap-5">
            <div className="flex items-baseline justify-between">
              <div>
                <h1 className={largeText ? 'text-2xl font-semibold' : 'text-xl font-semibold'}>
                  Participação no movimento
                </h1>
                {topDriver ? (
                  <p className="mt-1 text-sm text-accent">
                    {topDriver.coin.symbol.toUpperCase()} respondeu por{' '}
                    {topDriver.contribPp >= 0 ? '+' : '−'}
                    {Math.abs(topDriver.contribPp).toFixed(2).replace('.', ',')} p.p. de um retorno
                    de {formatPercent(portfolioReturn, preferences.numberLocale)}
                  </p>
                ) : null}
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {tvCoins.length} ativos / 24h
              </span>
            </div>

            <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-2">
              {/* Flat 2D Treemap */}
              <div className="flex flex-col rounded-md border border-border bg-card p-4 shadow-card">
                <p className="mb-3 text-xs font-semibold text-foreground">
                  Composição por capitalização
                </p>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {tvCoins.map((coin, idx) => {
                    const pct = (coin.marketCap / totalCap) * 100;
                    return (
                      <div
                        key={coin.id}
                        style={{
                          flexGrow: Math.max(Math.round(pct * 10), 8),
                          flexBasis: `${Math.min(Math.max(pct * 2.4, 90), 300)}px`,
                          borderColor: SERIES_COLORS[idx % SERIES_COLORS.length],
                        }}
                        className="flex min-h-[72px] flex-col justify-between rounded border bg-background p-3"
                      >
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {coin.symbol.toUpperCase()}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {pct.toFixed(1).replace('.', ',')}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Diverging Contribution Bars */}
              <div className="flex flex-col justify-between rounded-md border border-border bg-card p-4 shadow-card">
                <div>
                  <p className="mb-3 text-xs font-semibold text-foreground">
                    Contribuição para o retorno (peso inicial × retorno)
                  </p>
                  <div className="space-y-3">
                    {contributions.map((c) => {
                      const pctW = Math.max((Math.abs(c.contribPp) / maxAbsContrib) * 100, 3);
                      const isPos = c.contribPp >= 0;
                      return (
                        <div
                          key={c.coin.id}
                          className="grid grid-cols-[56px_1fr_84px] items-center gap-3"
                        >
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {c.coin.symbol.toUpperCase()}
                          </span>
                          <div className="grid grid-cols-2 items-center">
                            <div className="flex justify-end border-r border-border pr-0.5">
                              {!isPos ? (
                                <div
                                  className="h-4 rounded-l-sm bg-negative/80"
                                  style={{ width: `${pctW}%` }}
                                />
                              ) : null}
                            </div>
                            <div className="flex justify-start pl-0.5">
                              {isPos ? (
                                <div
                                  className="h-4 rounded-r-sm bg-positive/80"
                                  style={{ width: `${pctW}%` }}
                                />
                              ) : null}
                            </div>
                          </div>
                          <span
                            className={`text-right font-mono text-xs font-semibold tabular-nums ${
                              isPos ? 'text-positive' : 'text-negative'
                            }`}
                          >
                            {isPos ? '+' : '−'}
                            {Math.abs(c.contribPp).toFixed(2).replace('.', ',')} p.p.
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm tabular-nums">
                  <span className="text-muted-foreground">Retorno da carteira</span>
                  <span
                    className={`font-mono font-semibold ${
                      portfolioReturn >= 0 ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {formatPercent(portfolioReturn, preferences.numberLocale)}
                  </span>
                </div>
              </div>
            </div>

            {/* Full-width Breadth Bar */}
            <div className="rounded-md border border-border bg-card p-3.5 shadow-card">
              <div className="flex h-6 w-full overflow-hidden rounded font-mono text-[11px] font-semibold">
                <div
                  className="flex items-center justify-center bg-positive/25 text-positive"
                  style={{ width: `${(upCoins.length / Math.max(tvCoins.length, 1)) * 100}%` }}
                >
                  {upCoins.length} EM ALTA
                </div>
                <div
                  className="flex items-center justify-center bg-negative/25 text-negative"
                  style={{ width: `${(downCoins.length / Math.max(tvCoins.length, 1)) * 100}%` }}
                >
                  {downCoins.length} EM QUEDA
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Tela 3 · Risco */
          <div className="flex min-h-0 flex-1 flex-col gap-5">
            <div className="flex items-baseline justify-between">
              <h1 className={largeText ? 'text-2xl font-semibold' : 'text-xl font-semibold'}>
                Risco e dispersão
              </h1>
              <span className="font-mono text-xs text-muted-foreground">
                Retornos diários / últimos 90 dias
              </span>
            </div>

            <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              {/* Shared-Scale Horizontal Boxplot */}
              <div className="flex flex-col justify-between rounded-md border border-border bg-card p-4 shadow-card">
                <div>
                  <p className="mb-3 text-xs font-semibold text-foreground">
                    Distribuição dos retornos diários
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-[56px_1fr] gap-3 font-mono text-[11px] text-muted-foreground">
                      <span />
                      <div className="flex justify-between border-b border-border pb-1 tabular-nums">
                        <span>{riskData.minScale}%</span>
                        <span>{riskData.minScale / 2}%</span>
                        <span>0%</span>
                        <span>+{riskData.maxScale / 2}%</span>
                        <span>+{riskData.maxScale}%</span>
                      </div>
                    </div>

                    {riskData.items.map(({ coin, stats }) => {
                      const span = riskData.maxScale - riskData.minScale || 1;
                      const toPct = (v: number) => ((v - riskData.minScale) / span) * 100;
                      return (
                        <div
                          key={coin.id}
                          className="grid grid-cols-[56px_1fr] items-center gap-3"
                        >
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {coin.symbol.toUpperCase()}
                          </span>
                          <div className="relative h-7">
                            <div
                              className="absolute bottom-0 top-0 w-px bg-border"
                              style={{ left: `${toPct(0)}%` }}
                            />
                            <div
                              className="absolute top-1/2 h-px -translate-y-1/2 bg-muted-foreground/60"
                              style={{
                                left: `${toPct(stats.min)}%`,
                                width: `${Math.max(toPct(stats.max) - toPct(stats.min), 1)}%`,
                              }}
                            />
                            <div
                              className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm border border-accent bg-accent/25"
                              style={{
                                left: `${toPct(stats.q1)}%`,
                                width: `${Math.max(toPct(stats.q3) - toPct(stats.q1), 1.5)}%`,
                              }}
                            />
                            <div
                              className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-foreground"
                              style={{ left: `${toPct(stats.median)}%` }}
                            />
                            {stats.points
                              .filter((p) => p.isOutlier)
                              .map((p) => (
                                <span
                                  key={p.dayKey}
                                  style={{ left: `${toPct(p.ret)}%` }}
                                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warning"
                                />
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
                  Pontos em âmbar = dias extremos · Caixa = 50% centrais (Q1–Q3) · Traço vertical =
                  mediana
                </p>
              </div>

              {/* Extreme Drop Context Callout */}
              <div className="flex flex-col justify-between rounded-md border border-border bg-card p-4 shadow-card">
                {riskData.worstDrop ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Maior queda diária (90d)
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold text-foreground">
                        {riskData.worstDrop.coin.symbol.toUpperCase()}
                      </p>
                      <p className="font-mono text-2xl font-semibold tabular-nums text-negative">
                        {formatPercent(riskData.worstDrop.ret, preferences.numberLocale)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(riskData.worstDrop.timestamp, preferences.timezone)}
                      </p>
                    </div>

                    <div className="space-y-1.5 border-t border-border pt-3 text-xs tabular-nums">
                      <p className="font-medium text-muted-foreground">No mesmo dia</p>
                      {riskData.worstDrop.btcRet !== undefined ? (
                        <div className="flex justify-between">
                          <span className="font-mono">BTC</span>
                          <span className="font-mono">
                            {formatPercent(riskData.worstDrop.btcRet, preferences.numberLocale)}
                          </span>
                        </div>
                      ) : null}
                      {riskData.worstDrop.ethRet !== undefined ? (
                        <div className="flex justify-between">
                          <span className="font-mono">ETH</span>
                          <span className="font-mono">
                            {formatPercent(riskData.worstDrop.ethRet, preferences.numberLocale)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {riskData.widestIqr ? (
                  <div className="border-t border-border pt-3 text-xs">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Maior dispersão típica
                    </p>
                    <p className="mt-1 font-mono text-base font-semibold text-accent">
                      {riskData.widestIqr.coin.symbol.toUpperCase()}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      A caixa cobre os 50% centrais dos retornos diários.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* TV Footer */}
      <footer className="relative shrink-0 border-t border-border bg-nav px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              PAINEL
            </span>
            {activePanels.map((pId, idx) => (
              <button
                key={pId}
                type="button"
                onClick={() => {
                  setActiveIndex(idx);
                  setSecondsLeft(secondsPerPanel);
                }}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  idx === safeIndex
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {idx + 1} {PANEL_LABELS[pId]}
              </button>
            ))}
          </div>

          <span className="font-mono tabular-nums text-muted-foreground">
            {paused
              ? 'Rotação pausada (Espaço para retomar)'
              : activePanels.length > 1
                ? `Próximo: ${PANEL_LABELS[nextPanel]} em ${secondsLeft} s`
                : 'Painel único'}
          </span>
        </div>

        <div className="mt-2 h-0.5 w-full overflow-hidden rounded bg-border">
          <div
            className="h-full bg-accent transition-[width] duration-500"
            style={{ width: `${paused ? 0 : progressPct}%` }}
          />
        </div>
      </footer>

      {/* Floating Controls (appear on mouse move or keyboard) */}
      {controlsVisible ? (
        <div className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-overlay">
          <button
            type="button"
            onClick={() => goStep(-1)}
            className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-foreground hover:bg-muted"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Anterior</span>
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex h-7 items-center gap-1 rounded bg-accent px-2.5 font-semibold text-accent-foreground hover:opacity-90"
          >
            {paused ? (
              <>
                <Play className="h-3 w-3" aria-hidden="true" />
                <span>Retomar</span>
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" aria-hidden="true" />
                <span>Pausar</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => goStep(1)}
            className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-foreground hover:bg-muted"
          >
            <span>Próximo</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-foreground hover:bg-muted"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ajustes</span>
          </button>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sair</span>
          </button>
        </div>
      ) : null}

      {/* TV Settings Modal */}
      {settingsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Ajustes do Modo TV"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-md border border-border bg-card p-4 text-xs shadow-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-sm font-semibold text-foreground">Ajustes do Modo TV</h2>

            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-muted-foreground">Painéis da rotação</p>
                <div className="flex flex-wrap gap-2">
                  {(['market', 'participation', 'risk'] as const).map((id) => (
                    <label
                      key={id}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-border bg-background px-2.5 py-1.5"
                    >
                      <input
                        type="checkbox"
                        checked={enabledPanels[id]}
                        onChange={(e) =>
                          setEnabledPanels((prev) => ({ ...prev, [id]: e.target.checked }))
                        }
                        className="accent-accent"
                      />
                      <span>{PANEL_LABELS[id]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="tv-sec" className="text-foreground">
                  Tempo por painel
                </label>
                <select
                  id="tv-sec"
                  value={secondsPerPanel}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSecondsPerPanel(v);
                    setSecondsLeft(v);
                  }}
                  className="h-8 rounded border border-border bg-background px-2 text-foreground"
                >
                  <option value={10}>10 segundos</option>
                  <option value={20}>20 segundos</option>
                  <option value={30}>30 segundos</option>
                  <option value={60}>60 segundos</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-foreground">Tamanho do texto</span>
                <div className="inline-flex rounded border border-border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setLargeText(false)}
                    className={`rounded px-2.5 py-1 ${
                      !largeText ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setLargeText(true)}
                    className={`rounded px-2.5 py-1 ${
                      largeText ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Ampliado
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="h-8 rounded bg-accent px-3 font-semibold text-accent-foreground hover:opacity-90"
              >
                Aplicar e voltar à TV
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
