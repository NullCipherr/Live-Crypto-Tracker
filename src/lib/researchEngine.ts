import type {
  CoinMarket,
  ResearchAnswerBlock,
  ResearchContextSnapshot,
  ResearchEvidenceRow,
} from '../types/crypto';
import { formatCompactNumber, formatCurrencyUSD, formatPercent } from './formatters';

function toEvidenceRow(coin: CoinMarket): ResearchEvidenceRow {
  return {
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    priceUsd: coin.currentPrice,
    change24h: coin.priceChange24h,
    volume24h: coin.totalVolume,
    marketCap: coin.marketCap,
  };
}

function findMentionedCoins(query: string, coins: CoinMarket[]): CoinMarket[] {
  const norm = query.toLowerCase();
  const matched: CoinMarket[] = [];
  for (const coin of coins) {
    const sym = coin.symbol.toLowerCase();
    const name = coin.name.toLowerCase();
    const symRegex = new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (symRegex.test(norm) || norm.includes(name)) {
      matched.push(coin);
    }
  }
  return matched;
}

export function runResearchQuery(
  question: string,
  context: ResearchContextSnapshot,
  locale: 'pt-BR' | 'en-US'
): ResearchAnswerBlock {
  const q = question.trim().toLowerCase();
  const coins = context.coins;

  if (coins.length === 0) {
    return {
      headline: 'Nenhum ativo disponível neste recorte.',
      summary:
        'A captura atual não possui ativos para analisar. Troque o contexto para o Monitor de mercado ou ajuste os filtros.',
    };
  }

  // 1. Missing daily history / multi-day volatility detection
  if (
    /volatilidade|90\s*dias|30\s*dias|7\s*dias|drawdown|hist[óo]rico|s[ée]rie\s*di[áa]ria/i.test(q)
  ) {
    return {
      headline: 'Série histórica não carregada nesta captura.',
      summary:
        'Esta captura contém dados de 24h (preço atual, variação 24h, volume 24h e capitalização). Selecione uma série diária no Analytics ou Detalhe do ativo para analisar períodos de 7, 30 ou 90 dias.',
      missingHistory: true,
      suggestedFollowups: [
        'Quais ativos mais caíram em 24 horas?',
        'Quais concentram o maior volume negociado?',
      ],
    };
  }

  // 2. Pairwise comparison if 2+ coins are explicitly mentioned
  const mentioned = findMentionedCoins(question, coins);
  if (
    mentioned.length >= 2 ||
    (/compar|versus|\bx\b|\bvs\b/i.test(q) && coins.length >= 2)
  ) {
    const a = mentioned[0] ?? coins[0];
    const b = mentioned[1] ?? coins[1];
    const volRatio =
      b.totalVolume > 0 ? (a.totalVolume / b.totalVolume).toFixed(2).replace('.', ',') : '—';
    const capRatio =
      b.marketCap > 0 ? (a.marketCap / b.marketCap).toFixed(2).replace('.', ',') : '—';

    return {
      headline: `${a.symbol.toUpperCase()} vs. ${b.symbol.toUpperCase()} neste recorte`,
      summary: `${a.name} (${formatPercent(a.priceChange24h, locale)} em 24h) movimentou US$ ${formatCompactNumber(a.totalVolume, locale)}, frente a US$ ${formatCompactNumber(b.totalVolume, locale)} de ${b.name} (${formatPercent(b.priceChange24h, locale)} em 24h). Em capitalização, a razão entre ${a.symbol.toUpperCase()} e ${b.symbol.toUpperCase()} é de ${capRatio}x.`,
      chartTitle: 'Volume negociado em 24h (comparação direta)',
      chartSubtitle: `${a.symbol.toUpperCase()} e ${b.symbol.toUpperCase()} nesta captura`,
      bars: [a, b].map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        value: c.totalVolume,
        formattedValue: `US$ ${formatCompactNumber(c.totalVolume, locale)}`,
        secondaryValue: formatPercent(c.priceChange24h, locale),
      })),
      evidence: {
        formula: `Razão de volume = US$ ${formatCompactNumber(a.totalVolume, locale)} ÷ US$ ${formatCompactNumber(b.totalVolume, locale)} ≈ ${volRatio}x · Razão de capitalização ≈ ${capRatio}x`,
        capturedAt: context.capturedAt,
        rows: [toEvidenceRow(a), toEvidenceRow(b)],
      },
      compareIds: [a.id, b.id],
    };
  }

  // 3. Volume leader / volume concentration
  if (/volume|liquidez|negociad|moviment/i.test(q)) {
    const byVol = [...coins].sort((a, b) => b.totalVolume - a.totalVolume);
    const byDrop = [...coins].sort((a, b) => a.priceChange24h - b.priceChange24h);
    const topVol = byVol[0];
    const worstDrop = byDrop[0];
    const top3 = byVol.slice(0, Math.min(5, byVol.length));
    const ratio =
      worstDrop.id !== topVol.id && worstDrop.totalVolume > 0
        ? topVol.totalVolume / worstDrop.totalVolume
        : byVol[1] && byVol[1].totalVolume > 0
          ? topVol.totalVolume / byVol[1].totalVolume
          : 1;

    const comparisonTarget = worstDrop.id !== topVol.id ? worstDrop : byVol[1] ?? topVol;
    const headline =
      worstDrop.id !== topVol.id && worstDrop.priceChange24h < 0
        ? `${topVol.symbol.toUpperCase()} liderou em volume. ${worstDrop.symbol.toUpperCase()} teve a maior queda.`
        : `${topVol.symbol.toUpperCase()} concentrou o maior volume negociado em 24h.`;

    const summary =
      comparisonTarget.id !== topVol.id
        ? `${topVol.name} movimentou US$ ${formatCompactNumber(topVol.totalVolume, locale)} em 24h, cerca de ${Math.round(ratio)} vezes o volume de ${comparisonTarget.name} (US$ ${formatCompactNumber(comparisonTarget.totalVolume, locale)}). No mesmo intervalo, ${topVol.symbol.toUpperCase()} variou ${formatPercent(topVol.priceChange24h, locale)} e ${comparisonTarget.symbol.toUpperCase()} variou ${formatPercent(comparisonTarget.priceChange24h, locale)}.`
        : `${topVol.name} registrou US$ ${formatCompactNumber(topVol.totalVolume, locale)} em volume nas últimas 24 horas, com variação de ${formatPercent(topVol.priceChange24h, locale)}.`;

    return {
      headline,
      summary,
      chartTitle: 'Volume negociado em 24h',
      chartSubtitle: `Maiores volumes entre os ${coins.length} ativos`,
      bars: top3.map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        value: c.totalVolume,
        formattedValue: `US$ ${formatCompactNumber(c.totalVolume, locale)}`,
        secondaryValue: formatPercent(c.priceChange24h, locale),
      })),
      evidence: {
        formula:
          comparisonTarget.id !== topVol.id
            ? `US$ ${formatCompactNumber(topVol.totalVolume, locale)} ÷ US$ ${formatCompactNumber(comparisonTarget.totalVolume, locale)} ≈ ${ratio.toFixed(2).replace('.', ',')}x`
            : `Volume 24h de ${topVol.symbol.toUpperCase()} = US$ ${formatCompactNumber(topVol.totalVolume, locale)}`,
        capturedAt: context.capturedAt,
        rows: top3.map(toEvidenceRow),
      },
      compareIds:
        comparisonTarget.id !== topVol.id ? [topVol.id, comparisonTarget.id] : undefined,
    };
  }

  // 4. Biggest drops / losers
  if (/ca[íi]r|queda|pior|negativ|baixa/i.test(q)) {
    const sorted = [...coins].sort((a, b) => a.priceChange24h - b.priceChange24h);
    const top = sorted.slice(0, Math.min(5, sorted.length));
    const worst = top[0];
    const second = top[1];

    return {
      headline: `${worst.symbol.toUpperCase()} registrou a maior queda (${formatPercent(worst.priceChange24h, locale)}).`,
      summary: second
        ? `Entre os ${coins.length} ativos do recorte, ${worst.name} recuou ${formatPercent(worst.priceChange24h, locale)} a ${formatCurrencyUSD(worst.currentPrice, { locale })}, seguida por ${second.name} (${formatPercent(second.priceChange24h, locale)}).`
        : `${worst.name} recuou ${formatPercent(worst.priceChange24h, locale)} nas últimas 24h.`,
      chartTitle: 'Maiores quedas em 24h',
      chartSubtitle: `Recorte de ${coins.length} ativos`,
      bars: top.map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        value: Math.abs(c.priceChange24h),
        formattedValue: formatPercent(c.priceChange24h, locale),
        secondaryValue: `US$ ${formatCompactNumber(c.totalVolume, locale)}`,
      })),
      evidence: {
        formula: `Ordenação crescente por priceChange24h em ${coins.length} ativos.`,
        capturedAt: context.capturedAt,
        rows: top.map(toEvidenceRow),
      },
      compareIds: second ? [worst.id, second.id] : undefined,
    };
  }

  // 5. Biggest gainers
  if (/subir|alta|melhor|positiv|ganh/i.test(q)) {
    const sorted = [...coins].sort((a, b) => b.priceChange24h - a.priceChange24h);
    const top = sorted.slice(0, Math.min(5, sorted.length));
    const best = top[0];
    const second = top[1];

    return {
      headline: `${best.symbol.toUpperCase()} lidera as altas com ${formatPercent(best.priceChange24h, locale)}.`,
      summary: second
        ? `${best.name} avançou ${formatPercent(best.priceChange24h, locale)} em 24h, à frente de ${second.name} (${formatPercent(second.priceChange24h, locale)}).`
        : `${best.name} variou ${formatPercent(best.priceChange24h, locale)} nas últimas 24h.`,
      chartTitle: 'Maiores altas em 24h',
      chartSubtitle: `Recorte de ${coins.length} ativos`,
      bars: top.map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        value: Math.max(0, c.priceChange24h),
        formattedValue: formatPercent(c.priceChange24h, locale),
        secondaryValue: `US$ ${formatCompactNumber(c.totalVolume, locale)}`,
      })),
      evidence: {
        formula: `Ordenação decrescente por priceChange24h em ${coins.length} ativos.`,
        capturedAt: context.capturedAt,
        rows: top.map(toEvidenceRow),
      },
      compareIds: second ? [best.id, second.id] : undefined,
    };
  }

  // 6. Market Cap / Summary fallback for general questions
  if (/resum|panorama|capitaliza|maior|vis[ãa]o|recorte|quantos/i.test(q)) {
    const up = coins.filter((c) => c.priceChange24h >= 0).length;
    const down = coins.length - up;
    const totalVol = coins.reduce((s, c) => s + c.totalVolume, 0);
    const totalCap = coins.reduce((s, c) => s + c.marketCap, 0);
    const topCap = [...coins].sort((a, b) => b.marketCap - a.marketCap).slice(0, 5);

    return {
      headline: `Panorama do recorte: ${up} em alta e ${down} em queda.`,
      summary: `Os ${coins.length} ativos analisados somam US$ ${formatCompactNumber(totalCap, locale)} em capitalização e US$ ${formatCompactNumber(totalVol, locale)} em volume nas últimas 24 horas.`,
      chartTitle: 'Maiores capitalizações no recorte',
      chartSubtitle: `${coins.length} ativos carregados`,
      bars: topCap.map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        value: c.marketCap,
        formattedValue: `US$ ${formatCompactNumber(c.marketCap, locale)}`,
        secondaryValue: formatPercent(c.priceChange24h, locale),
      })),
      evidence: {
        formula: `Soma(marketCap) = US$ ${formatCompactNumber(totalCap, locale)} · Soma(volume24h) = US$ ${formatCompactNumber(totalVol, locale)}`,
        capturedAt: context.capturedAt,
        rows: topCap.map(toEvidenceRow),
      },
    };
  }

  // 7. Out-of-scope / reformulation prompt
  return {
    headline: 'Pergunta fora do escopo desta captura.',
    summary:
      'No momento consigo ordenar, comparar e resumir os ativos carregados usando preço atual, variação em 24h, volume 24h e capitalização. Escolha uma das perguntas abaixo para analisar esta captura:',
    suggestedFollowups: [
      'Qual dessas quedas teve maior volume?',
      'Quais ativos mais caíram em 24 horas?',
      'Resuma o panorama deste recorte',
    ],
  };
}
