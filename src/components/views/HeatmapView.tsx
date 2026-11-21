import { useEffect, useMemo, useRef, useState } from 'react';
import { Table } from 'lucide-react';
import type { CoinMarket, CustomList } from '../../types/crypto';
import { isStablecoin } from '../../lib/market';
import { formatCompactNumber, formatPercent } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { QuickInspector } from '../panels/QuickInspector';
import { PageHeader, HeaderButton, HeaderCheckboxPill, HeaderSelect } from '../shell/PageHeader';

interface HeatmapViewProps {
  coins: CoinMarket[];
  fetchedAt?: number;
  watchlistSet: Set<string>;
  customLists: CustomList[];
  onToggleFavorite: (coinId: string) => void;
  onOpenAsset: (coinId: string) => void;
}

function getHeatmapBg(change24h: number): string {
  if (change24h >= 10) {
    return 'bg-[#16A34A] text-white border-[#4ADE80]/35 hover:bg-[#22C55E]';
  }
  if (change24h >= 4) {
    return 'bg-[#15803D] text-white border-[#34D399]/30 hover:bg-[#16A34A]';
  }
  if (change24h > 0.25) {
    return 'bg-[#065F46] text-emerald-50 border-[#10B981]/30 hover:bg-[#047857]';
  }
  if (change24h <= -10) {
    return 'bg-[#E11D48] text-white border-[#FDA4AF]/35 hover:bg-[#F43F5E]';
  }
  if (change24h <= -4) {
    return 'bg-[#BE123C] text-white border-[#FB7185]/30 hover:bg-[#E11D48]';
  }
  if (change24h < -0.25) {
    return 'bg-[#881337] text-rose-50 border-[#F43F5E]/30 hover:bg-[#9F1239]';
  }
  return 'bg-[#334155] text-slate-100 border-slate-400/25 hover:bg-[#3E4E66] dark:bg-[#1E293B] dark:border-slate-600/45 dark:hover:bg-[#27354A]';
}

function getChangeBadgeClass(change24h: number): string {
  if (change24h > 0.25) return 'bg-black/20 text-white border border-white/15';
  if (change24h < -0.25) return 'bg-black/20 text-white border border-white/15';
  return 'bg-black/20 text-slate-100 border border-white/15';
}

interface TreemapInputItem {
  id: string;
  weight: number;
  coin?: CoinMarket;
  othersCount?: number;
}

