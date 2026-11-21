export type PdfTemplateId =
  | 'caderno-executivo'
  | 'mesa-institucional'
  | 'radar-quant'
  | 'pulso-diario'
  | 'gestao-risco'
  | 'comparativo-ativos'
  | 'liquidez-fluxo'
  | 'auditoria-dados'
  | 'comite-semanal'
  | 'minimal-mono';

export interface PdfTemplateMeta {
  id: PdfTemplateId;
  name: string;
  pdfTitle: string;
  badge: string;
  description: string;
  accentHex: string;
  accentRgb: string;
  tintRgb: string;
}

export const PDF_TEMPLATES: PdfTemplateMeta[] = [
  {
    id: 'caderno-executivo',
    name: 'Caderno Executivo',
    pdfTitle: 'Caderno de Mercado',
    badge: 'EXECUTIVO',
    description: 'Layout equilibrado com sintese executiva e evolucao comparativa.',
    accentHex: '#0F766E',
    accentRgb: '0.059 0.463 0.431',
    tintRgb: '0.945 0.975 0.972',
  },
  {
    id: 'mesa-institucional',
    name: 'Mesa Institucional',
    pdfTitle: 'Relatorio Institucional de Mesa',
    badge: 'INSTITUCIONAL',
    description: 'Cabecalho formal para comites de alocacao e clientes.',
    accentHex: '#1E3A8A',
    accentRgb: '0.118 0.227 0.541',
    tintRgb: '0.945 0.960 0.988',
  },
  {
    id: 'radar-quant',
    name: 'Radar Quantitativo',
    pdfTitle: 'Radar Quantitativo de Ativos',
    badge: 'QUANT',
    description: 'Foco em dispersao de retorno, amplitude e sinais estatisticos.',
    accentHex: '#4F46E5',
    accentRgb: '0.310 0.275 0.898',
    tintRgb: '0.955 0.952 0.992',
  },
  {
    id: 'pulso-diario',
    name: 'Boletim Diario',
    pdfTitle: 'Boletim Diario de Mercado',
    badge: 'DIARIO',
    description: 'Leitura rapida de fechamento com destaques de alta e volume.',
    accentHex: '#059669',
    accentRgb: '0.020 0.588 0.412',
    tintRgb: '0.940 0.980 0.965',
  },
  {
    id: 'gestao-risco',
    name: 'Gestao de Risco',
    pdfTitle: 'Boletim de Risco & Volatilidade',
    badge: 'RISCO',
    description: 'Enfase em amplitude de preco, protecao e exposicao.',
    accentHex: '#D97706',
    accentRgb: '0.851 0.467 0.024',
    tintRgb: '0.992 0.970 0.940',
  },
  {
    id: 'comparativo-ativos',
    name: 'Comparativo de Ativos',
    pdfTitle: 'Estudo Comparativo de Ativos',
    badge: 'COMPARATIVO',
    description: 'Contraste direto de desempenho relativo entre moedas.',
    accentHex: '#0891B2',
    accentRgb: '0.031 0.569 0.698',
    tintRgb: '0.940 0.978 0.988',
  },
  {
    id: 'liquidez-fluxo',
    name: 'Liquidez & Fluxo',
    pdfTitle: 'Analise de Liquidez & Fluxo',
    badge: 'LIQUIDEZ',
    description: 'Destaque para volume financeiro acumulado e giro diario.',
    accentHex: '#7C3AED',
    accentRgb: '0.486 0.227 0.929',
    tintRgb: '0.968 0.950 0.992',
  },
  {
    id: 'auditoria-dados',
    name: 'Auditoria & Dados',
    pdfTitle: 'Dossie Tecnico de Dados',
    badge: 'AUDITORIA',
    description: 'Formato sobrio voltado a conferencia de registros e fechamentos.',
    accentHex: '#334155',
    accentRgb: '0.200 0.255 0.333',
    tintRgb: '0.960 0.965 0.972',
  },
  {
    id: 'comite-semanal',
    name: 'Comite Semanal',
    pdfTitle: 'Briefing de Comite Semanal',
    badge: 'COMITE',
    description: 'Sintese estrategica para reunioes semanais de decisao.',
    accentHex: '#BE123C',
    accentRgb: '0.745 0.071 0.235',
    tintRgb: '0.990 0.948 0.958',
  },
  {
    id: 'minimal-mono',
    name: 'Minimalista Mono',
    pdfTitle: 'Relatorio Minimalista P&B',
    badge: 'MINIMAL',
    description: 'Alto contraste em preto e cinza otimizado para impressao.',
    accentHex: '#111827',
    accentRgb: '0.067 0.094 0.153',
    tintRgb: '0.965 0.965 0.968',
  },
];

export interface ReportObservation {
  date: string; // YYYY-MM-DD
  ticker: string;
  close: number;
  volume: number;
}

export interface ReportConfig {
  sourceLabel: string;
  startDate: string;
  endDate: string;
  tickers: string[];
  includeSummary: boolean;
  includePerformance: boolean;
  includeIndicators?: boolean;
  includeAppendix: boolean;
  templateId?: PdfTemplateId;
}

