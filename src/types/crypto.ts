export type TrendStatus = 'up' | 'down' | 'neutral';

export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChange24h: number;
  marketCap: number;
  totalVolume: number;
  marketCapRank: number;
  high24h: number;
  low24h: number;
  sparkline7d: number[];
  trend: TrendStatus;
}

export interface MarketResponse {
  coins: CoinMarket[];
  latencyMs: number;
  fetchedAt: number;
}

export interface MarketStats {
  totalCoins: number;
  avgChange24h: number;
  totalMarketCap: number;
  totalVolume: number;
  positiveCount: number;
  negativeCount: number;
}

export type SortField = 'rank' | 'name' | 'price' | 'change24h' | 'marketCap' | 'volume';
export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  field: SortField;
  direction: SortDirection;
}

export type SortOption =
  | 'market-cap-desc'
  | 'market-cap-asc'
  | 'top-gainers'
  | 'top-losers'
  | 'alphabetical';

export type NavRoute =
  | 'home'
  | 'monitor'
  | 'heatmap'
  | 'pulse'
  | 'analytics'
  | 'quant'
  | 'reports'
  | 'tv'
  | 'lists'
  | 'alerts'
  | 'screener'
  | 'comparator'
  | 'converter'
  | 'dca'
  | 'position'
  | 'research'
  | 'asset'
  | 'sources'
  | 'preferences';

export type TableDensity = 'compact' | 'comfortable';

export type ColumnId =
  | 'rank'
  | 'asset'
  | 'price'
  | 'change24h'
  | 'marketCap'
  | 'volume'
  | 'sparkline';

export interface ColumnConfig {
  id: ColumnId;
  label: string;
  visible: boolean;
  locked?: boolean;
}

export interface MonitorFilters {
  universe: 'all' | 'favorites';
  direction: 'all' | 'up' | 'down';
  minMarketCap: string;
  minVolume: string;
  excludeStablecoins: boolean;
}

export type ServiceName = 'Cotações' | 'Histórico' | 'Descrição';

export interface RequestLogEntry {
  id: string;
  timestamp: number;
  service: ServiceName;
  status: number | 'ERR';
  ok: boolean;
  durationMs: number;
  note: string;
}

export interface AppPreferences {
  themeMode: 'system' | 'dark' | 'light';
  density: TableDensity;
  reduceMotion: 'system' | 'reduce' | 'no-preference';
  numberLocale: 'pt-BR' | 'en-US';
  timezone: string;
  decimalMode: 'auto' | 'fixed-2';
  refreshIntervalSec: 60 | 90 | 120 | 300;
  refetchOnFocus: boolean;
}

export interface AssetChartPoint {
  timestamp: number;
  price: number;
}

export interface AssetOhlcPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CustomList {
  id: string;
  name: string;
  coinIds: string[];
}

export type ScreenerField = 'change24h' | 'volume' | 'marketCap' | 'price';
export type ScreenerOperator = 'gt' | 'lt' | 'gte' | 'lte';

export interface ScreenerCondition {
  id: string;
  field: ScreenerField;
  operator: ScreenerOperator;
  value: string;
}

export interface SavedScreenerSearch {
  id: string;
  name: string;
  matchMode: 'all' | 'any';
  conditions: ScreenerCondition[];
}

export type AlertMetric = 'price' | 'change24h';
export type AlertConditionType = 'cross_above' | 'cross_below';
export type AlertRepeat = 'once' | 'recurring';
export type AlertRuleStatus = 'active' | 'paused';

export interface AlertRule {
  id: string;
  coinId: string;
  metric: AlertMetric;
  condition: AlertConditionType;
  threshold: number;
  repeat: AlertRepeat;
  status: AlertRuleStatus;
  armed: boolean;
  lastReading?: number;
  lastReadingAt?: number;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  coinId: string;
  coinSymbol: string;
  coinName: string;
  metric: AlertMetric;
  condition: AlertConditionType;
  thresholdSnapshot: number;
  previousReading: number;
  previousTimestamp: number;
  triggeredReading: number;
  triggeredTimestamp: number;
}

export interface ResearchContextSnapshot {
  source: 'Monitor de mercado' | 'Screener' | 'Universo selecionado';
  capturedAt: number;
  totalUniverseCount: number;
  coins: CoinMarket[];
  filters?: ScreenerCondition[];
  matchMode?: 'all' | 'any';
}

export interface ResearchChartBar {
  id: string;
  symbol: string;
  name: string;
  value: number;
  formattedValue: string;
  secondaryValue?: string;
}

export interface ResearchEvidenceRow {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

export interface ResearchEvidence {
  formula: string;
  capturedAt: number;
  rows: ResearchEvidenceRow[];
}

export interface ResearchAnswerBlock {
  headline: string;
  summary: string;
  chartTitle?: string;
  chartSubtitle?: string;
  bars?: ResearchChartBar[];
  evidence?: ResearchEvidence;
  compareIds?: string[];
  missingHistory?: boolean;
  suggestedFollowups?: string[];
}

export interface ResearchMessage {
  id: string;
  role: 'user' | 'assistant' | 'divider';
  createdAt: number;
  text: string;
  snapshotCapturedAt?: number;
  answer?: ResearchAnswerBlock;
}

export interface ResearchConversation {
  id: string;
  title: string;
  updatedAt: number;
  context: ResearchContextSnapshot;
  messages: ResearchMessage[];
}

export interface SavedResearchAnalysis {
  id: string;
  title: string;
  question: string;
  savedAt: number;
  context: ResearchContextSnapshot;
  answer: ResearchAnswerBlock;
}
