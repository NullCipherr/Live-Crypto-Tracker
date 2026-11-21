import { useEffect, useMemo, useRef, useState } from 'react';
import type { CoinMarket } from '../../types/crypto';
import { formatCompactNumber, formatPercent } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { ChartCardHeader } from './ChartCard';

const COLORS = ['#82B4FF', '#34D399', '#FBBF24', '#F472B6', '#A78BFA', '#38BDF8', '#FB7185', '#2DD4BF'];

export interface Chart3DAssetItem {
  coin: CoinMarket;
  periodReturn: number;
  volatility: number;
  maxDrawdown: number;
  series?: number[];
}

/* -------------------------------------------------------------------------- */
/* 1. Torres Isométricas 3D Animadas (Retorno & Capitalização)                */
/* -------------------------------------------------------------------------- */
export function Isometric3DReturnTowers({
  items,
  onInspectCoin,
}: {
  items: Chart3DAssetItem[];
  onInspectCoin: (coinId: string) => void;
}) {
  const { preferences } = usePreferences();
  const [tilt, setTilt] = useState({ x: 18, y: -14 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const towersContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = towersContainerRef.current;
    if (!container) return;
    const reduceMotion =
      preferences.reduceMotion === 'reduce' ||
      (preferences.reduceMotion === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduceMotion) return;

    const bars = container.querySelectorAll<HTMLElement>('[data-tower-bar]');
    const anims: Animation[] = [];
    bars.forEach((bar, i) => {
      if (typeof bar.animate === 'function') {
        anims.push(
          bar.animate(
            [
              { transform: 'scaleY(0)', opacity: 0.3 },
              { transform: 'scaleY(1)', opacity: 1 },
            ],
            {
              duration: 520,
              delay: i * 35,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              fill: 'both',
            }
          )
        );
      }
    });
    return () => anims.forEach((a) => a.cancel());
  }, [items.length, preferences.reduceMotion]);

  const maxAbs = useMemo(
    () => Math.max(...items.map((i) => Math.abs(i.periodReturn)), 1),
    [items]
  );

  const hoveredItem = useMemo(
    () => items.find((i) => i.coin.id === hoveredId) ?? null,
    [hoveredId, items]
  );

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <ChartCardHeader
        title="Torres 3D de Retorno Acumulado"
        subtitle="Perspectiva isométrica interativa · passe o cursor para inclinar e inspecionar"
        right={
          hoveredItem ? (
            <div className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[11px] tabular-nums">
              <span className="font-semibold text-foreground">
                {hoveredItem.coin.symbol.toUpperCase()}
              </span>{' '}
              <span className={hoveredItem.periodReturn >= 0 ? 'text-positive' : 'text-negative'}>
                {formatPercent(hoveredItem.periodReturn, preferences.numberLocale)}
              </span>{' '}
              <span className="text-muted-foreground">
                · US$ {formatCompactNumber(hoveredItem.coin.marketCap, preferences.numberLocale)}
              </span>
            </div>
          ) : null
        }
      />

      <div
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const nx = (e.clientX - rect.left) / rect.width - 0.5;
          const ny = (e.clientY - rect.top) / rect.height - 0.5;
          setTilt({ x: 18 - ny * 14, y: -14 + nx * 24 });
        }}
        onMouseLeave={() => setTilt({ x: 18, y: -14 })}
        className="relative flex h-[620px] items-end justify-center overflow-hidden rounded-md border border-border/70 bg-background/60 px-6 pb-10 pt-16"
        style={{ perspective: '1050px' }}
      >
        <div
          ref={towersContainerRef}
          className="flex items-end justify-center gap-5 sm:gap-7 transition-transform duration-200 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          }}
        >
          {items.slice(0, 14).map((item, idx) => {
            const heightPx = Math.max(44, Math.round((Math.abs(item.periodReturn) / maxAbs) * 380));
            const isPos = item.periodReturn >= 0;
            const color = isPos ? '#34D399' : '#F43F5E';
            const sideColor = isPos ? '#059669' : '#E11D48';
            const topColor = isPos ? '#6EE7B7' : '#FDA4AF';
            const isHovered = hoveredId === item.coin.id;

            return (
              <button
                key={item.coin.id}
                type="button"
                onMouseEnter={() => setHoveredId(item.coin.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onInspectCoin(item.coin.id)}
                className="group relative flex flex-col items-center focus:outline-none"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <span
                  className="mb-3 font-mono text-[11px] font-semibold tabular-nums transition-transform duration-200"
                  style={{
                    color,
                    transform: isHovered ? 'translateZ(18px) translateY(-4px) scale(1.08)' : 'translateZ(12px)',
                  }}
                >
                  {formatPercent(item.periodReturn, preferences.numberLocale)}
                </span>

                {/* 3D Prism */}
                <div
                  className="relative w-9 sm:w-11 transition-all duration-300"
                  style={{
                    height: `${heightPx}px`,
                    transformStyle: 'preserve-3d',
                    transform: isHovered ? 'translateZ(14px) scale(1.04)' : `translateZ(${(idx % 2) * 4}px)`,
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(180deg, ${color}, ${sideColor})`,
                      transform: 'translateZ(10px)',
                    }}
                  />
                  {/* Right Side */}
                  <div
                    className="absolute top-0 right-0 h-full w-5 origin-right"
                    style={{
                      backgroundColor: sideColor,
                      filter: 'brightness(0.74)',
                      transform: 'translateZ(10px) rotateY(-90deg)',
                    }}
                  />
                  {/* Top Face */}
                  <div
                    className="absolute top-0 left-0 h-5 w-full origin-top"
                    style={{
                      backgroundColor: topColor,
                      transform: 'translateZ(10px) rotateX(-90deg)',
                    }}
                  />
                </div>

                <span className="mt-2 font-mono text-[11px] font-semibold text-foreground">
                  {item.coin.symbol.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Camadas 3D em Perspectiva (Curvas de Retorno Acumulado)                 */
/* -------------------------------------------------------------------------- */
export function Perspective3DReturnRibbon({
  items,
}: {
  items: Chart3DAssetItem[];
}) {
  const { preferences } = usePreferences();
  const [rot, setRot] = useState({ x: 24, y: -18 });
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const layers = useMemo(() => {
    const valid = items.filter((i) => i.series && i.series.length >= 2).slice(0, 5);
    let min = Infinity;
    let max = -Infinity;
    for (const item of valid) {
      for (const v of item.series ?? []) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const span = max - min || 1;
    const w = 360;
    const h = 110;

    return valid.map((item, idx) => {
      const pts = item.series ?? [];
      const coords = pts.map((v, i) => ({
        x: Number(((i / (pts.length - 1)) * w).toFixed(1)),
        y: Number((h - 10 - ((v - min) / span) * (h - 20)).toFixed(1)),
      }));
      const line = coords.map((p) => `${p.x},${p.y}`).join(' ');
      const area = `M 0,${h} L ${coords.map((p) => `${p.x},${p.y}`).join(' L ')} L ${w},${h} Z`;
      return {
        item,
        color: COLORS[idx % COLORS.length],
        line,
        area,
        w,
        h,
      };
    });
  }, [items]);

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <ChartCardHeader
        title="Camadas 3D de Retorno Acumulado"
        subtitle="Planos paralelos em profundidade · mova o cursor para rotacionar"
        right={
          <div className="flex flex-wrap gap-1.5">
            {layers.map((l, idx) => (
              <button
                key={l.item.coin.id}
                type="button"
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                  activeIdx === idx
                    ? 'border-accent bg-accent/15 text-foreground'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                <span style={{ color: l.color }}>●</span> {l.item.coin.symbol.toUpperCase()}{' '}
                {formatPercent(l.item.periodReturn, preferences.numberLocale)}
              </button>
            ))}
          </div>
        }
      />

      <div
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const nx = (e.clientX - rect.left) / rect.width - 0.5;
          const ny = (e.clientY - rect.top) / rect.height - 0.5;
          setRot({ x: 24 - ny * 16, y: -18 + nx * 26 });
        }}
        onMouseLeave={() => setRot({ x: 24, y: -18 })}
        className="relative flex h-80 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-background/60"
        style={{ perspective: '950px' }}
      >
        {layers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aguardando séries para projeção 3D...</p>
        ) : (
          <div
            className="relative h-52 w-[88%] max-w-[520px] transition-transform duration-200 ease-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
            }}
          >
            {/* Subtle 3D floor grid */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-28 origin-bottom rounded border border-border/50 bg-card/30"
              style={{ transform: 'rotateX(78deg) translateY(8px)' }}
            />
            {layers.map((layer, idx) => {
              const zOffset = (idx - (layers.length - 1) / 2) * 38;
              const isHighlighted = activeIdx === null || activeIdx === idx;
              return (
                <svg
                  key={layer.item.coin.id}
                  viewBox={`0 0 ${layer.w} ${layer.h}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full transition-all duration-300"
                  style={{
                    transform: `translateZ(${zOffset}px) translateY(${idx * -5}px)`,
                    opacity: isHighlighted ? 0.96 : 0.2,
                  }}
                >
                  <path d={layer.area} fill={layer.color} fillOpacity="0.18" />
                  <polyline
                    fill="none"
                    stroke={layer.color}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    points={layer.line}
                  />
                </svg>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Espaço 3D Risco × Retorno × Capitalização                               */
/* -------------------------------------------------------------------------- */
export function Interactive3DRiskPrism({
  items,
  onInspectCoin,
}: {
  items: Chart3DAssetItem[];
  onInspectCoin: (coinId: string) => void;
}) {
  const { preferences } = usePreferences();
  const [rot, setRot] = useState({ x: 20, y: 22 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nodes = useMemo(() => {
    if (items.length === 0) return [];
    const maxVol = Math.max(...items.map((i) => i.volatility), 1);
    const minRet = Math.min(...items.map((i) => i.periodReturn), -5);
    const maxRet = Math.max(...items.map((i) => i.periodReturn), 5);
    const retSpan = maxRet - minRet || 1;
    const maxCap = Math.max(...items.map((i) => Math.log10(Math.max(i.coin.marketCap, 1))), 1);

    return items.slice(0, 10).map((item, idx) => {
      const xPct = 12 + (item.volatility / maxVol) * 76;
      const yPct = 82 - ((item.periodReturn - minRet) / retSpan) * 66;
      const zPx = ((Math.log10(Math.max(item.coin.marketCap, 1)) / maxCap) - 0.5) * 110;
      return {
        item,
        color: COLORS[idx % COLORS.length],
        xPct,
        yPct,
        zPx,
      };
    });
  }, [items]);

  const hovered = nodes.find((n) => n.item.coin.id === hoveredId) ?? null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <ChartCardHeader
        title="Espaço 3D: Volatilidade × Retorno × Capitalização"
        subtitle="Eixo X: Volatilidade · Eixo Y: Retorno · Profundidade Z: Capitalização"
        right={
          hovered ? (
            <div className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[11px] tabular-nums">
              <span className="font-semibold text-foreground">
                {hovered.item.coin.symbol.toUpperCase()}
              </span>{' '}
              · Vol {hovered.item.volatility.toFixed(2)}% · Ret{' '}
              <span className={hovered.item.periodReturn >= 0 ? 'text-positive' : 'text-negative'}>
                {formatPercent(hovered.item.periodReturn, preferences.numberLocale)}
              </span>
            </div>
          ) : null
        }
      />

      <div
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const nx = (e.clientX - rect.left) / rect.width - 0.5;
          const ny = (e.clientY - rect.top) / rect.height - 0.5;
          setRot({ x: 20 - ny * 22, y: 22 + nx * 30 });
        }}
        onMouseLeave={() => setRot({ x: 20, y: 22 })}
        className="relative flex h-80 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-background/60"
        style={{ perspective: '950px' }}
      >
        <div
          className="relative h-60 w-[92%] max-w-2xl rounded border border-border/60 bg-card/30 transition-transform duration-200 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          }}
        >
          <span className="pointer-events-none absolute left-2.5 top-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Retorno ↑
          </span>
          <span className="pointer-events-none absolute bottom-2 right-2.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Volatilidade →
          </span>
          {/* Base grid plane */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 origin-bottom border-t border-border/60 bg-accent/5"
            style={{ transform: 'rotateX(75deg)' }}
          />

          {nodes.map((node) => {
            const isHot = hoveredId === node.item.coin.id;
            return (
              <button
                key={node.item.coin.id}
                type="button"
                onMouseEnter={() => setHoveredId(node.item.coin.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onInspectCoin(node.item.coin.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                style={{
                  left: `${node.xPct}%`,
                  top: `${node.yPct}%`,
                  transformStyle: 'preserve-3d',
                  transform: `translateZ(${node.zPx}px) scale(${isHot ? 1.25 : 1})`,
                  transition: 'transform 200ms ease',
                }}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-white/30 shadow-lg"
                  style={{
                    backgroundColor: node.color,
                    boxShadow: `0 0 14px ${node.color}88`,
                  }}
                />
                <span className="mt-1 block rounded bg-card/90 px-1 font-mono text-[9px] font-semibold text-foreground">
                  {node.item.coin.symbol.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
