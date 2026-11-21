import type { AssetChartPoint } from '../types/crypto';

export interface DailySeriesPoint {
  dayKey: string;
  timestamp: number;
  price: number;
}

export function bucketByDay(points: AssetChartPoint[]): DailySeriesPoint[] {
  const map = new Map<string, DailySeriesPoint>();
  for (const pt of points) {
    const d = new Date(pt.timestamp);
    const dayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    map.set(dayKey, { dayKey, timestamp: pt.timestamp, price: pt.price });
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function computeDailyReturns(daily: DailySeriesPoint[]): Map<string, number> {
  const returns = new Map<string, number>();
  for (let i = 1; i < daily.length; i++) {
    const prev = daily[i - 1].price;
    const curr = daily[i].price;
    if (prev > 0) {
      returns.set(daily[i].dayKey, ((curr - prev) / prev) * 100);
    }
  }
  return returns;
}

export function computeVolatility(returnsMap: Map<string, number>): number {
  const vals = Array.from(returnsMap.values());
  if (vals.length < 2) return 0;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1);
  return Math.sqrt(variance);
}

export function computeMaxDrawdown(daily: DailySeriesPoint[]): number {
  if (daily.length < 2) return 0;
  let peak = daily[0].price;
  let maxDd = 0;
  for (const pt of daily) {
    if (pt.price > peak) peak = pt.price;
    if (peak > 0) {
      const dd = ((pt.price - peak) / peak) * 100;
      if (dd < maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

export function computeDrawdownSeries(
  daily: DailySeriesPoint[]
): { dayKey: string; timestamp: number; drawdownPct: number }[] {
  if (daily.length === 0) return [];
  let peak = daily[0].price;
  return daily.map((pt) => {
    if (pt.price > peak) peak = pt.price;
    const dd = peak > 0 ? ((pt.price - peak) / peak) * 100 : 0;
    return { dayKey: pt.dayKey, timestamp: pt.timestamp, drawdownPct: Number(dd.toFixed(2)) };
  });
}

export interface DistributionStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
  points: { dayKey: string; timestamp: number; ret: number; isOutlier: boolean }[];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next !== undefined ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
}

export function computeDistributionStats(
  daily: DailySeriesPoint[],
  returnsMap: Map<string, number>
): DistributionStats {
  const entries = daily
    .map((d) => {
      const ret = returnsMap.get(d.dayKey);
      return ret !== undefined ? { dayKey: d.dayKey, timestamp: d.timestamp, ret } : null;
    })
    .filter((x): x is { dayKey: string; timestamp: number; ret: number } => x !== null);

  if (entries.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0, iqr: 0, points: [] };
  }

  const sorted = [...entries.map((e) => e.ret)].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;

  return {
    min: sorted[0],
    q1,
    median,
    q3,
    max: sorted[sorted.length - 1],
    iqr,
    points: entries.map((e) => ({
      ...e,
      isOutlier: e.ret < lowFence || e.ret > highFence,
    })),
  };
}

export function computeRollingCorrelation(
  dailyA: DailySeriesPoint[],
  retA: Map<string, number>,
  retB: Map<string, number>,
  windowSize = 14
): { dayKey: string; timestamp: number; r: number }[] {
  const common = dailyA
    .filter((d) => retA.has(d.dayKey) && retB.has(d.dayKey))
    .map((d) => ({
      dayKey: d.dayKey,
      timestamp: d.timestamp,
      a: retA.get(d.dayKey)!,
      b: retB.get(d.dayKey)!,
    }));

  const out: { dayKey: string; timestamp: number; r: number }[] = [];
  for (let i = windowSize - 1; i < common.length; i++) {
    const slice = common.slice(i - windowSize + 1, i + 1);
    const meanA = slice.reduce((s, p) => s + p.a, 0) / slice.length;
    const meanB = slice.reduce((s, p) => s + p.b, 0) / slice.length;
    let num = 0;
    let denA = 0;
    let denB = 0;
    for (const p of slice) {
      const da = p.a - meanA;
      const db = p.b - meanB;
      num += da * db;
      denA += da * da;
      denB += db * db;
    }
    const den = Math.sqrt(denA * denB);
    out.push({
      dayKey: common[i].dayKey,
      timestamp: common[i].timestamp,
      r: den > 0 ? Number((num / den).toFixed(2)) : 0,
    });
  }
  return out;
}

export function computeBestDay(returnsMap: Map<string, number>): number {
  let best = -Infinity;
  for (const v of returnsMap.values()) {
    if (v > best) best = v;
  }
  return best === -Infinity ? 0 : best;
}

export function computePearsonCorrelation(
  a: Map<string, number>,
  b: Map<string, number>
): { r: number | null; count: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [day, valA] of a.entries()) {
    const valB = b.get(day);
    if (valB !== undefined) {
      xs.push(valA);
      ys.push(valB);
    }
  }

  const n = xs.length;
  if (n < 3) return { r: null, count: n };

  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return { r: null, count: n };
  return { r: num / den, count: n };
}

export function downloadCsvRows(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [
    headers.join(';'),
    ...rows.map((r) => r.map((cell) => String(cell).replace('.', ',')).join(';')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadChartSvg(container: HTMLElement | null, title: string, subtitle: string, filename: string) {
  const svg = container?.querySelector('svg');
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = svg.clientWidth || 720;
  const height = svg.clientHeight || 300;
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  wrapper.setAttribute('width', String(width));
  wrapper.setAttribute('height', String(height + 56));
  wrapper.setAttribute('viewBox', `0 0 ${width} ${height + 56}`);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height + 56));
  bg.setAttribute('fill', '#101317');
  wrapper.appendChild(bg);

  const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  titleEl.setAttribute('x', '16');
  titleEl.setAttribute('y', '22');
  titleEl.setAttribute('fill', '#E8EDF5');
  titleEl.setAttribute('font-size', '14');
  titleEl.setAttribute('font-family', 'Plus Jakarta Sans, sans-serif');
  titleEl.textContent = title;
  wrapper.appendChild(titleEl);

  const subEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  subEl.setAttribute('x', '16');
  subEl.setAttribute('y', '40');
  subEl.setAttribute('fill', '#94A3B8');
  subEl.setAttribute('font-size', '11');
  subEl.setAttribute('font-family', 'Plus Jakarta Sans, sans-serif');
  subEl.textContent = `${subtitle} · Fonte: CoinGecko`;
  wrapper.appendChild(subEl);

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', 'translate(0, 48)');
  g.appendChild(clone);
  wrapper.appendChild(g);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadChartPng(container: HTMLElement | null, title: string, subtitle: string, filename: string) {
  const svg = container?.querySelector('svg');
  if (!svg) return;
  const width = svg.clientWidth || 720;
  const height = svg.clientHeight || 300;
  const serialized = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = (height + 56) * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.fillStyle = '#101317';
    ctx.fillRect(0, 0, width, height + 56);
    ctx.fillStyle = '#E8EDF5';
    ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(title, 16, 22);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '400 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${subtitle} · Fonte: CoinGecko`, 16, 40);
    ctx.drawImage(img, 0, 48, width, height);
    URL.revokeObjectURL(svgUrl);

    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = filename;
    a.click();
  };
  img.src = svgUrl;
}
