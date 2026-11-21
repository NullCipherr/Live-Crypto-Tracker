import { useMemo, useState } from 'react';
import { formatDateShort, formatPercent } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';

export interface CalendarDayInfo {
  dayKey: string;
  timestamp: number;
  returnPct: number;
  upCount: number;
  totalCount: number;
}

interface ReturnCalendarCardProps {
  days: CalendarDayInfo[];
  onInspectDay?: (day: CalendarDayInfo) => void;
}

function getCellTone(ret: number): string {
  if (ret >= 3) return 'bg-positive/35 border-positive/60 text-foreground';
  if (ret > 0.25) return 'bg-positive/15 border-positive/35 text-foreground';
  if (ret <= -3) return 'bg-negative/35 border-negative/60 text-foreground';
  if (ret < -0.25) return 'bg-negative/15 border-negative/35 text-foreground';
  return 'bg-muted/60 border-border text-muted-foreground';
}

export function ReturnCalendarCard({ days, onInspectDay }: ReturnCalendarCardProps) {
  const { preferences } = usePreferences();
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(
    () => days[days.length - 1]?.dayKey ?? null
  );

  const dayMap = useMemo(() => new Map(days.map((d) => [d.dayKey, d])), [days]);

  const calendarGrid = useMemo(() => {
    if (days.length === 0) return [];
    const last = new Date(days[days.length - 1].timestamp);
    const year = last.getUTCFullYear();
    const month = last.getUTCMonth();
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    // Mon = 0 .. Sun = 6
    const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;

    const cells: { dayNum: number | null; dayKey?: string; info?: CalendarDayInfo }[] = [];
    for (let i = 0; i < startOffset; i++) cells.push({ dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dayNum: d, dayKey: key, info: dayMap.get(key) });
    }
    return cells;
  }, [dayMap, days]);

  const selectedInfo =
    (selectedDayKey ? dayMap.get(selectedDayKey) : undefined) ?? days[days.length - 1] ?? null;

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-foreground">Calendário de retornos</h2>
          <p className="text-[11px] text-muted-foreground">
            Retorno médio diário da carteira · dias sem dados aparecem hachurados
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="mb-1.5 grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-muted-foreground">
            <span>SEG</span>
            <span>TER</span>
            <span>QUA</span>
            <span>QUI</span>
            <span>SEX</span>
            <span>SÁB</span>
            <span>DOM</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.map((cell, idx) => {
              if (!cell.dayNum) {
                return <div key={`empty-${idx}`} className="h-10" />;
              }

              if (!cell.info) {
                return (
                  <div
                    key={cell.dayKey}
                    title="Sem dados para esta data"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(135deg, transparent, transparent 4px, hsl(var(--border)) 4px, hsl(var(--border)) 5px)',
                    }}
                    className="flex h-10 flex-col justify-between rounded border border-border/60 bg-background/50 p-1 text-[10px] text-muted-foreground/60"
                  >
                    <span className="font-mono">{String(cell.dayNum).padStart(2, '0')}</span>
                    <span className="text-right font-mono">/</span>
                  </div>
                );
              }

              const isSelected = selectedInfo?.dayKey === cell.dayKey;
              return (
                <button
                  key={cell.dayKey}
                  type="button"
                  onClick={() => setSelectedDayKey(cell.dayKey!)}
                  className={`flex h-10 flex-col justify-between rounded border p-1 text-left text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${getCellTone(
                    cell.info.returnPct
                  )} ${isSelected ? 'ring-1 ring-accent' : ''}`}
                >
                  <span className="font-mono font-medium">
                    {String(cell.dayNum).padStart(2, '0')}
                  </span>
                  <span className="text-right font-mono tabular-nums">
                    {cell.info.returnPct >= 0 ? '+' : '−'}
                    {Math.abs(cell.info.returnPct).toFixed(1).replace('.', ',')}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedInfo ? (
          <div className="flex flex-col justify-between rounded border border-border bg-background p-3 text-xs">
            <div className="space-y-2">
              <p className="font-mono text-[11px] font-semibold text-foreground">
                {formatDateShort(selectedInfo.timestamp, preferences.timezone)}
              </p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retorno</span>
                <span
                  className={`font-mono font-semibold ${
                    selectedInfo.returnPct >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {formatPercent(selectedInfo.returnPct, preferences.numberLocale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Em alta</span>
                <span className="font-mono text-foreground">
                  {selectedInfo.upCount} de {selectedInfo.totalCount}
                </span>
              </div>
            </div>

            {onInspectDay ? (
              <button
                type="button"
                onClick={() => onInspectDay(selectedInfo)}
                className="mt-3 h-7 rounded border border-border bg-card px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                Inspecionar o dia
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
