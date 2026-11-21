import { AlertTriangle } from 'lucide-react';
import { usePreferences } from '../../hooks/usePreferences';
import { PageHeader, HeaderButton } from '../shell/PageHeader';
import { formatPercent, formatPrice, formatTime } from '../../lib/formatters';
import type { AppPreferences } from '../../types/crypto';

interface PreferencesViewProps {
  fetchedAt?: number;
  isFetching?: boolean;
  isError?: boolean;
}

export function PreferencesView({
  fetchedAt,
  isFetching = false,
  isError = false,
}: PreferencesViewProps) {
  const { preferences, updatePreferences, setThemeWithAnimation, resetPreferences } =
    usePreferences();

  const samplePrice = 0.998558;
  const sampleDelta = -0.05;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Preferências"
        subtitle="Ajustes salvos localmente no navegador."
        actions={
          <HeaderButton onClick={resetPreferences}>
            Restaurar padrão
          </HeaderButton>
        }
      />
      <div className="flex-1 overflow-y-auto p-5 lg:p-6">
        <div className="mx-auto max-w-3xl space-y-5">

        {/* Status de sincronização */}
        <section className="rounded-md border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              {isError ? (
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
              ) : (
                <span
                  className={`h-2 w-2 rounded-full ${
                    isFetching ? 'animate-pulse bg-accent' : 'bg-positive'
                  }`}
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="font-semibold text-foreground">Status de sincronização</p>
                <p className={isError ? 'text-warning' : 'text-muted-foreground'}>
                  {isError
                    ? 'Falha na última tentativa de atualização automática.'
                    : isFetching
                      ? 'Sincronizando cotações agora...'
                      : `Atualização automática ativa a cada ${preferences.refreshIntervalSec}s`}
                </p>
              </div>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {fetchedAt
                ? `Última captura ${formatTime(fetchedAt, preferences.timezone)}`
                : 'Aguardando captura'}
            </span>
          </div>
        </section>

        {/* Aparência */}
        <section className="rounded-md border border-border bg-card shadow-card p-4 space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aparência
          </h2>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-foreground">Tema</span>
            <div className="inline-flex rounded border border-border bg-background p-0.5">
              {(
                [
                  { id: 'system', label: 'Sistema' },
                  { id: 'dark', label: 'Escuro' },
                  { id: 'light', label: 'Claro' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) =>
                    setThemeWithAnimation(opt.id, { x: e.clientX, y: e.clientY })
                  }
                  className={`rounded px-3 py-1 font-medium transition-colors ${
                    preferences.themeMode === opt.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-foreground">Densidade da tabela</span>
            <div className="inline-flex rounded border border-border bg-background p-0.5">
              {(
                [
                  { id: 'compact', label: 'Compacta (34 px)' },
                  { id: 'comfortable', label: 'Confortável (42 px)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updatePreferences({ density: opt.id })}
                  className={`rounded px-3 py-1 font-medium transition-colors ${
                    preferences.density === opt.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <label htmlFor="pref-motion" className="text-foreground">
              Movimento
            </label>
            <select
              id="pref-motion"
              value={preferences.reduceMotion}
              onChange={(e) =>
                updatePreferences({
                  reduceMotion: e.target.value as AppPreferences['reduceMotion'],
                })
              }
              className="h-8 rounded border border-border bg-background px-2.5 text-foreground"
            >
              <option value="system">Seguir sistema</option>
              <option value="reduce">Reduzido</option>
              <option value="no-preference">Normal</option>
            </select>
          </div>
        </section>

        {/* Formatação */}
        <section className="rounded-md border border-border bg-card shadow-card p-4 space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Formatação
          </h2>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <label htmlFor="pref-locale" className="text-foreground">
              Idioma dos números
            </label>
            <select
              id="pref-locale"
              value={preferences.numberLocale}
              onChange={(e) =>
                updatePreferences({
                  numberLocale: e.target.value as AppPreferences['numberLocale'],
                })
              }
              className="h-8 rounded border border-border bg-background px-2.5 text-foreground"
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <label htmlFor="pref-tz" className="text-foreground">
              Fuso horário
            </label>
            <select
              id="pref-tz"
              value={preferences.timezone}
              onChange={(e) => updatePreferences({ timezone: e.target.value })}
              className="h-8 rounded border border-border bg-background px-2.5 text-foreground"
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <label htmlFor="pref-dec" className="text-foreground">
              Casas decimais
            </label>
            <select
              id="pref-dec"
              value={preferences.decimalMode}
              onChange={(e) =>
                updatePreferences({
                  decimalMode: e.target.value as AppPreferences['decimalMode'],
                })
              }
              className="h-8 rounded border border-border bg-background px-2.5 text-foreground"
            >
              <option value="auto">Automáticas por ativo</option>
              <option value="fixed-2">Fixas (2 casas)</option>
            </select>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="text-muted-foreground">Prévia (USDT)</span>
            <span className="font-mono tabular-nums text-foreground">
              US${' '}
              {formatPrice(samplePrice, {
                locale: preferences.numberLocale,
                decimalMode: preferences.decimalMode,
              })}{' '}
              <span className="text-negative">
                {formatPercent(sampleDelta, preferences.numberLocale)}
              </span>
            </span>
          </div>
        </section>

        {/* Atualização */}
        <section className="rounded-md border border-border bg-card shadow-card p-4 space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Atualização
          </h2>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <label htmlFor="pref-interval" className="text-foreground">
              Intervalo das cotações
            </label>
            <select
              id="pref-interval"
              value={preferences.refreshIntervalSec}
              onChange={(e) =>
                updatePreferences({
                  refreshIntervalSec: Number(e.target.value) as AppPreferences['refreshIntervalSec'],
                })
              }
              className="h-8 rounded border border-border bg-background px-2.5 text-foreground"
            >
              <option value={60}>60 segundos</option>
              <option value={90}>90 segundos (recomendado · sem rate limit)</option>
              <option value={120}>120 segundos</option>
              <option value={300}>5 minutos (econômico)</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 text-xs">
            <span className="text-foreground">Atualizar dados vencidos ao voltar para a aba</span>
            <input
              type="checkbox"
              checked={preferences.refetchOnFocus}
              onChange={(e) => updatePreferences({ refetchOnFocus: e.target.checked })}
              className="accent-accent"
            />
          </label>
        </section>
      </div>
      </div>
    </div>
  );
}