export interface GeneratedPdfResult {
  blob: Blob;
  pageCount: number;
  observationCount: number;
  dateCount: number;
}

const DARK_RGB = '0.098 0.118 0.149';
const MUTED_RGB = '0.380 0.420 0.480';
const BORDER_RGB = '0.820 0.845 0.880';
const SERIES_RGB = [
  '0.059 0.463 0.431', // teal
  '0.145 0.388 0.922', // blue
  '0.851 0.467 0.024', // amber
  '0.576 0.200 0.918', // purple
  '0.863 0.149 0.149', // red
  '0.031 0.569 0.698', // cyan
  '0.020 0.588 0.412', // emerald
  '0.745 0.071 0.235', // crimson
  '0.310 0.275 0.898', // indigo
  '0.918 0.345 0.047', // orange
];

export function generateDemoObservations(): ReportObservation[] {
  const bases: Record<string, { price: number; vol: number; drift: number; amp: number }> = {
    BTC: { price: 56733.91, vol: 42.5e9, drift: 0.0013, amp: 0.014 },
    ETH: { price: 1660.18, vol: 17.8e9, drift: -0.0007, amp: 0.021 },
    SOL: { price: 122.66, vol: 4.9e9, drift: 0.0035, amp: 0.031 },
    BNB: { price: 542.4, vol: 1.9e9, drift: 0.0018, amp: 0.016 },
    XRP: { price: 0.54, vol: 1.6e9, drift: 0.0022, amp: 0.028 },
    ADA: { price: 0.36, vol: 0.48e9, drift: -0.0011, amp: 0.025 },
    DOGE: { price: 0.14, vol: 1.4e9, drift: 0.0041, amp: 0.038 },
    AVAX: { price: 27.85, vol: 0.52e9, drift: 0.0015, amp: 0.029 },
    TRX: { price: 0.16, vol: 0.41e9, drift: 0.0026, amp: 0.015 },
    LINK: { price: 11.45, vol: 0.39e9, drift: 0.0029, amp: 0.024 },
  };

  const rows: ReportObservation[] = [];
  for (let day = 1; day <= 31; day++) {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    for (const [ticker, cfg] of Object.entries(bases)) {
      const wave = Math.sin(day * 0.45 + ticker.charCodeAt(0)) * cfg.amp;
      const close = Number((cfg.price * (1 + cfg.drift * (day - 1) + wave)).toFixed(2));
      const volume = Math.round(cfg.vol * (0.85 + Math.abs(Math.cos(day * 0.35)) * 0.45));
      rows.push({ date, ticker, close, volume });
    }
  }
  return rows;
}

export function parseReportCsv(text: string): ReportObservation[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const rows: ReportObservation[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map((s) => s.replace(/^"|"$/g, '').trim());
    if (parts.length < 3) continue;
    const date = parts[0];
    const ticker = parts[1].toUpperCase();
    const close = Number(parts[2].replace(',', '.'));
    const volume = parts[3] ? Number(parts[3].replace(',', '.')) : 0;
    if (date && ticker && Number.isFinite(close) && close > 0) {
      rows.push({ date, ticker, close, volume: Number.isFinite(volume) ? volume : 0 });
    }
  }
  return rows;
}

