import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApexOptions } from 'apexcharts';
import {
  Activity,
  CheckCircle2,
  Database,
  Download,
  Globe,
  HardDrive,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Trash2,
  Wifi,
} from 'lucide-react';
import { getRequestLogs, subscribeRequestLogs } from '../../services/coingecko';
import { formatTime } from '../../lib/formatters';
import { downloadCsvRows } from '../../lib/analytics';
import { usePreferences } from '../../hooks/usePreferences';
import { PageHeader, HeaderButton } from '../shell/PageHeader';
import { CustomSelect } from '../ui/CustomSelect';
import { ApexChartWrapper } from '../analytics/ApexChartWrapper';
import type { RequestLogEntry } from '../../types/crypto';

interface SourcesViewProps {
  fetchedAt?: number;
  latencyMs?: number;
  isError: boolean;
  isFetching: boolean;
  coinCount: number;
  onRefresh: () => void;
}

interface ProbeResult {
  status: 'ok' | 'err';
  latencyMs: number;
  checkedAt: number;
}

const CACHE_PREFIX = 'lct-cache:';

function measureCacheStats(): { entries: number; kb: number } {
  try {
    let entries = 0;
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        entries++;
        bytes += (localStorage.getItem(k)?.length ?? 0) * 2;
      }
    }
    return { entries, kb: Math.round(bytes / 1024) };
  } catch {
    return { entries: 0, kb: 0 };
  }
}

