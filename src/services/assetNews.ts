export type ScrapedNewsOrigin = 'web' | 'crypto' | 'community';

export interface ScrapedNewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  origin: ScrapedNewsOrigin;
  publishedAt: number; // unix ms
  imageUrl?: string;
}

interface Rss2JsonItem {
  title?: string;
  pubDate?: string;
  link?: string;
  guid?: string;
  author?: string;
  thumbnail?: string;
  description?: string;
  content?: string;
  enclosure?: { link?: string };
}

interface Rss2JsonResponse {
  status?: string;
  feed?: { title?: string };
  items?: Rss2JsonItem[];
}

function stripHtml(raw: string): string {
  if (!raw) return '';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function unwrapBingUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes('bing.com')) {
      const target = parsed.searchParams.get('url');
      if (target) return target;
    }
  } catch {
    // ignore invalid URL
  }
  return rawUrl;
}

function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function matchesCoin(text: string, coinName: string, coinSymbol: string): boolean {
  const escapedSym = coinSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const symRegex = new RegExp(`\\b${escapedSym}\\b`, 'i');
  return text.toLowerCase().includes(coinName.toLowerCase()) || symRegex.test(text);
}

async function fetchRssViaJson(rssUrl: string): Promise<Rss2JsonResponse | null> {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = (await res.json()) as Rss2JsonResponse;
  if (data.status !== 'ok' || !Array.isArray(data.items)) return null;
  return data;
}

function parsePubDate(pubDate?: string): number {
  if (!pubDate) return Date.now();
  const normalized = pubDate.includes('T') ? pubDate : pubDate.replace(' ', 'T') + 'Z';
  const ts = Date.parse(normalized);
  if (Number.isFinite(ts)) return ts;
  const fallback = Date.parse(pubDate);
  return Number.isFinite(fallback) ? fallback : Date.now();
}

async function scrapeBingNewsWeb(coinName: string, coinSymbol: string): Promise<ScrapedNewsItem[]> {
  const symUpper = coinSymbol.toUpperCase();
  const queries = [
    `https://www.bing.com/news/search?q=${encodeURIComponent(`${coinName} ${symUpper} crypto`)}&format=rss`,
    `https://www.bing.com/news/search?q=${encodeURIComponent(`${coinName} ${symUpper} criptomoeda`)}&format=rss&mkt=pt-BR`,
  ];

  const results = await Promise.allSettled(queries.map((q) => fetchRssViaJson(q)));
  const collected: ScrapedNewsItem[] = [];

  for (const res of results) {
    if (res.status !== 'fulfilled' || !res.value?.items) continue;
    for (const item of res.value.items) {
      const title = stripHtml(item.title ?? '');
      const url = unwrapBingUrl(item.link ?? '');
      if (!title || !url) continue;

      const summary = stripHtml(item.description ?? item.content ?? '');
      const domain = extractDomain(url);
      const source = item.author?.trim() || domain || 'Web News';

      collected.push({
        id: `web-${item.guid || url}`,
        title,
        summary: summary && summary !== title ? summary.slice(0, 220) : '',
        url,
        source,
        origin: 'web',
        publishedAt: parsePubDate(item.pubDate),
        imageUrl: item.thumbnail || item.enclosure?.link || undefined,
      });
    }
  }

  return collected.slice(0, 16);
}

async function scrapeCryptoFeeds(coinName: string, coinSymbol: string): Promise<ScrapedNewsItem[]> {
  const feeds: { label: string; rssUrl: string }[] = [
    { label: 'Cointelegraph', rssUrl: 'https://cointelegraph.com/rss' },
    { label: 'Decrypt', rssUrl: 'https://decrypt.co/feed' },
    { label: 'CoinDesk', rssUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  ];

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const data = await fetchRssViaJson(feed.rssUrl);
      if (!data?.items) return [];
      const items: ScrapedNewsItem[] = [];

      for (const item of data.items) {
        const title = stripHtml(item.title ?? '');
        const summary = stripHtml(item.description ?? item.content ?? '');
        const url = item.link ?? '';
        if (!title || !url) continue;
        if (!matchesCoin(`${title} ${summary}`, coinName, coinSymbol)) continue;

        items.push({
          id: `crypto-${feed.label}-${item.guid || url}`,
          title,
          summary: summary && summary !== title ? summary.slice(0, 220) : '',
          url,
          source: feed.label,
          origin: 'crypto',
          publishedAt: parsePubDate(item.pubDate),
          imageUrl: item.thumbnail || item.enclosure?.link || undefined,
        });
      }
      return items;
    })
  );

  const collected: ScrapedNewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') collected.push(...r.value);
  }
  return collected.slice(0, 12);
}

async function scrapeHackerNews(coinName: string, coinSymbol: string): Promise<ScrapedNewsItem[]> {
  const query = `${coinName} ${coinSymbol.toUpperCase()}`;
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=15`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6500) });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    hits?: {
      objectID: string;
      title?: string;
      url?: string;
      story_text?: string;
      author?: string;
      created_at_i?: number;
      num_comments?: number;
      points?: number;
    }[];
  };

  return (json.hits ?? [])
    .filter((hit) => {
      if (!hit.title) return false;
      const hay = `${hit.title} ${hit.story_text ?? ''} ${hit.url ?? ''}`;
      return matchesCoin(hay, coinName, coinSymbol);
    })
    .slice(0, 10)
    .map((hit) => {
      const targetUrl =
        hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const meta = [
        hit.points != null ? `${hit.points} pts` : null,
        hit.num_comments != null ? `${hit.num_comments} comentários` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      return {
        id: `hn-${hit.objectID}`,
        title: hit.title ?? '',
        summary: hit.story_text ? stripHtml(hit.story_text).slice(0, 200) : meta,
        url: targetUrl,
        source: `Hacker News${hit.author ? ` · ${hit.author}` : ''}`,
        origin: 'community' as const,
        publishedAt: (hit.created_at_i ?? Math.floor(Date.now() / 1000)) * 1000,
      };
    });
}

export async function scrapeCoinNews(
  coinName: string,
  coinSymbol: string
): Promise<ScrapedNewsItem[]> {
  const [webRes, cryptoRes, communityRes] = await Promise.allSettled([
    scrapeBingNewsWeb(coinName, coinSymbol),
    scrapeCryptoFeeds(coinName, coinSymbol),
    scrapeHackerNews(coinName, coinSymbol),
  ]);

  const combined: ScrapedNewsItem[] = [
    ...(webRes.status === 'fulfilled' ? webRes.value : []),
    ...(cryptoRes.status === 'fulfilled' ? cryptoRes.value : []),
    ...(communityRes.status === 'fulfilled' ? communityRes.value : []),
  ];

  const seen = new Set<string>();
  const deduped: ScrapedNewsItem[] = [];

  for (const item of combined) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 64);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.sort((a, b) => b.publishedAt - a.publishedAt);
}
