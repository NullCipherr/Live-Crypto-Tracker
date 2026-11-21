import {
  Award,
  Coins,
  Cpu,
  ExternalLink,
  Globe,
  Layers,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { CoinMarket } from '../../types/crypto';
import type { CoinProfile } from '../../services/coingecko';
import { usePreferences } from '../../hooks/usePreferences';
import {
  formatCompactNumber,
  formatCurrencyUSD,
  formatPercent,
} from '../../lib/formatters';

interface AssetAboutTabProps {
  coin: CoinMarket;
  rangePct: number;
  profile: CoinProfile | undefined;
  isLoading: boolean;
  isError: boolean;
}

function formatIsoDatePtBr(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(ts);
}

export function AssetAboutTab({
  coin,
  rangePct,
  profile,
  isLoading,
  isError,
}: AssetAboutTabProps) {
  const { preferences } = usePreferences();

  const fmtOpts = {
    locale: preferences.numberLocale,
    decimalMode: preferences.decimalMode,
  };

  const turnoverPct =
    coin.marketCap > 0 ? (coin.totalVolume / coin.marketCap) * 100 : 0;

  const supplyRatioPct =
    profile?.circulatingSupply && profile?.maxSupply && profile.maxSupply > 0
      ? Math.min(100, (profile.circulatingSupply / profile.maxSupply) * 100)
      : null;

  const officialLinks = [
    profile?.homepage ? { label: 'Site oficial', url: profile.homepage } : null,
    profile?.explorer ? { label: 'Explorador de blocos', url: profile.explorer } : null,
    profile?.github ? { label: 'GitHub', url: profile.github } : null,
    profile?.subreddit ? { label: 'Comunidade Reddit', url: profile.subreddit } : null,
    {
      label: 'CoinGecko',
      url: `https://www.coingecko.com/pt/moedas/${encodeURIComponent(coin.id)}`,
    },
  ].filter((l): l is { label: string; url: string } => Boolean(l));

  return (
    <div className="space-y-4">
      {/* Editorial Summary + Categories */}
      <div className="rounded-xl border border-border/80 bg-card/95 p-5 shadow-card transition-colors hover:border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3.5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Resumo editorial · {coin.name} ({coin.symbol.toUpperCase()})
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Panorama de mercado, tokenomics e fundamentos em português
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile?.sentimentUpPct != null ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-positive/25 bg-positive/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-positive">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {Math.round(profile.sentimentUpPct)}% sentimento positivo
              </span>
            ) : null}
            <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              Fonte: CoinGecko
            </span>
          </div>
        </div>

        <p className="mt-3.5 max-w-4xl text-sm leading-relaxed text-foreground/95">
          <strong>{coin.name}</strong> ({coin.symbol.toUpperCase()}) ocupa atualmente a posição{' '}
          <strong>#{coin.marketCapRank}</strong> em capitalização de mercado, com valor de mercado
          de{' '}
          <strong>US$ {formatCompactNumber(coin.marketCap, preferences.numberLocale)}</strong> e
          volume negociado de{' '}
          <strong>US$ {formatCompactNumber(coin.totalVolume, preferences.numberLocale)}</strong> nas
          últimas 24 horas (giro de{' '}
          <strong className="font-mono">{turnoverPct.toFixed(2)}%</strong> sobre a capitalização).
          Neste momento, é negociado a{' '}
          <strong>{formatCurrencyUSD(coin.currentPrice, fmtOpts)}</strong>, posicionado nos{' '}
          <strong>{Math.round(rangePct)}%</strong> da faixa diária (entre{' '}
          {formatCurrencyUSD(coin.low24h, fmtOpts)} e {formatCurrencyUSD(coin.high24h, fmtOpts)}).
        </p>

        {profile?.categories && profile.categories.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-accent/80" aria-hidden="true" />
              Categorias:
            </span>
            {profile.categories.map((cat) => (
              <span
                key={cat}
                className="rounded-full border border-border/75 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-foreground/90 transition-colors hover:border-accent/40 hover:bg-accent/10"
              >
                {cat}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Tokenomics & Records Grid */}
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {/* Supply & Tokenomics */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/95 p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                Oferta & Emissão
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/12 text-accent">
                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <dl className="mt-3.5 space-y-2 text-xs tabular-nums">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Em circulação</dt>
                <dd className="font-mono font-medium text-foreground">
                  {profile?.circulatingSupply != null
                    ? `${formatCompactNumber(profile.circulatingSupply, preferences.numberLocale)} ${coin.symbol.toUpperCase()}`
                    : isLoading
                      ? 'Carregando...'
                      : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Oferta máxima</dt>
                <dd className="font-mono font-medium text-foreground">
                  {profile?.maxSupply != null
                    ? `${formatCompactNumber(profile.maxSupply, preferences.numberLocale)} ${coin.symbol.toUpperCase()}`
                    : profile
                      ? 'Ilimitada'
                      : '—'}
                </dd>
              </div>
              {profile?.fdvUsd != null ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Valuation diluído (FDV)</dt>
                  <dd className="font-mono font-medium text-foreground">
                    US$ {formatCompactNumber(profile.fdvUsd, preferences.numberLocale)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          {supplyRatioPct !== null ? (
            <div className="mt-3.5 border-t border-border/50 pt-2.5">
              <div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>Suprimento emitido</span>
                <span className="font-mono font-semibold text-foreground">
                  {supplyRatioPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${supplyRatioPct}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* All-Time High (ATH) */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/95 p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-positive/35">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                Máxima Histórica (ATH)
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-positive/12 text-positive">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3.5 font-mono text-xl font-semibold tracking-tight tabular-nums text-foreground">
              {profile?.athUsd != null
                ? formatCurrencyUSD(profile.athUsd, fmtOpts)
                : isLoading
                  ? 'Carregando...'
                  : '—'}
            </p>
          </div>
          <div className="mt-3 space-y-1 border-t border-border/50 pt-2.5 text-xs tabular-nums">
            <p
              className={`font-mono font-medium ${
                (profile?.athChangePct ?? 0) >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {profile?.athChangePct != null
                ? `${formatPercent(profile.athChangePct, preferences.numberLocale)} da máxima`
                : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Registrada em {formatIsoDatePtBr(profile?.athDate ?? null)}
            </p>
          </div>
        </div>

        {/* All-Time Low (ATL) */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/95 p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-negative/35">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                Mínima Histórica (ATL)
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-negative/12 text-negative">
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3.5 font-mono text-xl font-semibold tracking-tight tabular-nums text-foreground">
              {profile?.atlUsd != null
                ? formatCurrencyUSD(profile.atlUsd, fmtOpts)
                : isLoading
                  ? 'Carregando...'
                  : '—'}
            </p>
          </div>
          <div className="mt-3 space-y-1 border-t border-border/50 pt-2.5 text-xs tabular-nums">
            <p className="font-mono font-medium text-positive">
              {profile?.atlChangePct != null
                ? `${formatPercent(profile.atlChangePct, preferences.numberLocale)} desde a mínima`
                : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Registrada em {formatIsoDatePtBr(profile?.atlDate ?? null)}
            </p>
          </div>
        </div>

        {/* Technical Sheet */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/95 p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                Ficha Técnica
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/12 text-accent">
                <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            <dl className="mt-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Ranking global</dt>
                <dd className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
                  <Award className="h-3 w-3" aria-hidden="true" />
                  #{coin.marketCapRank}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Algoritmo</dt>
                <dd className="font-mono font-medium text-foreground">
                  {profile?.hashingAlgorithm || 'Não especificado'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Bloco gênese</dt>
                <dd className="font-mono font-medium text-foreground">
                  {profile?.genesisDate
                    ? formatIsoDatePtBr(profile.genesisDate)
                    : 'Não informado'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Full Description in pt-BR + Official Links */}
      <div className="rounded-xl border border-border/80 bg-card/95 p-5 shadow-card transition-colors hover:border-border">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Descrição completa do projeto
            </h3>
            {profile?.descriptionPt ? (
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
                {profile.isTranslated ? 'Traduzido para PT-BR' : 'Português'}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {officialLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 px-2.5 text-[11px] font-medium text-foreground shadow-sm transition-all hover:border-accent/50 hover:bg-accent/10 hover:text-accent"
              >
                <Globe className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <span>{link.label}</span>
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <div className="max-w-4xl space-y-3 text-xs leading-relaxed text-muted-foreground">
          {isLoading ? (
            <div className="animate-pulse space-y-2.5">
              <div className="h-3.5 w-full rounded bg-muted" />
              <div className="h-3.5 w-11/12 rounded bg-muted" />
              <div className="h-3.5 w-4/5 rounded bg-muted" />
            </div>
          ) : isError ? (
            <p>Não foi possível carregar os detalhes completos na CoinGecko no momento.</p>
          ) : profile?.descriptionPt ? (
            <p className="text-[13px] leading-7 text-foreground/90">{profile.descriptionPt}</p>
          ) : (
            <p>Descrição detalhada não disponível para este ativo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
