import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { CoinMarket } from '../../types/crypto';
import { isStablecoin } from '../../lib/market';
import { formatCompactNumber, formatPercent } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { ChartCardHeader } from './ChartCard';

type CategoryId = 'btc' | 'eth' | 'stables' | 'alts';

interface CategoryMeta {
  id: CategoryId;
  label: string;
  color: string;
  depthColor: string;
}

const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  btc: { id: 'btc', label: 'Bitcoin', color: '#F59E0B', depthColor: '#92400E' },
  eth: { id: 'eth', label: 'Ethereum', color: '#818CF8', depthColor: '#3730A3' },
  stables: { id: 'stables', label: 'Stablecoins', color: '#2DD4BF', depthColor: '#115E59' },
  alts: { id: 'alts', label: 'Altcoins', color: '#38BDF8', depthColor: '#075985' },
};

const ASSET_PALETTE = [
  '#60A5FA',
  '#34D399',
  '#A78BFA',
  '#F472B6',
  '#FBBF24',
  '#2DD4BF',
  '#38BDF8',
  '#FB7185',
];

interface ArcSegment {
  id: string;
  label: string;
  symbol?: string;
  categoryId: CategoryId;
  value: number;
  pct: number;
  change24h: number;
  startAngle: number;
  endAngle: number;
  color: string;
  depthColor: string;
  coinId?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeRingArc(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const safeEnd = endAngle - startAngle >= 359.99 ? startAngle + 359.95 : endAngle;
  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, safeEnd);
  const p3 = polarToCartesian(cx, cy, innerR, safeEnd);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = safeEnd - startAngle > 180 ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function classifyCoin(coin: CoinMarket): CategoryId {
  const sym = coin.symbol.toLowerCase();
  if (coin.id === 'bitcoin' || sym === 'btc') return 'btc';
  if (coin.id === 'ethereum' || sym === 'eth') return 'eth';
  if (isStablecoin(coin)) return 'stables';
  return 'alts';
}

function getAssetSliceColor(coin: CoinMarket, idx: number): { color: string; depthColor: string } {
  if (coin.priceChange24h >= 4) return { color: '#34D399', depthColor: '#065F46' };
  if (coin.priceChange24h <= -4) return { color: '#FB7185', depthColor: '#9F1239' };
  const base = ASSET_PALETTE[idx % ASSET_PALETTE.length];
  return { color: base, depthColor: '#1E293B' };
}

export function Interactive3DSunburst({
  coins,
  onOpenAsset,
}: {
  coins: CoinMarket[];
  onOpenAsset: (coinId: string) => void;
}) {
  const { preferences } = usePreferences();
  const [zoomCategory, setZoomCategory] = useState<CategoryId | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tilt, setTilt] = useState({ x: 32, y: -10 });
  const ringsRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ringsRef.current;
    if (!el || typeof el.animate !== 'function') return;
    const reduceMotion =
      preferences.reduceMotion === 'reduce' ||
      (preferences.reduceMotion === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduceMotion) return;

    const anim = el.animate(
      [
        { opacity: 0.2, transform: 'translateZ(6px) scale(0.82) rotate(-24deg)' },
        { opacity: 1, transform: 'translateZ(6px) scale(1) rotate(0deg)' },
      ],
      { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
    return () => anim.cancel();
  }, [coins.length, preferences.reduceMotion, zoomCategory]);

