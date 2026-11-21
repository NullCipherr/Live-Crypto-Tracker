export interface ReportSnapshot {
  id: string;
  createdAt: number;
  label: string;
  sourceLabel: string;
  startDate: string;
  endDate: string;
  tickers: string[];
  btcDominancePct: number | null;
  avgDailyVolume: number;
  upCount: number;
  totalCount: number;
  tickerReturns: Record<string, number>;
}

const SNAPSHOTS_STORAGE_KEY = 'lct-report-snapshots-v1';

const SEED_SNAPSHOTS: ReportSnapshot[] = [
  {
    id: 'seed-sep-2026',
    createdAt: Date.UTC(2026, 8, 30, 23, 59),
    label: 'Setembro 2026 (Referência)',
    sourceLabel: 'Demonstração LCT',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    tickers: ['BTC', 'ETH'],
    btcDominancePct: 58.4,
    avgDailyVolume: 61.2e9,
    upCount: 1,
    totalCount: 2,
    tickerReturns: { BTC: 2.8, ETH: -1.4 },
  },
];

export function readReportSnapshots(): ReportSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) return SEED_SNAPSHOTS;
    const parsed = JSON.parse(raw) as ReportSnapshot[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_SNAPSHOTS;
  } catch {
    return SEED_SNAPSHOTS;
  }
}

export function saveReportSnapshot(snapshot: ReportSnapshot): ReportSnapshot[] {
  const existing = readReportSnapshots().filter((s) => s.id !== snapshot.id);
  const next = [snapshot, ...existing].slice(0, 20);
  try {
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}