export function SourcesView({
  fetchedAt,
  latencyMs,
  isError,
  isFetching,
  coinCount,
  onRefresh,
}: SourcesViewProps) {
  const { preferences } = usePreferences();
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<RequestLogEntry[]>(() => getRequestLogs());
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'err'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [cacheStats, setCacheStats] = useState(() => measureCacheStats());
  const [cacheClearedMsg, setCacheClearedMsg] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probes, setProbes] = useState<Record<string, ProbeResult>>({});

  useEffect(() => {
    return subscribeRequestLogs(() => {
      setLogs(getRequestLogs());
      setCacheStats(measureCacheStats());
    });
  }, []);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((entry) => {
      if (statusFilter === 'ok' && !entry.ok) return false;
      if (statusFilter === 'err' && entry.ok) return false;
      if (!q) return true;
      return (
        entry.service.toLowerCase().includes(q) ||
        (entry.note ?? '').toLowerCase().includes(q) ||
        String(entry.status).includes(q)
      );
    });
  }, [logs, statusFilter, logSearch]);

  const telemetry = useMemo(() => {
    const total = logs.length;
    const okCount = logs.filter((l) => l.ok).length;
    const successRate = total > 0 ? (okCount / total) * 100 : isError ? 0 : 100;
    const durations = logs.map((l) => l.durationMs).filter((d) => Number.isFinite(d) && d > 0);
    const avgLatency =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : latencyMs ?? 0;
    const maxLatency = durations.length > 0 ? Math.max(...durations) : latencyMs ?? 0;
    return { total, okCount, successRate, avgLatency, maxLatency };
  }, [logs, isError, latencyMs]);

  const lastHistorySuccess = useMemo(
    () => logs.find((l) => l.service === 'Histórico' && l.ok),
    [logs]
  );

  const latencySeries = useMemo<NonNullable<ApexOptions['series']>>(() => {
    const ordered = [...logs].slice(0, 24).reverse();
    if (ordered.length === 0) return [];
    return [
      {
        name: 'Latência (ms)',
        data: ordered.map((l, idx) => ({
          x: `${formatTime(l.timestamp, preferences.timezone)} #${idx + 1}`,
          y: l.durationMs,
        })),
      },
    ];
  }, [logs, preferences.timezone]);

  const latencyOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: 'sources-latency-chart',
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      colors: ['#3b82f6'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.35,
          opacityTo: 0.04,
        },
      },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: {
        labels: { show: false },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          formatter: (val) => `${Math.round(val)} ms`,
        },
      },
      tooltip: {
        y: {
          formatter: (val) => (val != null ? `${Math.round(val)} ms` : '—'),
        },
      },
    }),
    []
  );

  const handleClearCache = () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
      }
      for (const k of keys) localStorage.removeItem(k);
      void queryClient.invalidateQueries();
      setCacheStats(measureCacheStats());
      setCacheClearedMsg(true);
      window.setTimeout(() => setCacheClearedMsg(false), 2200);
    } catch {
      // ignore storage error
    }
  };

  const handleTestConnectivity = async () => {
    setProbing(true);
    const targets: { id: string; url: string }[] = [
      { id: 'coingecko', url: 'https://api.coingecko.com/api/v3/ping' },
      { id: 'coinpaprika', url: 'https://api.coinpaprika.com/v1/global' },
      {
        id: 'rss2json',
        url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fcointelegraph.com%2Frss',
      },
      { id: 'hn', url: 'https://hn.algolia.com/api/v1/search?query=bitcoin&tags=story&hitsPerPage=1' },
    ];

    const entries = await Promise.all(
      targets.map(async (t) => {
        const t0 = performance.now();
        try {
          const res = await fetch(t.url, { signal: AbortSignal.timeout(6000) });
          return [
            t.id,
            {
              status: res.ok ? 'ok' : 'err',
              latencyMs: Math.round(performance.now() - t0),
              checkedAt: Date.now(),
            } satisfies ProbeResult,
          ] as const;
        } catch {
          return [
            t.id,
            {
              status: 'err',
              latencyMs: Math.round(performance.now() - t0),
              checkedAt: Date.now(),
            } satisfies ProbeResult,
          ] as const;
        }
      })
    );

    setProbes(Object.fromEntries(entries));
    setProbing(false);
  };

  const handleExportLogsCsv = () => {
    if (filteredLogs.length === 0) return;
    downloadCsvRows(
      'lct-logs-fontes.csv',
      ['horario', 'servico', 'status', 'ok', 'duracao_ms', 'observacao'],
      filteredLogs.map((l) => [
        formatTime(l.timestamp, preferences.timezone),
        l.service,
        l.status,
        l.ok ? 'OK' : 'ERRO',
        l.durationMs,
        l.note ?? '',
      ])
    );
  };

  const providers = [
    {
      id: 'coingecko',
      name: 'CoinGecko API v3',
      role: 'Cotações primárias, OHLC, gráficos e perfis',
      icon: Server,
      probe: probes.coingecko,
      fallbackOk: !isError,
      latency: probes.coingecko?.latencyMs ?? latencyMs,
      lastSync: probes.coingecko?.checkedAt ?? fetchedAt,
      badge: isError ? 'Degradado' : 'Online',
    },
    {
      id: 'coinpaprika',
      name: 'CoinPaprika Public API',
      role: 'Expansão de universo e fallback de mercado',
      icon: Database,
      probe: probes.coinpaprika,
      fallbackOk: coinCount > 250,
      latency: probes.coinpaprika?.latencyMs,
      lastSync: probes.coinpaprika?.checkedAt ?? fetchedAt,
      badge: coinCount > 250 ? 'Online' : 'Standby',
    },
    {
      id: 'rss2json',
      name: 'Bing News & Portais Cripto',
      role: 'Scraping de notícias via RSS (Cointelegraph, Decrypt, CoinDesk)',
      icon: Globe,
      probe: probes.rss2json,
      fallbackOk: true,
      latency: probes.rss2json?.latencyMs,
      lastSync: probes.rss2json?.checkedAt ?? lastHistorySuccess?.timestamp,
      badge: 'Sob demanda',
    },
    {
      id: 'hn',
      name: 'Hacker News Algolia',
      role: 'Discussões técnicas e menções da comunidade',
      icon: Wifi,
      probe: probes.hn,
      fallbackOk: true,
      latency: probes.hn?.latencyMs,
      lastSync: probes.hn?.checkedAt,
      badge: 'Sob demanda',
    },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Fontes de dados"
        subtitle="Telemetria em tempo real, saúde dos provedores, cache local e registro de requisições."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HeaderButton onClick={() => void handleTestConnectivity()} disabled={probing}>
              <Wifi className={`h-3.5 w-3.5 text-accent ${probing ? 'animate-pulse' : ''}`} aria-hidden="true" />
              <span>{probing ? 'Testando...' : 'Testar provedores'}</span>
            </HeaderButton>
            <HeaderButton onClick={handleClearCache}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{cacheClearedMsg ? 'Cache limpo!' : 'Limpar cache'}</span>
            </HeaderButton>
            <HeaderButton variant="primary" onClick={onRefresh} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Atualizar agora</span>
            </HeaderButton>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-5">
          {/* KPI Strip */}
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border/80 bg-card/95 p-4 shadow-card">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Taxa de sucesso (sessão)</span>
                {telemetry.successRate >= 85 ? (
                  <CheckCircle2 className="h-4 w-4 text-positive" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
                )}
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {telemetry.successRate.toFixed(0)}%
              </p>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    telemetry.successRate >= 85 ? 'bg-positive' : 'bg-warning'
                  }`}
                  style={{ width: `${Math.min(100, telemetry.successRate)}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-card/95 p-4 shadow-card">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Latência média</span>
                <Activity className="h-4 w-4 text-accent" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {telemetry.avgLatency > 0 ? `${telemetry.avgLatency} ms` : '—'}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                Pico na sessão: {telemetry.maxLatency > 0 ? `${telemetry.maxLatency} ms` : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-card/95 p-4 shadow-card">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Cobertura de ativos</span>
                <Server className="h-4 w-4 text-accent" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {coinCount}{' '}
                <span className="text-sm font-medium text-muted-foreground">/ 1000</span>
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                Ciclo automático a cada {preferences.refreshIntervalSec}s
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-card/95 p-4 shadow-card">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Cache local persistido</span>
                <HardDrive className="h-4 w-4 text-accent" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {cacheStats.kb} KB
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                {cacheStats.entries} {cacheStats.entries === 1 ? 'entrada ativa' : 'entradas ativas'}
              </p>
            </div>
          </div>

          {/* Providers Health Grid */}
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            {providers.map((p) => {
              const Icon = p.icon;
              const isOk = p.probe ? p.probe.status === 'ok' : p.fallbackOk;
              const statusText = p.probe
                ? p.probe.status === 'ok'
                  ? 'Online'
                  : 'Falha'
                : p.badge;

              return (
                <div
                  key={p.id}
                  className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/95 p-4 shadow-card transition-all hover:border-accent/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/12 text-accent">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                          p.probe?.status === 'err' || (p.id === 'coingecko' && isError)
                            ? 'bg-negative/15 text-negative'
                            : isOk && (p.probe || p.badge === 'Online')
                              ? 'bg-positive/15 text-positive'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {statusText}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{p.name}</h3>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{p.role}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] tabular-nums">
                    <span className="text-muted-foreground">
                      {p.lastSync ? formatTime(p.lastSync, preferences.timezone) : 'Sob demanda'}
                    </span>
                    <span className="font-semibold text-foreground">
                      {p.latency ? `${p.latency} ms` : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Latency Timeline Chart */}
          <div className="rounded-xl border border-border/80 bg-card/95 p-4 shadow-card">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Histórico de latência das requisições (ms)
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Últimas {Math.min(24, logs.length)} chamadas registradas nesta sessão
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {telemetry.okCount}/{telemetry.total} bem-sucedidas
              </span>
            </div>

            <div className="h-48 w-full">
              {latencySeries.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Aguardando requisições para traçar a curva de latência.
                </div>
              ) : (
                <ApexChartWrapper
                  type="area"
                  series={latencySeries}
                  options={latencyOptions}
                  height={192}
                />
              )}
            </div>
          </div>

          {/* Request Log Console */}
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-nav/60 px-4 py-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Registro de requisições ({filteredLogs.length})
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Filtrar serviço ou erro..."
                    className="h-8 w-48 rounded-lg border border-border/80 bg-background/85 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
                  />
                </div>

                <CustomSelect
                  ariaLabel="Filtrar estado das requisições"
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v as 'all' | 'ok' | 'err')}
                  searchable={false}
                  menuWidth={170}
                  className="h-8 w-40 bg-background/85"
                  options={[
                    { value: 'all', label: 'Todos os estados' },
                    { value: 'ok', label: 'Apenas sucesso' },
                    { value: 'err', label: 'Apenas falhas' },
                  ]}
                />

                <button
                  type="button"
                  onClick={handleExportLogsCsv}
                  disabled={filteredLogs.length === 0}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-background/85 px-3 text-xs font-medium text-foreground transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                Nenhuma requisição encontrada para este filtro nesta sessão.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 border-b border-border bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">Horário</th>
                      <th className="px-4 py-2.5">Serviço</th>
                      <th className="px-4 py-2.5">Resultado</th>
                      <th className="px-4 py-2.5 text-right">Duração</th>
                      <th className="px-4 py-2.5">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70 tabular-nums">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/35">
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatTime(log.timestamp, preferences.timezone)}
                        </td>
                        <td className="px-4 py-2 font-medium text-foreground">{log.service}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                              log.ok
                                ? 'bg-positive/15 text-positive'
                                : 'bg-negative/15 text-negative'
                            }`}
                          >
                            {log.status} {log.ok ? 'OK' : 'ERRO'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-foreground">
                          {log.durationMs} ms
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{log.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