function escapePdfText(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code === 92) out += '\\\\';
    else if (code === 40) out += '\\(';
    else if (code === 41) out += '\\)';
    else if (code >= 32 && code <= 126) out += input[i];
    else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, '0')}`;
    else if (code === 8722) out += '-'; // minus sign
    else out += '?';
  }
  return out;
}

function fmtUsd(val: number): string {
  return `US$ ${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: val < 2 ? 4 : 2,
  }).format(val)}`;
}

function fmtBi(val: number): string {
  const bi = val / 1e9;
  return `US$ ${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(bi)} bi`;
}

function fmtPct(val: number): string {
  const sign = val > 0 ? '+' : val < 0 ? '-' : '';
  return `${sign}${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(val))}%`;
}

function fmtDateBr(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function buildMarketNotebookPdf(
  allObservations: ReportObservation[],
  config: ReportConfig
): GeneratedPdfResult {
  const template =
    PDF_TEMPLATES.find((t) => t.id === config.templateId) ?? PDF_TEMPLATES[0];
  const accentRgb = template.accentRgb;
  const tintRgb = template.tintRgb;

  const tickerSet = new Set(config.tickers);
  const filtered = allObservations
    .filter(
      (o) =>
        tickerSet.has(o.ticker) &&
        (!config.startDate || o.date >= config.startDate) &&
        (!config.endDate || o.date <= config.endDate)
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));

  const uniqueDates = Array.from(new Set(filtered.map((o) => o.date))).sort();
  const activeTickers = config.tickers.filter((t) => filtered.some((o) => o.ticker === t));

  // Per-ticker summary + technical indicators
  const tickerStats = activeTickers.map((ticker) => {
    const pts = filtered.filter((o) => o.ticker === ticker);
    const closes = pts.map((p) => p.close);
    const startClose = closes[0] ?? 0;
    const endClose = closes[closes.length - 1] ?? 0;
    const retPct = startClose > 0 ? ((endClose - startClose) / startClose) * 100 : 0;
    const totalVol = pts.reduce((s, p) => s + p.volume, 0);

    // Step returns, volatility & max drawdown
    const stepRets: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1];
      stepRets.push(prev > 0 ? (closes[i] - prev) / prev : 0);
    }
    const meanRet = stepRets.length > 0 ? stepRets.reduce((a, b) => a + b, 0) / stepRets.length : 0;
    const variance =
      stepRets.length > 1
        ? stepRets.reduce((acc, r) => acc + (r - meanRet) ** 2, 0) / (stepRets.length - 1)
        : 0;
    const volatilityPct = Math.sqrt(variance) * Math.sqrt(Math.max(1, stepRets.length)) * 100;

    let peak = closes[0] ?? 0;
    let maxDrawdownPct = 0;
    for (const c of closes) {
      if (c > peak) peak = c;
      if (peak > 0) {
        const dd = ((c - peak) / peak) * 100;
        if (dd < maxDrawdownPct) maxDrawdownPct = dd;
      }
    }

    // RSI 14
    let rsi14: number | null = null;
    if (closes.length > 14) {
      let gains = 0;
      let losses = 0;
      for (let i = 1; i <= 14; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
      }
      let avgG = gains / 14;
      let avgL = losses / 14;
      for (let i = 15; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        avgG = (avgG * 13 + (diff >= 0 ? diff : 0)) / 14;
        avgL = (avgL * 13 + (diff < 0 ? Math.abs(diff) : 0)) / 14;
      }
      rsi14 = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    }

    // EMA 9 vs EMA 21
    const calcEma = (period: number) => {
      if (closes.length === 0) return 0;
      const k = 2 / (period + 1);
      let ema = closes[0];
      for (let i = 1; i < closes.length; i++) {
        ema = closes[i] * k + ema * (1 - k);
      }
      return ema;
    };
    const ema9 = calcEma(9);
    const ema21 = calcEma(21);
    const trendSignal = ema9 > ema21 * 1.001 ? 'Alta' : ema9 < ema21 * 0.999 ? 'Baixa' : 'Neutra';

    return {
      ticker,
      pts,
      stepRets,
      startClose,
      endClose,
      retPct,
      totalVol,
      volatilityPct,
      maxDrawdownPct,
      rsi14,
      trendSignal,
    };
  });

  const totalVolume = filtered.reduce((s, o) => s + o.volume, 0);
  const topHighlight = [...tickerStats].sort((a, b) => b.retPct - a.retPct)[0];
  const avgVolPct =
    tickerStats.length > 0
      ? tickerStats.reduce((s, t) => s + t.volatilityPct, 0) / tickerStats.length
      : 0;
  const positiveAssetsCount = tickerStats.filter((t) => t.retPct > 0).length;

  // A4 Portrait: 595.28 x 841.89 pt
  const W = 595.28;
  const H = 841.89;
  const ML = 48;
  const MR = 48;
  const CW = W - ML - MR;

  const pages: string[] = [];
  let cmds: string[] = [];
  let y = 760;

  const drawText = (
    x: number,
    yPos: number,
    text: string,
    font: 'F1' | 'F2' | 'F3' | 'F4',
    size: number,
    rgb = DARK_RGB
  ) => {
    cmds.push(`BT /${font} ${size} Tf ${rgb} rg 1 0 0 1 ${x.toFixed(2)} ${yPos.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
  };

  const drawRightText = (
    rightX: number,
    yPos: number,
    text: string,
    font: 'F1' | 'F2' | 'F3' | 'F4',
    size: number,
    rgb = DARK_RGB
  ) => {
    // Approximate width for right alignment in Helvetica/Times
    const avgCharWidth = font === 'F4' ? size * 0.52 : size * 0.48;
    const estWidth = text.length * avgCharWidth;
    drawText(rightX - estWidth, yPos, text, font, size, rgb);
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, lw = 0.75, rgb = BORDER_RGB) => {
    cmds.push(`${lw} w ${rgb} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, rgb: string) => {
    cmds.push(`${rgb} rg ${x.toFixed(2)} ${yPos.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  };

  const startNewPage = () => {
    if (cmds.length > 0) pages.push(cmds.join('\n'));
    cmds = [];
    // Brand header on every page
    drawRect(ML, H - 46, 22, 14, accentRgb);
    drawText(ML + 4, H - 42, 'LCT', 'F2', 8, '1 1 1');
    drawText(ML + 28, H - 42, `LIVE CRYPTO TRACKER  ·  ${template.badge}`, 'F2', 9, DARK_RGB);
    drawRightText(
      W - MR,
      H - 42,
      `${fmtDateBr(config.startDate)} - ${fmtDateBr(config.endDate)}`,
      'F1',
      8,
      MUTED_RGB
    );
    drawLine(ML, H - 54, W - MR, H - 54, 1.5, accentRgb);
    y = H - 82;
  };

  startNewPage();

  // Title Block
  drawText(ML, y, template.pdfTitle, 'F3', 20, DARK_RGB);
  y -= 18;
  drawText(
    ML,
    y,
    `Modelo: ${template.name}  |  Periodo: ${fmtDateBr(config.startDate)} a ${fmtDateBr(config.endDate)}  |  ${activeTickers.length} ativos`,
    'F1',
    9.5,
    MUTED_RGB
  );
  y -= 26;

  // Section 1: Síntese de mercado
  if (config.includeSummary) {
    drawText(ML, y, 'SINTESE DE MERCADO', 'F2', 9, accentRgb);
    y -= 16;

    // KPI boxes (4 cards in 2x2 grid)
    const boxW = (CW - 16) / 2;
    drawRect(ML, y - 38, boxW, 42, tintRgb);
    drawText(ML + 10, y - 10, 'VOLUME ACUMULADO', 'F1', 7.5, MUTED_RGB);
    drawText(ML + 10, y - 28, fmtBi(totalVolume), 'F2', 13, DARK_RGB);

    drawRect(ML + boxW + 16, y - 38, boxW, 42, tintRgb);
    drawText(ML + boxW + 26, y - 10, 'DESTAQUE DO PERIODO', 'F1', 7.5, MUTED_RGB);
    drawText(
      ML + boxW + 26,
      y - 28,
      topHighlight ? `${topHighlight.ticker} (${fmtPct(topHighlight.retPct)})` : '--',
      'F2',
      13,
      DARK_RGB
    );
    y -= 50;

    drawRect(ML, y - 38, boxW, 42, tintRgb);
    drawText(ML + 10, y - 10, 'VOLATILIDADE MEDIA', 'F1', 7.5, MUTED_RGB);
    drawText(ML + 10, y - 28, `${avgVolPct.toFixed(2)}%`, 'F2', 13, DARK_RGB);

    drawRect(ML + boxW + 16, y - 38, boxW, 42, tintRgb);
    drawText(ML + boxW + 26, y - 10, 'AMPLITUDE POSITIVA', 'F1', 7.5, MUTED_RGB);
    drawText(
      ML + boxW + 26,
      y - 28,
      `${positiveAssetsCount} / ${tickerStats.length} ativos em alta`,
      'F2',
      12,
      DARK_RGB
    );
    y -= 58;

    drawText(ML, y, 'Retorno por ativo no periodo', 'F3', 12, DARK_RGB);
    y -= 18;

    const maxAbsRet = Math.max(...tickerStats.map((t) => Math.abs(t.retPct)), 1);
    for (const stat of tickerStats) {
      drawText(ML, y, stat.ticker, 'F2', 9.5, DARK_RGB);
      const barMaxW = CW - 140;
      const barW = Math.max((Math.abs(stat.retPct) / maxAbsRet) * barMaxW, 4);
      const barColor = stat.retPct >= 0 ? accentRgb : '0.780 0.160 0.220';
      drawRect(ML + 48, y - 1, barW, 8, barColor);
      drawRightText(W - MR, y, fmtPct(stat.retPct), 'F1', 9.5, DARK_RGB);
      y -= 18;
    }
    y -= 14;
  }

  // Section 2: Desempenho relativo
  if (config.includePerformance && tickerStats.length > 0) {
    if (y < 290) startNewPage();

    drawText(ML, y, 'DESEMPENHO RELATIVO', 'F2', 9, accentRgb);
    y -= 16;
    drawText(ML, y, 'Retorno acumulado (%) no periodo', 'F3', 12, DARK_RGB);
    y -= 14;

    // Vector Chart Box
    const chartX = ML + 36;
    const chartW = CW - 44;
    const chartH = 130;
    const chartBottom = y - chartH;

    // Compute normalized series
    let minRet = 0;
    let maxRet = 0;
    const seriesPoints = tickerStats.map((stat) => {
      const base = stat.startClose || 1;
      return stat.pts.map((pt, i) => {
        const ret = ((pt.close - base) / base) * 100;
        if (ret < minRet) minRet = ret;
        if (ret > maxRet) maxRet = ret;
        return { i, ret, date: pt.date };
      });
    });

    const span = maxRet - minRet || 1;
    // Gridlines
    drawLine(chartX, chartBottom, chartX + chartW, chartBottom, 0.75, DARK_RGB);
    drawLine(chartX, chartBottom, chartX, chartBottom + chartH, 0.75, DARK_RGB);
    const zeroY = chartBottom + ((0 - minRet) / span) * chartH;
    drawLine(chartX, zeroY, chartX + chartW, zeroY, 0.5, MUTED_RGB);

    drawRightText(chartX - 4, chartBottom + chartH - 4, fmtPct(maxRet), 'F1', 7.5, MUTED_RGB);
    drawRightText(chartX - 4, zeroY - 2, '0,00%', 'F1', 7.5, MUTED_RGB);
    drawRightText(chartX - 4, chartBottom, fmtPct(minRet), 'F1', 7.5, MUTED_RGB);

    // Plot vector polylines
    seriesPoints.forEach((pts, sIdx) => {
      if (pts.length < 2) return;
      const rgb = SERIES_RGB[sIdx % SERIES_RGB.length];
      let path = `1.2 w ${rgb} RG `;
      pts.forEach((p, idx) => {
        const px = chartX + (idx / (pts.length - 1)) * chartW;
        const py = chartBottom + ((p.ret - minRet) / span) * chartH;
        path += `${px.toFixed(2)} ${py.toFixed(2)} ${idx === 0 ? 'm' : 'l'} `;
      });
      path += 'S';
      cmds.push(path);
    });

    y = chartBottom - 14;
    // Legend (wrap to second line when > 5 tickers)
    let lx = chartX;
    tickerStats.forEach((stat, idx) => {
      if (lx + 48 > W - MR) {
        lx = chartX;
        y -= 13;
      }
      const rgb = SERIES_RGB[idx % SERIES_RGB.length];
      drawRect(lx, y, 8, 6, rgb);
      drawText(lx + 12, y, stat.ticker, 'F2', 8, DARK_RGB);
      lx += 48;
    });
    y -= 20;

    // Performance Summary Table
    drawLine(ML, y + 10, W - MR, y + 10, 0.75, DARK_RGB);
    drawText(ML, y, 'Ativo', 'F2', 8.5, MUTED_RGB);
    drawRightText(ML + 220, y, 'Fech. Inicial', 'F2', 8.5, MUTED_RGB);
    drawRightText(ML + 360, y, 'Fech. Final', 'F2', 8.5, MUTED_RGB);
    drawRightText(W - MR, y, 'Retorno', 'F2', 8.5, MUTED_RGB);
    y -= 6;
    drawLine(ML, y, W - MR, y, 0.5, BORDER_RGB);
    y -= 14;

    for (const stat of tickerStats) {
      drawText(ML, y, stat.ticker, 'F2', 9, DARK_RGB);
      drawRightText(ML + 220, y, fmtUsd(stat.startClose), 'F1', 9, DARK_RGB);
      drawRightText(ML + 360, y, fmtUsd(stat.endClose), 'F1', 9, DARK_RGB);
      drawRightText(W - MR, y, fmtPct(stat.retPct), 'F2', 9, DARK_RGB);
      y -= 16;
    }
    y -= 14;
  }

  // Section 2.5: Indicadores Técnicos, Liquidez, Drawdown & Correlação
  if (config.includeIndicators !== false && tickerStats.length > 0) {
    if (y < 320) startNewPage();

    drawText(ML, y, 'INDICADORES TECNICOS E LIQUIDEZ', 'F2', 9, accentRgb);
    y -= 16;
    drawText(ML, y, 'Participacao de volume (%) e risco por ativo', 'F3', 12, DARK_RGB);
    y -= 18;

    // Volume Share Chart
    const safeTotalVol = totalVolume > 0 ? totalVolume : 1;
    tickerStats.forEach((stat, idx) => {
      const sharePct = (stat.totalVol / safeTotalVol) * 100;
      const rgb = SERIES_RGB[idx % SERIES_RGB.length];
      drawText(ML, y, stat.ticker, 'F2', 9, DARK_RGB);
      const barMaxW = CW - 165;
      const barW = Math.max((sharePct / 100) * barMaxW, 4);
      drawRect(ML + 48, y - 1, barW, 8, rgb);
      drawRightText(W - MR, y, `${sharePct.toFixed(1)}% (${fmtBi(stat.totalVol)})`, 'F1', 8.5, DARK_RGB);
      y -= 17;
    });
    y -= 12;

    // Drawdown Bars Chart
    drawText(ML, y, 'Maximo Drawdown (%) no periodo', 'F3', 11.5, DARK_RGB);
    y -= 16;
    const maxAbsDd = Math.max(...tickerStats.map((t) => Math.abs(t.maxDrawdownPct)), 1);
    for (const stat of tickerStats) {
      drawText(ML, y, stat.ticker, 'F2', 9, DARK_RGB);
      const barMaxW = CW - 140;
      const barW = Math.max((Math.abs(stat.maxDrawdownPct) / maxAbsDd) * barMaxW, 4);
      drawRect(ML + 48, y - 1, barW, 8, '0.780 0.160 0.220');
      drawRightText(W - MR, y, fmtPct(stat.maxDrawdownPct), 'F1', 9, DARK_RGB);
      y -= 16;
    }
    y -= 12;

    if (y < 180) startNewPage();

    // Technical Indicators Table (Volatilidade, Drawdown, RSI 14, EMA Trend)
    drawText(ML, y, 'Painel de indicadores tecnicos', 'F3', 11.5, DARK_RGB);
    y -= 14;
    drawLine(ML, y + 10, W - MR, y + 10, 0.75, DARK_RGB);
    drawText(ML, y, 'Ativo', 'F2', 8.5, MUTED_RGB);
    drawRightText(ML + 145, y, 'Volatilidade', 'F2', 8.5, MUTED_RGB);
    drawRightText(ML + 255, y, 'Drawdown', 'F2', 8.5, MUTED_RGB);
    drawRightText(ML + 365, y, 'RSI (14)', 'F2', 8.5, MUTED_RGB);
    drawRightText(W - MR, y, 'Sinal EMA 9/21', 'F2', 8.5, MUTED_RGB);
    y -= 6;
    drawLine(ML, y, W - MR, y, 0.5, BORDER_RGB);
    y -= 14;

    for (const stat of tickerStats) {
      drawText(ML, y, stat.ticker, 'F2', 9, DARK_RGB);
      drawRightText(ML + 145, y, `${stat.volatilityPct.toFixed(2)}%`, 'F1', 9, DARK_RGB);
      drawRightText(ML + 255, y, fmtPct(stat.maxDrawdownPct), 'F1', 9, DARK_RGB);
      drawRightText(
        ML + 365,
        y,
        stat.rsi14 !== null ? stat.rsi14.toFixed(1) : '--',
        'F1',
        9,
        DARK_RGB
      );
      drawRightText(W - MR, y, stat.trendSignal, 'F2', 9, accentRgb);
      y -= 16;
    }
    y -= 12;

    // Correlation Matrix when 2+ tickers
    if (tickerStats.length > 1) {
      if (y < 140) startNewPage();
      drawText(ML, y, 'Matriz de correlacao (Pearson)', 'F3', 11.5, DARK_RGB);
      y -= 15;

      const calcPearson = (a: number[], b: number[]) => {
        const len = Math.min(a.length, b.length);
        if (len < 3) return null;
        const mA = a.slice(0, len).reduce((s, v) => s + v, 0) / len;
        const mB = b.slice(0, len).reduce((s, v) => s + v, 0) / len;
        let num = 0;
        let dA = 0;
        let dB = 0;
        for (let i = 0; i < len; i++) {
          const da = a[i] - mA;
          const db = b[i] - mB;
          num += da * db;
          dA += da * da;
          dB += db * db;
        }
        const den = Math.sqrt(dA * dB);
        return den > 0 ? Math.max(-1, Math.min(1, num / den)) : null;
      };

      const colStep = Math.min(44, (CW - 72) / tickerStats.length);
      const corrFontSize = tickerStats.length > 6 ? 7.5 : 8.5;
      drawText(ML, y, 'Ativo', 'F2', corrFontSize, MUTED_RGB);
      tickerStats.forEach((col, cIdx) => {
        drawRightText(ML + 86 + cIdx * colStep, y, col.ticker, 'F2', corrFontSize, MUTED_RGB);
      });
      y -= 6;
      drawLine(ML, y, W - MR, y, 0.5, BORDER_RGB);
      y -= 14;

      tickerStats.forEach((row, rIdx) => {
        if (y < 70) startNewPage();
        drawText(ML, y, row.ticker, 'F2', corrFontSize, DARK_RGB);
        tickerStats.forEach((col, cIdx) => {
          const corr = rIdx === cIdx ? 1 : calcPearson(row.stepRets, col.stepRets);
          drawRightText(
            ML + 86 + cIdx * colStep,
            y,
            corr !== null ? corr.toFixed(2) : '--',
            rIdx === cIdx ? 'F2' : 'F1',
            corrFontSize,
            rIdx === cIdx ? MUTED_RGB : DARK_RGB
          );
        });
        y -= 14;
      });
      y -= 10;
    }

    // Section 2.6: Volume Diário (Colunas), Risco x Retorno & Simulação de Carteira
    startNewPage();
    drawText(ML, y, 'ANALISE AVANCADA E SIMULACAO', 'F2', 9, accentRgb);
    y -= 16;

    // Chart A: Daily Total Volume Vertical Bars
    if (uniqueDates.length > 1) {
      drawText(ML, y, 'Volume diario agregado (US$ bi)', 'F3', 11.5, DARK_RGB);
      y -= 14;
      const volChartX = ML + 36;
      const volChartW = CW - 44;
      const volChartH = 95;
      const volChartBottom = y - volChartH;

      const dailyVols = uniqueDates.map((d) =>
        filtered.filter((o) => o.date === d).reduce((s, o) => s + o.volume, 0)
      );
      const maxDailyVol = Math.max(...dailyVols, 1);
      const avgDailyVol = dailyVols.reduce((s, v) => s + v, 0) / dailyVols.length;

      drawLine(volChartX, volChartBottom, volChartX + volChartW, volChartBottom, 0.75, DARK_RGB);
      drawLine(volChartX, volChartBottom, volChartX, volChartBottom + volChartH, 0.75, DARK_RGB);
      const avgLineY = volChartBottom + (avgDailyVol / maxDailyVol) * volChartH;
      drawLine(volChartX, avgLineY, volChartX + volChartW, avgLineY, 0.6, MUTED_RGB);

      drawRightText(volChartX - 4, volChartBottom + volChartH - 4, fmtBi(maxDailyVol), 'F1', 7, MUTED_RGB);
      drawRightText(volChartX - 4, avgLineY - 2, 'Media', 'F1', 7, MUTED_RGB);

      const barGap = 2;
      const colW = Math.max(2, volChartW / dailyVols.length - barGap);
      dailyVols.forEach((v, idx) => {
        const bx = volChartX + idx * (volChartW / dailyVols.length) + 1;
        const bh = Math.max(2, (v / maxDailyVol) * volChartH);
        drawRect(bx, volChartBottom, colW, bh, accentRgb);
      });

      y = volChartBottom - 22;
    }

    // Chart B: Risk vs Return Scatter + Equal-Weight US$ 1k Portfolio Curve
    if (y < 230) startNewPage();
    drawText(ML, y, 'Simulacao de carteira equitativa (Base US$ 1.000)', 'F3', 11.5, DARK_RGB);
    y -= 14;

    if (uniqueDates.length > 1) {
      const portChartX = ML + 40;
      const portChartW = CW - 48;
      const portChartH = 95;
      const portBottom = y - portChartH;

      const portValues = uniqueDates.map((d) => {
        let sumNorm = 0;
        let count = 0;
        for (const stat of tickerStats) {
          const pt = stat.pts.find((p) => p.date === d);
          if (pt && stat.startClose > 0) {
            sumNorm += (pt.close / stat.startClose) * 1000;
            count++;
          }
        }
        return count > 0 ? sumNorm / count : 1000;
      });

      const minPort = Math.min(...portValues, 1000);
      const maxPort = Math.max(...portValues, 1000);
      const portSpan = maxPort - minPort || 1;
      const baseLineY = portBottom + ((1000 - minPort) / portSpan) * portChartH;

      drawLine(portChartX, portBottom, portChartX + portChartW, portBottom, 0.75, DARK_RGB);
      drawLine(portChartX, portBottom, portChartX, portBottom + portChartH, 0.75, DARK_RGB);
      drawLine(portChartX, baseLineY, portChartX + portChartW, baseLineY, 0.5, MUTED_RGB);

      drawRightText(portChartX - 4, portBottom + portChartH - 4, fmtUsd(maxPort), 'F1', 7, MUTED_RGB);
      drawRightText(portChartX - 4, baseLineY - 2, 'US$ 1.000', 'F1', 7, MUTED_RGB);
      drawRightText(portChartX - 4, portBottom, fmtUsd(minPort), 'F1', 7, MUTED_RGB);

      let portPath = `1.4 w ${accentRgb} RG `;
      portValues.forEach((val, idx) => {
        const px = portChartX + (idx / (portValues.length - 1)) * portChartW;
        const py = portBottom + ((val - minPort) / portSpan) * portChartH;
        portPath += `${px.toFixed(2)} ${py.toFixed(2)} ${idx === 0 ? 'm' : 'l'} `;
      });
      portPath += 'S';
      cmds.push(portPath);

      const finalPort = portValues[portValues.length - 1] ?? 1000;
      const portRetPct = ((finalPort - 1000) / 1000) * 100;
      drawText(
        portChartX,
        portBottom - 13,
        `Valor final da carteira: ${fmtUsd(finalPort)} (${fmtPct(portRetPct)})`,
        'F2',
        8.5,
        DARK_RGB
      );

      y = portBottom - 30;
    }

    // Chart C: RSI (14) Visual Gauge Bars (0 - 100 with 30 / 70 markers)
    if (y < 180) startNewPage();
    drawText(ML, y, 'Termometro RSI (14) com zonas 30 / 70', 'F3', 11.5, DARK_RGB);
    y -= 16;

    const gaugeW = CW - 140;
    const gaugeX = ML + 52;
    const x30 = gaugeX + 0.3 * gaugeW;
    const x70 = gaugeX + 0.7 * gaugeW;

    for (const stat of tickerStats) {
      const rsiVal = stat.rsi14 ?? 50;
      const fillW = Math.max(3, (Math.min(100, Math.max(0, rsiVal)) / 100) * gaugeW);
      const rsiColor =
        rsiVal >= 70
          ? '0.780 0.160 0.220'
          : rsiVal <= 30
            ? '0.059 0.588 0.412'
            : accentRgb;

      drawText(ML, y, stat.ticker, 'F2', 8.5, DARK_RGB);
      drawRect(gaugeX, y - 1, gaugeW, 7, '0.930 0.940 0.955');
      drawRect(gaugeX, y - 1, fillW, 7, rsiColor);
      drawLine(x30, y - 2, x30, y + 7, 0.7, MUTED_RGB);
      drawLine(x70, y - 2, x70, y + 7, 0.7, MUTED_RGB);
      drawRightText(
        W - MR,
        y,
        stat.rsi14 !== null ? `${stat.rsi14.toFixed(1)}` : '--',
        'F2',
        8.5,
        DARK_RGB
      );
      y -= 16;
    }
    y -= 14;

    // Extended Quantitative & Linear Projection Table
    if (y < 150) startNewPage();
    drawText(ML, y, 'INDICADORES QUANTITATIVOS E PROJECAO (+5D)', 'F2', 9, accentRgb);
    y -= 15;
    drawLine(ML, y + 10, W - MR, y + 10, 0.75, DARK_RGB);
    drawText(ML, y, 'Ativo', 'F2', 8, MUTED_RGB);
    drawRightText(ML + 125, y, 'Min / Max', 'F2', 8, MUTED_RGB);
    drawRightText(ML + 225, y, 'Pos. Faixa', 'F2', 8, MUTED_RGB);
    drawRightText(ML + 315, y, 'Dias Pos.', 'F2', 8, MUTED_RGB);
    drawRightText(ML + 395, y, 'Ret/Risco', 'F2', 8, MUTED_RGB);
    drawRightText(W - MR, y, 'Proj. +5d', 'F2', 8, MUTED_RGB);
    y -= 6;
    drawLine(ML, y, W - MR, y, 0.5, BORDER_RGB);
    y -= 14;

    for (const stat of tickerStats) {
      const closes = stat.pts.map((p) => p.close);
      const minP = closes.length > 0 ? Math.min(...closes) : 0;
      const maxP = closes.length > 0 ? Math.max(...closes) : 0;
      const posPct = maxP > minP ? ((stat.endClose - minP) / (maxP - minP)) * 100 : 50;
      const posDays =
        stat.stepRets.length > 0
          ? (stat.stepRets.filter((r) => r > 0).length / stat.stepRets.length) * 100
          : 0;
      const riskRatio = stat.volatilityPct > 0 ? stat.retPct / stat.volatilityPct : 0;

      // Simple OLS linear projection +5 steps
      let projPrice = stat.endClose;
      const n = closes.length;
      if (n >= 4) {
        let sx = 0;
        let sy = 0;
        let sxy = 0;
        let sxx = 0;
        for (let i = 0; i < n; i++) {
          sx += i;
          sy += closes[i];
          sxy += i * closes[i];
          sxx += i * i;
        }
        const den = n * sxx - sx * sx;
        if (den !== 0) {
          const slope = (n * sxy - sx * sy) / den;
          const intercept = (sy - slope * sx) / n;
          projPrice = Math.max(0, slope * (n - 1 + 5) + intercept);
        }
      }

      drawText(ML, y, stat.ticker, 'F2', 8.5, DARK_RGB);
      drawRightText(ML + 125, y, `${fmtUsd(minP)}`, 'F1', 8, MUTED_RGB);
      drawRightText(ML + 225, y, `${Math.round(posPct)}%`, 'F1', 8.5, DARK_RGB);
      drawRightText(ML + 315, y, `${Math.round(posDays)}%`, 'F1', 8.5, DARK_RGB);
      drawRightText(ML + 395, y, riskRatio.toFixed(2), 'F1', 8.5, DARK_RGB);
      drawRightText(W - MR, y, fmtUsd(projPrice), 'F2', 8.5, accentRgb);
      y -= 15;
    }
    y -= 10;
  }

  // Section 3: Anexo de dados diários (auto-paginated with repeated header)
  if (config.includeAppendix && filtered.length > 0) {
    if (y < 140) startNewPage();

    const drawAppendixHeader = () => {
      drawText(ML, y, 'ANEXO DE DADOS DIARIOS', 'F2', 9, accentRgb);
      y -= 16;
      drawLine(ML, y + 10, W - MR, y + 10, 0.75, DARK_RGB);
      drawText(ML, y, 'Data', 'F2', 8.5, MUTED_RGB);
      drawText(ML + 110, y, 'Ticker', 'F2', 8.5, MUTED_RGB);
      drawRightText(ML + 330, y, 'Fechamento USD', 'F2', 8.5, MUTED_RGB);
      drawRightText(W - MR, y, 'Volume USD', 'F2', 8.5, MUTED_RGB);
      y -= 6;
      drawLine(ML, y, W - MR, y, 0.5, BORDER_RGB);
      y -= 13;
    };

    drawAppendixHeader();

    for (const row of filtered) {
      if (y < 70) {
        startNewPage();
        drawAppendixHeader();
      }
      drawText(ML, y, fmtDateBr(row.date), 'F1', 8.5, DARK_RGB);
      drawText(ML + 110, y, row.ticker, 'F2', 8.5, DARK_RGB);
      drawRightText(ML + 330, y, fmtUsd(row.close), 'F1', 8.5, DARK_RGB);
      drawRightText(W - MR, y, fmtBi(row.volume), 'F1', 8.5, MUTED_RGB);
      y -= 14;
    }
  }

  if (cmds.length > 0) pages.push(cmds.join('\n'));

  // Add page footers
  const totalPages = pages.length;
  const finalizedPages = pages.map((pageBody, idx) => {
    const pageNum = String(idx + 1).padStart(2, '0');
    const footer = [
      `0.5 w ${BORDER_RGB} RG ${ML} 44 m ${W - MR} 44 l S`,
      `BT /F1 8 Tf ${MUTED_RGB} rg 1 0 0 1 ${ML} 30 Tm (${escapePdfText(config.sourceLabel)}) Tj ET`,
      `BT /F2 8 Tf ${MUTED_RGB} rg 1 0 0 1 ${(W - MR - 42).toFixed(2)} 30 Tm (LCT / ${pageNum}) Tj ET`,
    ].join('\n');
    return `${pageBody}\n${footer}`;
  });

  // Assemble PDF 1.4 objects
  // 1: Catalog, 2: Pages, 3..6: Fonts (F1 Helvetica, F2 Helvetica-Bold, F3 Times-Bold, F4 Courier)
  const objects: string[] = [];
  const pageObjNums: number[] = [];

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push(''); // placeholder for Pages 2 0 obj
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>\nendobj');
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj');

  let nextObj = 7;
  for (const stream of finalizedPages) {
    const pageObj = nextObj++;
    const contentObj = nextObj++;
    pageObjNums.push(pageObj);

    objects.push(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj`
    );
    objects.push(
      `${contentObj} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
    );
  }

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${totalPages} >>\nendobj`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }

  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }

  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    pageCount: totalPages,
    observationCount: filtered.length,
    dateCount: uniqueDates.length,
  };
}
