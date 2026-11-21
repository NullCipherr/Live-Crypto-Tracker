import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Globe, Newspaper, RefreshCw } from 'lucide-react';
import type { CoinMarket } from '../../types/crypto';
import { scrapeCoinNews, type ScrapedNewsOrigin } from '../../services/assetNews';
import { formatDateShort } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { HeaderSegmented } from '../shell/PageHeader';

const ORIGIN_LABELS: Record<ScrapedNewsOrigin, string> = {
  web: 'Web',
  crypto: 'Cripto',
  community: 'Comunidade',
};

export function AssetNewsTab({ coin }: { coin: CoinMarket }) {
  const { preferences } = usePreferences();
  const [originFilter, setOriginFilter] = useState<'all' | ScrapedNewsOrigin>('all');

  const {
    data: articles = [],
    isPending,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['asset-news-scrape', coin.id, coin.symbol],
    queryFn: () => scrapeCoinNews(coin.name, coin.symbol),
    staleTime: 5 * 60_000,
    gcTime: 20 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => {
    if (originFilter === 'all') return articles;
    return articles.filter((a) => a.origin === originFilter);
  }, [articles, originFilter]);

  const googleSearchUrl = `https://news.google.com/search?q=${encodeURIComponent(
    `${coin.name} ${coin.symbol.toUpperCase()} crypto`
  )}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Globe className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-foreground">
              Notícias da web · {coin.name} ({coin.symbol.toUpperCase()})
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isPending
                ? 'Varrendo fontes públicas da web (Bing News, portais cripto e Hacker News)...'
                : `${filtered.length} ${filtered.length === 1 ? 'resultado encontrado' : 'resultados encontrados'} · Bing News · Portais Cripto · Hacker News`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HeaderSegmented
            value={originFilter}
            onChange={setOriginFilter}
            tone="surface"
            options={[
              { id: 'all', label: 'Todas' },
              { id: 'web', label: 'Web' },
              { id: 'crypto', label: 'Cripto' },
              { id: 'community', label: 'Comunidade' },
            ]}
          />

          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-3 text-xs font-medium text-foreground shadow-card transition-all hover:border-accent/50 hover:bg-card disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-muted-foreground group-hover:text-accent ${
                isFetching ? 'animate-spin text-accent' : ''
              }`}
              aria-hidden="true"
            />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="animate-pulse space-y-2.5 rounded-lg border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
              <div className="h-4 w-5/6 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted/70" />
              <div className="h-3 w-2/3 rounded bg-muted/70" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-card">
          <Newspaper className="h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Nenhuma notícia encontrada neste filtro para {coin.name}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ativos menores podem ter pouca cobertura indexada nos feeds públicos no momento.
            </p>
          </div>
          <a
            href={googleSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card/85 px-3 text-xs font-medium text-accent shadow-card hover:border-accent/50 hover:bg-card"
          >
            <span>Pesquisar no Google News</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-card transition-all hover:border-accent/50 hover:bg-card/90"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
                      {ORIGIN_LABELS[item.origin]}
                    </span>
                    <span className="truncate font-medium text-muted-foreground">
                      {item.source}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {formatDateShort(item.publishedAt, preferences.timezone)}
                  </span>
                </div>

                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
                  {item.title}
                </h3>

                {item.summary ? (
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {item.summary}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-1 text-[11px] font-medium text-accent">
                <span>Ler matéria</span>
                <ExternalLink
                  className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