  const reduceMotion =
    preferences.reduceMotion === 'reduce' ||
    (preferences.reduceMotion === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const { innerSegments, outerSegments, totalValue } = useMemo(() => {
    const grouped: Record<CategoryId, CoinMarket[]> = {
      btc: [],
      eth: [],
      stables: [],
      alts: [],
    };

    for (const coin of coins) {
      if (coin.marketCap <= 0) continue;
      grouped[classifyCoin(coin)].push(coin);
    }

    for (const key of Object.keys(grouped) as CategoryId[]) {
      grouped[key].sort((a, b) => b.marketCap - a.marketCap);
    }

    const activeCategories = (['btc', 'eth', 'stables', 'alts'] as CategoryId[])
      .filter((id) => !zoomCategory || zoomCategory === id)
      .filter((id) => grouped[id].length > 0);

    const catTotals = activeCategories.map((id) => {
      const list = grouped[id];
      const value = list.reduce((s, c) => s + c.marketCap, 0);
      const weightedChange =
        value > 0 ? list.reduce((s, c) => s + c.priceChange24h * c.marketCap, 0) / value : 0;
      return { id, list, value, weightedChange };
    });

    const total = catTotals.reduce((s, c) => s + c.value, 0) || 1;
    const inner: ArcSegment[] = [];
    const outer: ArcSegment[] = [];

    let cursorAngle = 0;
    const gapDeg = activeCategories.length > 1 ? 1.8 : 0;
    const usableAngle = 360 - gapDeg * activeCategories.length;

    for (const cat of catTotals) {
      const span = (cat.value / total) * usableAngle;
      const meta = CATEGORIES[cat.id];
      const startAngle = cursorAngle;
      const endAngle = startAngle + span;

      inner.push({
        id: `cat:${cat.id}`,
        label: meta.label,
        categoryId: cat.id,
        value: cat.value,
        pct: (cat.value / total) * 100,
        change24h: cat.weightedChange,
        startAngle,
        endAngle,
        color: meta.color,
        depthColor: meta.depthColor,
      });

      const maxAssets = zoomCategory ? 12 : cat.id === 'alts' ? 8 : cat.id === 'stables' ? 3 : 1;
      const topCoins = cat.list.slice(0, maxAssets);
      const restCoins = cat.list.slice(maxAssets);

      const childEntries: {
        id: string;
        label: string;
        symbol?: string;
        value: number;
        change24h: number;
        color: string;
        depthColor: string;
        coinId?: string;
      }[] = topCoins.map((c, idx) => {
        const colors =
          cat.id === 'btc' || cat.id === 'eth'
            ? { color: meta.color, depthColor: meta.depthColor }
            : getAssetSliceColor(c, idx);
        return {
          id: `coin:${c.id}`,
          label: c.name,
          symbol: c.symbol.toUpperCase(),
          value: c.marketCap,
          change24h: c.priceChange24h,
          color: colors.color,
          depthColor: colors.depthColor,
          coinId: c.id,
        };
      });

      if (restCoins.length > 0) {
        const restVal = restCoins.reduce((s, c) => s + c.marketCap, 0);
        const restChange =
          restVal > 0
            ? restCoins.reduce((s, c) => s + c.priceChange24h * c.marketCap, 0) / restVal
            : 0;
        childEntries.push({
          id: `rest:${cat.id}`,
          label: `Demais ${meta.label} (+${restCoins.length})`,
          value: restVal,
          change24h: restChange,
          color: '#64748B',
          depthColor: '#334155',
        });
      }

      const childGap = childEntries.length > 1 ? Math.min(0.9, span / (childEntries.length * 4)) : 0;
      const childUsable = Math.max(0.1, span - childGap * (childEntries.length - 1));
      let childCursor = startAngle;

      for (const ch of childEntries) {
        const chSpan = (ch.value / cat.value) * childUsable;
        outer.push({
          id: ch.id,
          label: ch.label,
          symbol: ch.symbol,
          categoryId: cat.id,
          value: ch.value,
          pct: (ch.value / total) * 100,
          change24h: ch.change24h,
          startAngle: childCursor,
          endAngle: childCursor + chSpan,
          color: ch.color,
          depthColor: ch.depthColor,
          coinId: ch.coinId,
        });
        childCursor += chSpan + childGap;
      }

      cursorAngle = endAngle + gapDeg;
    }

    return { innerSegments: inner, outerSegments: outer, totalValue: total };
  }, [coins, zoomCategory]);

  const hoveredSegment = useMemo(() => {
    if (!hoveredId) return null;
    return (
      innerSegments.find((s) => s.id === hoveredId) ??
      outerSegments.find((s) => s.id === hoveredId) ??
      null
    );
  }, [hoveredId, innerSegments, outerSegments]);

  const activeCategoryMeta = zoomCategory ? CATEGORIES[zoomCategory] : null;
  const effectiveTilt = reduceMotion ? { x: 24, y: 0 } : tilt;

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card lg:col-span-2">
      <ChartCardHeader
        title="Sunburst de estrutura e concentração"
        subtitle="Hierarquia em 2 anéis (categorias → ativos) · clique em uma categoria para focar"
        right={
          hoveredSegment ? (
            <div className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[11px] tabular-nums">
              <span className="font-semibold text-foreground">
                {hoveredSegment.symbol ?? hoveredSegment.label}
              </span>{' '}
              <span className="text-accent">{hoveredSegment.pct.toFixed(1)}%</span>{' '}
              <span className="text-muted-foreground">
                · US$ {formatCompactNumber(hoveredSegment.value, preferences.numberLocale)}
              </span>{' '}
              <span className={hoveredSegment.change24h >= 0 ? 'text-positive' : 'text-negative'}>
                ({formatPercent(hoveredSegment.change24h, preferences.numberLocale)})
              </span>
            </div>
          ) : zoomCategory ? (
            <button
              type="button"
              onClick={() => setZoomCategory(null)}
              className="group inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-2.5 text-[11px] font-medium text-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card"
            >
              <ArrowLeft className="h-3 w-3 text-accent" aria-hidden="true" />
              <span>Voltar ao universo</span>
            </button>
          ) : null
        }
      />

      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* 3D Perspective Stage */}
        <div
          onMouseMove={(e) => {
            if (reduceMotion) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width - 0.5;
            const ny = (e.clientY - rect.top) / rect.height - 0.5;
            setTilt({ x: 32 - ny * 18, y: -10 + nx * 24 });
          }}
          onMouseLeave={() => {
            if (!reduceMotion) setTilt({ x: 32, y: -10 });
            setHoveredId(null);
          }}
          className="relative flex h-[580px] items-center justify-center overflow-hidden rounded-md border border-border/70 bg-background/60"
          style={{ perspective: '1050px' }}
        >
          <div
            className="relative h-[360px] w-[360px] transition-transform duration-200 ease-out sm:h-[460px] sm:w-[460px]"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${effectiveTilt.x}deg) rotateY(${effectiveTilt.y}deg)`,
            }}
          >
            {/* Projected Drop Shadow Layer */}
            <div
              className="pointer-events-none absolute inset-6 rounded-full bg-black/55 blur-xl"
              style={{ transform: 'translateZ(-18px)' }}
            />

            {/* Extruded 3D Depth Rim (Lower Cylinder Layer) */}
            <svg
              viewBox="0 0 320 320"
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ transform: 'translateZ(-7px)' }}
              aria-hidden="true"
            >
              {innerSegments.map((seg) => (
                <path
                  key={`depth-${seg.id}`}
                  d={describeRingArc(160, 160, 56, 98, seg.startAngle, seg.endAngle)}
                  fill={seg.depthColor}
                  opacity={0.95}
                />
              ))}
              {outerSegments.map((seg) => (
                <path
                  key={`depth-${seg.id}`}
                  d={describeRingArc(160, 160, 102, 148, seg.startAngle, seg.endAngle)}
                  fill={seg.depthColor}
                  opacity={0.9}
                />
              ))}
            </svg>

            {/* Primary Interactive Top Face */}
            <svg
              ref={ringsRef}
              viewBox="0 0 320 320"
              className="relative h-full w-full overflow-visible"
              style={{ transform: 'translateZ(6px)' }}
              role="img"
              aria-label="Gráfico Sunburst 3D de estrutura e concentração de mercado"
            >
              {innerSegments.map((seg) => {
                const isHovered = hoveredId === seg.id;
                return (
                  <path
                    key={seg.id}
                    d={describeRingArc(
                      160,
                      160,
                      56,
                      isHovered ? 100 : 98,
                      seg.startAngle,
                      seg.endAngle
                    )}
                    fill={seg.color}
                    opacity={hoveredId && !isHovered ? 0.65 : 0.96}
                    stroke="rgba(10, 14, 23, 0.75)"
                    strokeWidth={1.2}
                    className="cursor-pointer transition-opacity duration-150"
                    onMouseEnter={() => setHoveredId(seg.id)}
                    onClick={() =>
                      setZoomCategory((prev) => (prev === seg.categoryId ? null : seg.categoryId))
                    }
                  />
                );
              })}

              {outerSegments.map((seg) => {
                const isHovered = hoveredId === seg.id;
                return (
                  <path
                    key={seg.id}
                    d={describeRingArc(
                      160,
                      160,
                      102,
                      isHovered ? 153 : 148,
                      seg.startAngle,
                      seg.endAngle
                    )}
                    fill={seg.color}
                    opacity={hoveredId && !isHovered ? 0.62 : 0.94}
                    stroke="rgba(10, 14, 23, 0.75)"
                    strokeWidth={1}
                    className={
                      seg.coinId
                        ? 'cursor-pointer transition-opacity duration-150'
                        : 'transition-opacity duration-150'
                    }
                    onMouseEnter={() => setHoveredId(seg.id)}
                    onClick={() => {
                      if (seg.coinId) {
                        onOpenAsset(seg.coinId);
                      } else {
                        setZoomCategory((prev) =>
                          prev === seg.categoryId ? null : seg.categoryId
                        );
                      }
                    }}
                  />
                );
              })}
            </svg>

            {/* Elevated 3D Center Hub */}
            <button
              type="button"
              onClick={() => setZoomCategory(null)}
              disabled={!zoomCategory}
              style={{ transform: 'translateZ(12px)' }}
              className="absolute inset-0 m-auto flex h-[124px] w-[124px] flex-col items-center justify-center rounded-full border border-border bg-card/95 p-3 text-center shadow-overlay backdrop-blur transition-colors hover:border-accent/60 disabled:cursor-default disabled:hover:border-border sm:h-[156px] sm:w-[156px]"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {activeCategoryMeta ? activeCategoryMeta.label : 'Universo'}
              </span>
              <span className="mt-1 whitespace-nowrap font-mono text-xs font-bold tabular-nums text-foreground sm:text-sm">
                US$ {formatCompactNumber(totalValue, preferences.numberLocale)}
              </span>
              <span className="mt-0.5 text-[10px] text-accent">
                {zoomCategory ? '← Voltar' : `${coins.length} ativos`}
              </span>
            </button>
          </div>
        </div>

        {/* Interactive Breakdown List */}
        <div className="flex flex-col gap-3 text-xs">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Categorias (clique para focar)
            </p>
            <div className="space-y-1">
              {innerSegments.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() =>
                    setZoomCategory((prev) => (prev === seg.categoryId ? null : seg.categoryId))
                  }
                  className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                    hoveredId === seg.id || zoomCategory === seg.categoryId
                      ? 'border-accent/60 bg-accent/10'
                      : 'border-border/70 bg-background/50 hover:bg-muted/50'
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span>{seg.label}</span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {seg.pct.toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Maiores fatias no anel externo
            </p>
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {outerSegments
                .filter((s) => Boolean(s.coinId))
                .slice(0, 6)
                .map((seg) => (
                  <button
                    key={seg.id}
                    type="button"
                    onMouseEnter={() => setHoveredId(seg.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => seg.coinId && onOpenAsset(seg.coinId)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition-colors ${
                      hoveredId === seg.id ? 'bg-muted/70' : 'hover:bg-muted/40'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="truncate font-mono text-[11px] font-semibold text-foreground">
                        {seg.symbol ?? seg.label}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span className="text-muted-foreground">{seg.pct.toFixed(1)}%</span>
                      <span className={seg.change24h >= 0 ? 'text-positive' : 'text-negative'}>
                        {formatPercent(seg.change24h, preferences.numberLocale)}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
