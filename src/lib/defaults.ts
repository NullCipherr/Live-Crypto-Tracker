import type { ColumnConfig, MonitorFilters } from '../types/crypto';

export const DEFAULT_MONITOR_FILTERS: MonitorFilters = {
  universe: 'all',
  direction: 'all',
  minMarketCap: '',
  minVolume: '',
  excludeStablecoins: false,
};

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'rank', label: '#', visible: true },
  { id: 'asset', label: 'Ativo', visible: true, locked: true },
  { id: 'price', label: 'Preço USD', visible: true },
  { id: 'change24h', label: '24h', visible: true },
  { id: 'marketCap', label: 'Cap. USD', visible: true },
  { id: 'volume', label: 'Vol. 24h', visible: true },
  { id: 'sparkline', label: 'Tendência 7d', visible: true },
];