interface TreemapRect {
  item: TreemapInputItem;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

function worstAspectRatio(row: number[], shortSide: number): number {
  if (row.length === 0 || shortSide <= 0) return Infinity;
  const sum = row.reduce((a, b) => a + b, 0);
  if (sum <= 0) return Infinity;
  let max = 0;
  let min = Infinity;
  for (const v of row) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  const s2 = shortSide * shortSide;
  const sum2 = sum * sum;
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
}

function computeSquarifiedTreemap(
  items: TreemapInputItem[],
  width = 160,
  height = 90
): TreemapRect[] {
  const positive = items.filter((i) => i.weight > 0);
  if (positive.length === 0) return [];

  const totalArea = width * height;
  const totalWeight = positive.reduce((s, i) => s + i.weight, 0);
  const scaled = positive.map((item) => ({
    item,
    area: (item.weight / totalWeight) * totalArea,
  }));

  const rects: TreemapRect[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;

  const commitRow = (row: typeof scaled) => {
    const rowSum = row.reduce((s, r) => s + r.area, 0);
    if (rowSum <= 0) return;
    if (w >= h) {
      const rowW = rowSum / h;
      let cy = y;
      for (const r of row) {
        const rh = r.area / rowW;
        rects.push({
          item: r.item,
          xPct: (x / width) * 100,
          yPct: (cy / height) * 100,
          wPct: (rowW / width) * 100,
          hPct: (rh / height) * 100,
        });
        cy += rh;
      }
      x += rowW;
      w = Math.max(0, w - rowW);
    } else {
      const rowH = rowSum / w;
      let cx = x;
      for (const r of row) {
        const rw = r.area / rowH;
        rects.push({
          item: r.item,
          xPct: (cx / width) * 100,
          yPct: (y / height) * 100,
          wPct: (rw / width) * 100,
          hPct: (rowH / height) * 100,
        });
        cx += rw;
      }
      y += rowH;
      h = Math.max(0, h - rowH);
    }
  };

  let row: typeof scaled = [];
  for (const entry of scaled) {
    const shortSide = Math.min(w, h);
    if (row.length === 0) {
      row.push(entry);
      continue;
    }
    const currentWorst = worstAspectRatio(
      row.map((r) => r.area),
      shortSide
    );
    const nextWorst = worstAspectRatio(
      [...row.map((r) => r.area), entry.area],
      shortSide
    );
    if (nextWorst <= currentWorst) {
      row.push(entry);
    } else {
      commitRow(row);
      row = [entry];
    }
  }
  if (row.length > 0) {
    commitRow(row);
  }

  return rects;
}

export function HeatmapView({
  coins,
  fetchedAt,
  watchlistSet,
  customLists,
  onToggleFavorite,
  onOpenAsset,
}: HeatmapViewProps) {
  const { preferences } = usePreferences();
  const [universe, setUniverse] = useState<string>('all');
  const [sizeBy, setSizeBy] = useState<'marketCap' | 'volume'>('marketCap');
  const [excludeStables, setExcludeStables] = useState(false);
  const [tableMode, setTableMode] = useState(false);
  const [othersExpanded, setOthersExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const treemapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tableMode) return;
    const container = treemapRef.current;
    if (!container) return;

    const reduceMotion =
      preferences.reduceMotion === 'reduce' ||
      (preferences.reduceMotion === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (reduceMotion) return;

    const tiles = container.querySelectorAll<HTMLElement>('[data-treemap-tile]');
    const anims: Animation[] = [];
    tiles.forEach((tile, idx) => {
      if (typeof tile.animate === 'function') {
        anims.push(
          tile.animate(
            [
              { opacity: 0, transform: 'scale(0.92)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            {
              duration: 340,
              delay: Math.min(idx * 10, 260),
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              fill: 'both',
            }
          )
        );
      }
    });

    return () => anims.forEach((a) => a.cancel());
  }, [excludeStables, othersExpanded, preferences.reduceMotion, sizeBy, tableMode, universe]);

  const scopedCoins = useMemo(() => {
    return coins
      .filter((coin) => {
        if (excludeStables && isStablecoin(coin)) return false;
        if (universe === 'favorites') return watchlistSet.has(coin.id);
        if (universe !== 'all') {
          const list = customLists.find((l) => l.id === universe);
          return list ? list.coinIds.includes(coin.id) : true;
        }
        return true;
      })
      .sort((a, b) =>
        sizeBy === 'marketCap' ? b.marketCap - a.marketCap : b.totalVolume - a.totalVolume
      );
  }, [coins, customLists, excludeStables, sizeBy, universe, watchlistSet]);

  const totalWeight = useMemo(
    () =>
      scopedCoins.reduce(
        (sum, c) => sum + Math.max(sizeBy === 'marketCap' ? c.marketCap : c.totalVolume, 1),
        0
      ) || 1,
    [scopedCoins, sizeBy]
  );

  const selectedCoin = useMemo(
    () => scopedCoins.find((c) => c.id === selectedId) ?? null,
    [scopedCoins, selectedId]
  );

  const treemapRects = useMemo(() => {
    if (tableMode || scopedCoins.length === 0) return [];
    const limit = othersExpanded ? 120 : 45;
    const primary = scopedCoins.slice(0, limit);
    const rest = scopedCoins.slice(limit);

    const items: TreemapInputItem[] = primary.map((coin) => ({
      id: coin.id,
      weight: Math.max(sizeBy === 'marketCap' ? coin.marketCap : coin.totalVolume, 1),
      coin,
    }));

    if (rest.length > 0) {
      const restWeight = rest.reduce(
        (sum, c) => sum + Math.max(sizeBy === 'marketCap' ? c.marketCap : c.totalVolume, 1),
        0
      );
      items.push({
        id: '__others__',
        weight: restWeight,
        othersCount: rest.length,
      });
    }

    return computeSquarifiedTreemap(items);
  }, [othersExpanded, scopedCoins, sizeBy, tableMode]);

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PageHeader
          title="Mapa de mercado"
          subtitle={`Universo: ${scopedCoins.length} ativos · Área por ${sizeBy === 'marketCap' ? 'capitalização' : 'volume 24h'}`}
          actions={
            <>
              <HeaderSelect
                aria-label="Universo do mapa"
                value={universe}
                onChange={(e) => setUniverse(e.target.value)}
              >
                <option value="all">Todos os ativos</option>
                <option value="favorites">Favoritos ({watchlistSet.size})</option>
                {customLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.coinIds.length})
                  </option>
                ))}
              </HeaderSelect>

              <HeaderSelect
                aria-label="Dimensionar blocos por"
                value={sizeBy}
                onChange={(e) => setSizeBy(e.target.value as 'marketCap' | 'volume')}
              >
                <option value="marketCap">Área: Capitalização</option>
                <option value="volume">Área: Volume 24h</option>
              </HeaderSelect>

              <HeaderCheckboxPill
                checked={excludeStables}
                onChange={setExcludeStables}
                label="Excluir estáveis"
              />

              <HeaderButton
                variant="toggle"
                active={tableMode}
                onClick={() => setTableMode((prev) => !prev)}
                aria-pressed={tableMode}
              >
                <Table className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tabela</span>
              </HeaderButton>
            </>
          }
        />

        <div className={tableMode ? 'flex-1 overflow-auto px-5 py-4 lg:px-6' : 'flex-1 overflow-hidden px-5 py-3 lg:px-6'}>
          {scopedCoins.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-md border border-border bg-card text-xs text-muted-foreground">
              Nenhum ativo disponível para este universo.
            </div>
          ) : tableMode ? (
            <div className="overflow-hidden rounded border border-border bg-card">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-border bg-nav text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Ativo</th>
                    <th className="px-3 py-2 text-right">Participação</th>
                    <th className="px-3 py-2 text-right">
                      {sizeBy === 'marketCap' ? 'Cap. USD' : 'Volume 24h'}
                    </th>
                    <th className="px-3 py-2 text-right">Variação 24h</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {scopedCoins.map((coin) => {
                    const weight = sizeBy === 'marketCap' ? coin.marketCap : coin.totalVolume;
                    const share = (weight / totalWeight) * 100;
                    return (
                      <tr
                        key={coin.id}
                        onClick={() => setSelectedId(coin.id)}
                        className="cursor-pointer hover:bg-muted/40"
                      >
                        <td className="px-3 py-2">
                          <span className="font-mono text-[11px] font-semibold text-accent">
                            {coin.symbol.toUpperCase()}
                          </span>{' '}
                          <span className="text-foreground">{coin.name}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {share.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-right text-foreground">
                          US$ {formatCompactNumber(weight, preferences.numberLocale)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            coin.priceChange24h > 0
                              ? 'text-positive'
                              : coin.priceChange24h < 0
                                ? 'text-negative'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="relative h-full w-full overflow-hidden rounded-lg border border-border/80 bg-nav/40 p-[2px]">
              <div ref={treemapRef} className="relative h-full w-full">
              {treemapRects.map((rect) => {
                const { item, xPct, yPct, wPct, hPct } = rect;
                const isHero = wPct >= 28 && hPct >= 34;
                const isLarge = wPct >= 13 && hPct >= 15;
                const isMedium = wPct >= 6.5 && hPct >= 8.5;
                const isCompact = wPct >= 3.2 && hPct >= 4.5;

                if (!item.coin) {
                  return (
                    <div
                      key={item.id}
                      data-treemap-tile
                      style={{
                        left: `${xPct}%`,
                        top: `${yPct}%`,
                        width: `${wPct}%`,
                        height: `${hPct}%`,
                      }}
                      className="absolute p-[2px]"
                    >
                      <button
                        type="button"
                        onClick={() => setOthersExpanded(true)}
                        title={`Outros ${item.othersCount} ativos · US$ ${formatCompactNumber(item.weight, preferences.numberLocale)}`}
                        className="flex h-full w-full flex-col justify-between overflow-hidden rounded-[6px] border border-dashed border-border bg-card/90 p-2.5 text-left text-foreground shadow-sm transition-all hover:border-accent/60 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate text-xs font-semibold">Outros ativos</span>
                          <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
                            +{item.othersCount}
                          </span>
                        </div>
                        {isMedium ? (
                          <div>
                            <p className="truncate text-[11px] text-muted-foreground">
                              Clique para expandir
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-foreground/85">
                              US$ {formatCompactNumber(item.weight, preferences.numberLocale)}
                            </p>
                          </div>
                        ) : null}
                      </button>
                    </div>
                  );
                }

                const coin = item.coin;
                const isSelected = coin.id === selectedId;
                const sharePct = (item.weight / totalWeight) * 100;

                return (
                  <div
                    key={coin.id}
                    data-treemap-tile
                    style={{
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      width: `${wPct}%`,
                      height: `${hPct}%`,
                    }}
                    className="absolute p-[2px]"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(coin.id)}
                      title={`${coin.name} (${coin.symbol.toUpperCase()}) · ${formatPercent(coin.priceChange24h, preferences.numberLocale)} · US$ ${formatCompactNumber(item.weight, preferences.numberLocale)} (${sharePct.toFixed(1)}%)`}
                      className={`group flex h-full w-full flex-col justify-between overflow-hidden rounded-[6px] border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        isHero ? 'p-4' : isLarge ? 'p-3' : isMedium ? 'p-2' : 'p-1'
                      } ${
                        isSelected
                          ? 'ring-2 ring-accent ring-offset-1 ring-offset-background'
                          : ''
                      } ${getHeatmapBg(coin.priceChange24h)}`}
                    >
                      {isHero ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <img
                                src={coin.image}
                                alt=""
                                width={28}
                                height={28}
                                loading="lazy"
                                className="h-7 w-7 shrink-0 rounded-full bg-black/20 object-cover ring-1 ring-white/25"
                              />
                              <div className="min-w-0">
                                <span className="block font-mono text-base font-bold leading-tight tracking-tight text-white">
                                  {coin.symbol.toUpperCase()}
                                </span>
                                <span className="block truncate text-xs text-white/80">
                                  {coin.name}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 rounded-md px-2 py-1 font-mono text-sm font-bold tabular-nums ${getChangeBadgeClass(coin.priceChange24h)}`}
                            >
                              {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                            </span>
                          </div>

                          <div className="flex items-end justify-between gap-2 border-t border-white/15 pt-2.5 tabular-nums">
                            <div>
                              <span className="block text-[10px] uppercase tracking-wider text-white/70">
                                {sizeBy === 'marketCap' ? 'Capitalização' : 'Volume 24h'}
                              </span>
                              <span className="font-mono text-sm font-semibold text-white">
                                US$ {formatCompactNumber(item.weight, preferences.numberLocale)}
                              </span>
                            </div>
                            <span className="rounded bg-black/20 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                              {sharePct.toFixed(1)}%
                            </span>
                          </div>
                        </>
                      ) : isLarge ? (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <img
                                src={coin.image}
                                alt=""
                                width={20}
                                height={20}
                                loading="lazy"
                                className="h-5 w-5 shrink-0 rounded-full bg-black/20 object-cover ring-1 ring-white/25"
                              />
                              <div className="min-w-0">
                                <span className="block font-mono text-xs font-bold leading-tight text-white">
                                  {coin.symbol.toUpperCase()}
                                </span>
                                <span className="block truncate text-[11px] text-white/80">
                                  {coin.name}
                                </span>
                              </div>
                            </div>
                            <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-white">
                              {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                            </span>
                          </div>
                          <div className="flex items-end justify-between gap-2 text-[11px] tabular-nums text-white/80">
                            <span className="font-mono text-white/95">
                              US$ {formatCompactNumber(item.weight, preferences.numberLocale)}
                            </span>
                            <span className="font-mono">{sharePct.toFixed(1)}%</span>
                          </div>
                        </>
                      ) : isMedium ? (
                        <>
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate font-mono text-xs font-bold text-white">
                              {coin.symbol.toUpperCase()}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-white">
                              {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                            </span>
                          </div>
                          <span className="truncate font-mono text-[10px] tabular-nums text-white/80">
                            US$ {formatCompactNumber(item.weight, preferences.numberLocale)}
                          </span>
                        </>
                      ) : isCompact ? (
                        <div className="flex h-full w-full flex-col items-center justify-center px-0.5 text-center">
                          <span className="w-full truncate font-mono text-[10px] font-bold leading-tight text-white">
                            {coin.symbol.toUpperCase()}
                          </span>
                          <span className="w-full truncate font-mono text-[9px] font-medium tabular-nums leading-tight text-white/90">
                            {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                          </span>
                        </div>
                      ) : null}
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        <footer className="flex min-h-[36px] shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-nav px-5 py-2 text-[11px] leading-none text-muted-foreground lg:px-6">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <span className="font-medium text-muted-foreground">Variação 24h:</span>
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#E11D48] ring-1 ring-inset ring-white/15" />
                <span>&lt; −10%</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#881337] ring-1 ring-inset ring-white/15" />
                <span>−4%</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#334155] ring-1 ring-inset ring-white/15 dark:bg-[#1E293B]" />
                <span>0%</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#065F46] ring-1 ring-inset ring-white/15" />
                <span>+4%</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#16A34A] ring-1 ring-inset ring-white/15" />
                <span>&gt; +10%</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {othersExpanded && scopedCoins.length > 45 ? (
              <button
                type="button"
                onClick={() => setOthersExpanded(false)}
                className="font-medium text-accent hover:underline"
              >
                Recolher para Top 45
              </button>
            ) : null}
            <span>Clique em um bloco para inspecionar</span>
          </div>
        </footer>
      </div>

      {selectedCoin ? (
        <div className="fixed inset-0 z-40 flex justify-end overflow-hidden bg-black/50 lg:pointer-events-none lg:absolute lg:inset-y-0 lg:right-0 lg:left-auto lg:bg-transparent lg:pl-8">
          <div className="pointer-events-auto h-full w-full lg:w-auto">
            <QuickInspector
              coin={selectedCoin}
              favorite={watchlistSet.has(selectedCoin.id)}
              fetchedAt={fetchedAt}
              onToggleFavorite={onToggleFavorite}
              onOpenAsset={onOpenAsset}
              onClose={() => setSelectedId(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
