import { useMemo, useState } from 'react';
import { Edit2, Pause, Play, Plus, Trash2 } from 'lucide-react';
import type { AlertEvent, AlertRule, CoinMarket } from '../../types/crypto';
import {
  formatCurrencyUSD,
  formatDateTimeFull,
  formatPercent,
  formatPrice,
} from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { PageHeader, HeaderButton } from '../shell/PageHeader';

interface AlertsViewProps {
  coins: CoinMarket[];
  rules: AlertRule[];
  events: AlertEvent[];
  isError: boolean;
  onNewRule: () => void;
  onEditRule: (rule: AlertRule) => void;
  onToggleRuleStatus: (rule: AlertRule) => void;
  onDeleteRule: (id: string) => void;
}

export function AlertsView({
  coins,
  rules,
  events,
  isError,
  onNewRule,
  onEditRule,
  onToggleRuleStatus,
  onDeleteRule,
}: AlertsViewProps) {
  const { preferences } = usePreferences();
  const [tab, setTab] = useState<'rules' | 'history'>('rules');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [coinFilter, setCoinFilter] = useState<string>('all');
  const [daysFilter, setDaysFilter] = useState<'7' | '30' | 'all'>('7');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const coinMap = useMemo(() => new Map(coins.map((c) => [c.id, c])), [coins]);

  const filteredRules = useMemo(
    () =>
      rules.filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (coinFilter !== 'all' && r.coinId !== coinFilter) return false;
        return true;
      }),
    [coinFilter, rules, statusFilter]
  );

  const filteredEvents = useMemo(() => {
    const now = new Date().getTime();
    const cutoff =
      daysFilter === '7'
        ? now - 7 * 86_400_000
        : daysFilter === '30'
          ? now - 30 * 86_400_000
          : 0;

    return events.filter((e) => {
      if (cutoff > 0 && e.triggeredTimestamp < cutoff) return false;
      if (coinFilter !== 'all' && e.coinId !== coinFilter) return false;
      return true;
    });
  }, [coinFilter, daysFilter, events]);

  const formatMetricValue = (metric: AlertRule['metric'], val: number) =>
    metric === 'price'
      ? formatCurrencyUSD(val, fmtOpts)
      : formatPercent(val, preferences.numberLocale);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Alertas"
        subtitle="Regras de cruzamento avaliadas localmente a cada atualização válida."
        actions={
          <HeaderButton variant="primary" onClick={onNewRule}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Nova regra</span>
          </HeaderButton>
        }
      />
      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-5">

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 border-b border-border text-xs">
          <button
            type="button"
            onClick={() => setTab('rules')}
            className={`border-b-2 px-3 py-2 font-medium transition-colors ${
              tab === 'rules'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Regras ({rules.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`border-b-2 px-3 py-2 font-medium transition-colors ${
              tab === 'history'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Histórico de disparos ({events.length})
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {tab === 'rules' ? (
            <select
              aria-label="Filtrar por estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'paused')}
              className="h-7 rounded-md border border-border bg-card shadow-card px-2 text-foreground"
            >
              <option value="all">Todos os estados</option>
              <option value="active">Ativa</option>
              <option value="paused">Pausada</option>
            </select>
          ) : (
            <select
              aria-label="Filtrar por período"
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value as '7' | '30' | 'all')}
              className="h-7 rounded-md border border-border bg-card shadow-card px-2 text-foreground"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="all">Todo o histórico</option>
            </select>
          )}

          <select
            aria-label="Filtrar por ativo"
            value={coinFilter}
            onChange={(e) => setCoinFilter(e.target.value)}
            className="h-7 rounded-md border border-border bg-card shadow-card px-2 text-foreground"
          >
            <option value="all">Todos os ativos</option>
            {coins.map((c) => (
              <option key={c.id} value={c.id}>
                {c.symbol.toUpperCase()} — {c.name}
              </option>
            ))}
          </select>
        </div>

        {tab === 'rules' ? (
          <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
            {filteredRules.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                <p>Nenhuma regra cadastrada para este filtro.</p>
                <button
                  type="button"
                  onClick={onNewRule}
                  className="mt-3 h-8 rounded border border-border bg-background px-3 font-medium text-foreground hover:bg-muted"
                >
                  Criar primeira regra
                </button>
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-border bg-nav text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Ativo</th>
                    <th className="px-3 py-2">Condição</th>
                    <th className="px-3 py-2 text-right">Última leitura</th>
                    <th className="hidden px-3 py-2 sm:table-cell">Entrega</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {filteredRules.map((rule) => {
                    const coin = coinMap.get(rule.coinId);
                    const reading =
                      coin !== undefined
                        ? rule.metric === 'price'
                          ? coin.currentPrice
                          : coin.priceChange24h
                        : rule.lastReading;

                    return (
                      <tr key={rule.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2.5 font-mono font-semibold text-accent">
                          {coin ? coin.symbol.toUpperCase() : rule.coinId}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {rule.metric === 'price' ? 'Preço ' : 'Variação 24h '}
                          {rule.condition === 'cross_above' ? 'cruza acima de ' : 'cruza abaixo de '}
                          <span className="font-mono font-medium">
                            {formatMetricValue(rule.metric, rule.threshold)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-foreground">
                          {reading !== undefined ? formatMetricValue(rule.metric, reading) : '--'}
                        </td>
                        <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
                          No aplicativo ({rule.repeat === 'once' ? '1x' : 'Recorrente'})
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-medium ${
                              rule.status === 'active'
                                ? isError
                                  ? 'text-warning'
                                  : 'text-positive'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {rule.status === 'active'
                              ? isError
                                ? 'Suspensa (sem dados)'
                                : 'Ativa'
                              : 'Pausada'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onToggleRuleStatus(rule)}
                              aria-label={rule.status === 'active' ? 'Pausar regra' : 'Retomar regra'}
                              className="rounded border border-border p-1 text-muted-foreground hover:text-foreground"
                            >
                              {rule.status === 'active' ? (
                                <Pause className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <Play className="h-3 w-3" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditRule(rule)}
                              aria-label="Editar regra"
                              className="rounded border border-border p-1 text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRule(rule.id)}
                              aria-label="Excluir regra"
                              className="rounded border border-border p-1 text-muted-foreground hover:text-negative"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-nav px-3 py-2 text-[11px] text-muted-foreground">
              <span>Avaliação a cada atualização válida</span>
              <span>Monitor local em execução (requer aplicativo aberto)</span>
            </div>
          </div>
        ) : (
          /* 07 · Histórico de disparos */
          <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
            {filteredEvents.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                Nenhum disparo registrado para este período.
              </p>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-border bg-nav text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Horário</th>
                    <th className="px-3 py-2">Ativo</th>
                    <th className="px-3 py-2">Evento</th>
                    <th className="px-3 py-2 text-right">Leitura</th>
                    <th className="px-3 py-2 text-right">Entrega</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {filteredEvents.map((evt) => {
                    const expanded = expandedEventId === evt.id;
                    const linkedRule = rules.find((r) => r.id === evt.ruleId);
                    return (
                      <>
                        <tr
                          key={evt.id}
                          onClick={() => setExpandedEventId(expanded ? null : evt.id)}
                          className="cursor-pointer hover:bg-muted/30"
                        >
                          <td className="px-3 py-2 font-mono text-muted-foreground">
                            {formatDateTimeFull(evt.triggeredTimestamp, preferences.timezone)}
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-accent">
                            {evt.coinSymbol}
                          </td>
                          <td className="px-3 py-2 text-foreground">
                            {evt.condition === 'cross_above'
                              ? 'Cruzou acima de '
                              : 'Cruzou abaixo de '}
                            {formatMetricValue(evt.metric, evt.thresholdSnapshot)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-foreground">
                            {evt.metric === 'price'
                              ? formatPrice(evt.triggeredReading, fmtOpts)
                              : formatPercent(evt.triggeredReading, preferences.numberLocale)}
                          </td>
                          <td className="px-3 py-2 text-right text-positive">Exibido</td>
                        </tr>
                        {expanded ? (
                          <tr key={`${evt.id}-detail`} className="bg-background/60">
                            <td colSpan={5} className="px-4 py-3 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-1">
                                  <p className="text-muted-foreground">
                                    Leitura anterior:{' '}
                                    <span className="font-mono text-foreground">
                                      {formatMetricValue(evt.metric, evt.previousReading)}
                                    </span>{' '}
                                    em {formatDateTimeFull(evt.previousTimestamp, preferences.timezone)}
                                  </p>
                                  <p className="text-muted-foreground">
                                    Leitura do evento:{' '}
                                    <span className="font-mono text-foreground">
                                      {formatMetricValue(evt.metric, evt.triggeredReading)}
                                    </span>{' '}
                                    em {formatDateTimeFull(evt.triggeredTimestamp, preferences.timezone)}
                                  </p>
                                </div>
                                {linkedRule ? (
                                  <button
                                    type="button"
                                    onClick={() => onEditRule(linkedRule)}
                                    className="h-7 rounded-md border border-border bg-card shadow-card px-2.5 font-medium text-foreground hover:bg-muted"
                                  >
                                    Abrir regra
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
