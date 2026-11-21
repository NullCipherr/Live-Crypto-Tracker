export type NumberLocale = 'pt-BR' | 'en-US';
export type DecimalMode = 'auto' | 'fixed-2';

export interface FormatOptions {
  locale?: NumberLocale;
  decimalMode?: DecimalMode;
  timezone?: string;
}

function getAutoDecimals(value: number): number {
  const abs = Math.abs(value);
  if (abs === 0) return 2;
  if (abs < 0.01) return 6;
  if (abs < 2) return 6;
  if (abs < 100) return 2;
  return 2;
}

export function formatPrice(value: number, options: FormatOptions = {}): string {
  if (!Number.isFinite(value)) return '--';
  const locale = options.locale ?? 'pt-BR';
  const decimalMode = options.decimalMode ?? 'auto';
  const rawDecimals = decimalMode === 'fixed-2' ? 2 : getAutoDecimals(value);
  const decimals = Math.max(0, Math.min(20, rawDecimals));
  const rawMinDecimals =
    decimalMode === 'fixed-2' ? 2 : Math.abs(value) > 0 && Math.abs(value) < 2 ? 4 : 2;
  const minDecimals = Math.max(0, Math.min(decimals, rawMinDecimals));

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCurrencyUSD(value: number, options: FormatOptions = {}): string {
  if (!Number.isFinite(value)) return '--';
  return `US$ ${formatPrice(value, options)}`;
}

export function formatPercent(value: number, locale: NumberLocale = 'pt-BR'): string {
  if (!Number.isFinite(value)) return '0,00%';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${sign}${formatted}%`;
}

export function formatCompactNumber(value: number, locale: NumberLocale = 'pt-BR'): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  const numFmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  if (locale === 'pt-BR') {
    if (abs >= 1e12) return `${numFmt(value / 1e12)} tri`;
    if (abs >= 1e9) return `${numFmt(value / 1e9)} bi`;
    if (abs >= 1e6) return `${numFmt(value / 1e6)} mi`;
    if (abs >= 1e3) return `${numFmt(value / 1e3)} mil`;
    return numFmt(value);
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatTime(timestamp?: number, timezone = 'America/Sao_Paulo'): string {
  if (!timestamp) return '--:--:--';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone,
  }).format(timestamp);
}

export function formatDateShort(timestamp: number, timezone = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: timezone,
  }).format(timestamp);
}

export function formatDateTimeFull(timestamp: number, timezone = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(timestamp);
}

export function formatCurrency(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 2 : 6,
  }).format(value);
}

export function formatDateTime(timestamp?: number): string {
  if (!timestamp) return 'Não sincronizado';
  return formatTime(timestamp);
}
