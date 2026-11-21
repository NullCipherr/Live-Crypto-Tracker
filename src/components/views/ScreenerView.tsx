import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Download,
  GitCompare,
  MessageSquareText,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type {
  CoinMarket,
  ResearchContextSnapshot,
  SavedScreenerSearch,
  ScreenerCondition,
  ScreenerField,
  ScreenerOperator,
} from '../../types/crypto';
import { formatCompactNumber, formatPercent, formatPrice } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { useScreenerSearches } from '../../hooks/useScreenerSearches';
import { PageHeader, HeaderButton } from '../shell/PageHeader';
import { SavedSearchesModal } from '../panels/SavedSearchesModal';

interface ScreenerViewProps {
  coins: CoinMarket[];
  onOpenAsset: (coinId: string) => void;
  onCompareCoins: (coinIds: string[]) => void;
  onExportCoins: (coins: CoinMarket[]) => void;
  onAnalyzeInChat?: (
    payload: Omit<ResearchContextSnapshot, 'capturedAt' | 'totalUniverseCount'>
  ) => void;
}

type SortKey = 'change-asc' | 'change-desc' | 'volume-desc' | 'volume-asc' | 'cap-desc' | 'cap-asc';
type ScaleUnit = '1' | '1000' | '1000000' | '1000000000' | '1000000000000';

const STATE_STORAGE_KEY = 'lct-screener-state-v1';

const DEFAULT_CONDITIONS: ScreenerCondition[] = [
  { id: 'init-1', field: 'change24h', operator: 'lt', value: '-3' },
  { id: 'init-2', field: 'volume', operator: 'gte', value: '1000000000' },
];

const SCALE_UNITS: { value: ScaleUnit; label: string; short: string }[] = [
  { value: '1', label: 'USD', short: 'USD' },
  { value: '1000', label: 'mil USD', short: 'mil' },
  { value: '1000000', label: 'milhão USD', short: 'mi' },
  { value: '1000000000', label: 'bilhão USD', short: 'bi' },
  { value: '1000000000000', label: 'trilhão USD', short: 'tri' },
];

const FIELD_LABELS: Record<ScreenerField, string> = {
  change24h: 'Variação 24h',
  volume: 'Volume 24h',
  marketCap: 'Cap. USD',
  price: 'Preço USD',
};

const OP_SYMBOLS: Record<ScreenerOperator, string> = {
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
};

function decomposeValue(field: ScreenerField, rawValue: string): { display: string; unit: ScaleUnit } {
  if (field === 'change24h') return { display: rawValue, unit: '1' };
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num === 0) return { display: rawValue, unit: '1' };
  const abs = Math.abs(num);
  if (abs >= 1e12 && num % 1e12 === 0) return { display: String(num / 1e12), unit: '1000000000000' };
  if (abs >= 1e9 && num % 1e9 === 0) return { display: String(num / 1e9), unit: '1000000000' };
  if (abs >= 1e6 && num % 1e6 === 0) return { display: String(num / 1e6), unit: '1000000' };
  if (abs >= 1e3 && num % 1e3 === 0) return { display: String(num / 1e3), unit: '1000' };
  return { display: rawValue, unit: '1' };
}

function formatChipValue(cond: ScreenerCondition, locale: 'pt-BR' | 'en-US'): string {
  const num = Number(cond.value);
  if (!Number.isFinite(num)) return cond.value;
  if (cond.field === 'change24h') {
    return `${num.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
  }
  const abs = Math.abs(num);
  if (abs >= 1e12) return `US$ ${(num / 1e12).toLocaleString(locale, { maximumFractionDigits: 2 })} tri`;
  if (abs >= 1e9) return `US$ ${(num / 1e9).toLocaleString(locale, { maximumFractionDigits: 2 })} bi`;
  if (abs >= 1e6) return `US$ ${(num / 1e6).toLocaleString(locale, { maximumFractionDigits: 2 })} mi`;
  return `US$ ${num.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
}

function evaluateCondition(coin: CoinMarket, cond: ScreenerCondition): boolean {
  const num = Number(cond.value);
  if (!Number.isFinite(num)) return true;

  const target =
    cond.field === 'change24h'
      ? coin.priceChange24h
      : cond.field === 'volume'
        ? coin.totalVolume
        : cond.field === 'marketCap'
          ? coin.marketCap
          : coin.currentPrice;

  switch (cond.operator) {
    case 'gt':
      return target > num;
    case 'lt':
      return target < num;
    case 'gte':
      return target >= num;
    case 'lte':
      return target <= num;
  }
}

interface PersistedScreenerState {
  appliedMode: 'all' | 'any';
  appliedConditions: ScreenerCondition[];
  sortBy: SortKey;
  selectedIds: string[];
}

function readPersistedState(): PersistedScreenerState | null {
  try {
    const raw = sessionStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedScreenerState;
    if (!Array.isArray(parsed.appliedConditions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ScreenerView({
  coins,
  onOpenAsset,
  onCompareCoins,
  onExportCoins,
  onAnalyzeInChat,
}: ScreenerViewProps) {
  const { preferences } = usePreferences();
  const { savedSearches, saveSearch, deleteSearch } = useScreenerSearches();

  const initialPersisted = useMemo(() => readPersistedState(), []);

  const [appliedMode, setAppliedMode] = useState<'all' | 'any'>(
    initialPersisted?.appliedMode ?? 'all'
  );
  const [appliedConditions, setAppliedConditions] = useState<ScreenerCondition[]>(
    initialPersisted?.appliedConditions ?? DEFAULT_CONDITIONS
  );
  const [sortBy, setSortBy] = useState<SortKey>(initialPersisted?.sortBy ?? 'change-asc');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialPersisted?.selectedIds ?? []);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<'all' | 'any'>(appliedMode);
  const [draftConditions, setDraftConditions] = useState<ScreenerCondition[]>(appliedConditions);
  const [unitById, setUnitById] = useState<Record<string, ScaleUnit>>(() => {
    const map: Record<string, ScaleUnit> = {};
    for (const cond of appliedConditions) {
      map[cond.id] = decomposeValue(cond.field, cond.value).unit;
    }
    return map;
  });

  const [savedModalOpen, setSavedModalOpen] = useState(false);

  useEffect(() => {
    try {
      const payload: PersistedScreenerState = {
        appliedMode,
        appliedConditions,
        sortBy,
        selectedIds,
      };
      sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }, [appliedConditions, appliedMode, selectedIds, sortBy]);

  const fmtOpts = useMemo(
    () => ({
      locale: preferences.numberLocale,
      decimalMode: preferences.decimalMode,
    }),
    [preferences.numberLocale, preferences.decimalMode]
  );

  const results = useMemo(() => {
    const filtered = coins.filter((coin) => {
      if (appliedConditions.length === 0) return true;
      return appliedMode === 'all'
        ? appliedConditions.every((c) => evaluateCondition(coin, c))
        : appliedConditions.some((c) => evaluateCondition(coin, c));
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'change-asc':
          return a.priceChange24h - b.priceChange24h;
        case 'change-desc':
          return b.priceChange24h - a.priceChange24h;
        case 'volume-desc':
          return b.totalVolume - a.totalVolume;
        case 'volume-asc':
          return a.totalVolume - b.totalVolume;
        case 'cap-desc':
          return b.marketCap - a.marketCap;
        case 'cap-asc':
          return a.marketCap - b.marketCap;
      }
    });
  }, [appliedConditions, appliedMode, coins, sortBy]);

  const maxAbsChange = useMemo(
    () => results.reduce((max, c) => Math.max(max, Math.abs(c.priceChange24h)), 0) || 1,
    [results]
  );

  const summaryStats = useMemo(() => {
    if (results.length === 0) return null;
    const worstDrop = [...results].sort((a, b) => a.priceChange24h - b.priceChange24h)[0];
    const topVolume = [...results].sort((a, b) => b.totalVolume - a.totalVolume)[0];
    return { worstDrop, topVolume };
  }, [results]);

  const selectedCoins = useMemo(() => {
    const set = new Set(selectedIds);
    return coins.filter((c) => set.has(c.id));
  }, [coins, selectedIds]);

  const hasPendingChanges = useMemo(
    () =>
      draftMode !== appliedMode ||
      JSON.stringify(draftConditions) !== JSON.stringify(appliedConditions),
    [appliedConditions, appliedMode, draftConditions, draftMode]
  );

  const openEditor = () => {
    setDraftMode(appliedMode);
    setDraftConditions(appliedConditions);
    const nextUnits: Record<string, ScaleUnit> = {};
    for (const cond of appliedConditions) {
      nextUnits[cond.id] = decomposeValue(cond.field, cond.value).unit;
    }
    setUnitById(nextUnits);
    setEditorOpen((prev) => !prev);
  };

  const addCondition = () => {
    const id = `cond-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setDraftConditions((prev) => [
      ...prev,
      { id, field: 'change24h', operator: 'lt', value: '0' },
    ]);
    setUnitById((prev) => ({ ...prev, [id]: '1' }));
  };

  const updateConditionField = (id: string, field: ScreenerField) => {
    setUnitById((prev) => ({ ...prev, [id]: field === 'change24h' ? '1' : prev[id] ?? '1' }));
    setDraftConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, field } : c))
    );
  };

  const updateConditionOperator = (id: string, operator: ScreenerOperator) => {
    setDraftConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, operator } : c))
    );
  };

  const updateConditionDisplayValue = (id: string, displayStr: string, unit: ScaleUnit) => {
    const num = Number(displayStr);
    const scaled =
      displayStr.trim() === '' || !Number.isFinite(num)
        ? displayStr
        : String(num * Number(unit));
    setDraftConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, value: scaled } : c))
    );
  };

  const updateConditionUnit = (id: string, nextUnit: ScaleUnit, currentCond: ScreenerCondition) => {
    const currentUnit = unitById[id] ?? '1';
    const currentDisplay = decomposeValue(currentCond.field, currentCond.value);
    const numericDisplay =
      currentUnit === currentDisplay.unit
        ? Number(currentDisplay.display)
        : Number(currentCond.value) / Number(currentUnit);
    setUnitById((prev) => ({ ...prev, [id]: nextUnit }));
    if (Number.isFinite(numericDisplay)) {
      setDraftConditions((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, value: String(numericDisplay * Number(nextUnit)) } : c
        )
      );
    }
  };

  const removeCondition = (id: string) => {
    setDraftConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const handleApply = () => {
    setAppliedMode(draftMode);
    setAppliedConditions(draftConditions);
    setEditorOpen(false);
  };

  const handleCancelEdit = () => {
    setDraftMode(appliedMode);
    setDraftConditions(appliedConditions);
    setEditorOpen(false);
  };

  const handleClearFilters = () => {
    setDraftConditions([]);
    setAppliedConditions([]);
    setEditorOpen(false);
  };

  const handleOpenSaved = (search: SavedScreenerSearch) => {
    setDraftMode(search.matchMode);
    setDraftConditions(search.conditions);
    setAppliedMode(search.matchMode);
    setAppliedConditions(search.conditions);
    const nextUnits: Record<string, ScaleUnit> = {};
    for (const cond of search.conditions) {
      nextUnits[cond.id] = decomposeValue(cond.field, cond.value).unit;
    }
    setUnitById(nextUnits);
    setEditorOpen(false);
  };

  const toggleSort = (col: 'change' | 'volume' | 'cap') => {
    if (col === 'change') {
      setSortBy((prev) => (prev === 'change-asc' ? 'change-desc' : 'change-asc'));
    } else if (col === 'volume') {
      setSortBy((prev) => (prev === 'volume-desc' ? 'volume-asc' : 'volume-desc'));
    } else {
      setSortBy((prev) => (prev === 'cap-desc' ? 'cap-asc' : 'cap-desc'));
    }
  };

  const toggleRow = (coinId: string) => {
    setSelectedIds((prev) =>
      prev.includes(coinId) ? prev.filter((id) => id !== coinId) : [...prev, coinId]
    );
  };

  const allVisibleSelected =
    results.length > 0 && results.every((c) => selectedIds.includes(c.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(results.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...results.map((c) => c.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Screener"
        subtitle="Combine critérios numéricos sobre todo o universo"
        actions={
          <>
            <HeaderButton onClick={() => setSavedModalOpen(true)}>
              <Bookmark className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>Buscas salvas ({savedSearches.length})</span>
            </HeaderButton>
            <HeaderButton onClick={() => setSavedModalOpen(true)}>
              <span>Salvar busca</span>
            </HeaderButton>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-page-pad lg:p-page-pad-lg">
        <div className="mx-auto w-full max-w-page space-y-5">

        {/* Readable Criteria Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-2.5 shadow-card">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {appliedConditions.length === 0 ? (
              <span className="text-muted-foreground">
                Sem critérios aplicados — exibindo todos os {coins.length} ativos monitorados
              </span>
            ) : (
              appliedConditions.map((cond, idx) => (
                <div key={cond.id} className="flex items-center gap-2">
                  {idx > 0 ? (
                    <span className="font-mono text-[11px] font-semibold uppercase text-muted-foreground">
                      {appliedMode === 'all' ? 'E' : 'OU'}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-2.5 py-1 font-medium text-foreground">
                    <span className="text-muted-foreground">{FIELD_LABELS[cond.field]}</span>
                    <span className="font-mono text-accent">{OP_SYMBOLS[cond.operator]}</span>
                    <span className="font-mono tabular-nums">
                      {formatChipValue(cond, preferences.numberLocale)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={openEditor}
            aria-expanded={editorOpen}
            className={`inline-flex h-7 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors ${
              editorOpen
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Editar critérios</span>
          </button>
        </div>

        {/* Inline Expandable Criteria Editor */}
        {editorOpen ? (
          <div className="rounded-md border border-border bg-card p-4 text-xs shadow-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">Editar critérios</span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Combinar</span>
                <select
                  aria-label="Combinar condições"
                  value={draftMode}
                  onChange={(e) => setDraftMode(e.target.value as 'all' | 'any')}
                  className="h-7 rounded border border-border bg-background px-2 text-foreground"
                >
                  <option value="all">Todas: E</option>
                  <option value="any">Qualquer: OU</option>
                </select>
              </label>
            </div>

            {draftConditions.length === 0 ? (
              <p className="rounded border border-border bg-background px-3 py-4 text-center text-muted-foreground">
                Nenhum critério definido. Adicione um critério ou aplique para exibir todos os
                ativos.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_32px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                  <span>Campo</span>
                  <span>Operador</span>
                  <span>Valor</span>
                  <span>Unidade</span>
                  <span />
                </div>

                {draftConditions.map((cond) => {
                  const unit =
                    cond.field === 'change24h'
                      ? '1'
                      : unitById[cond.id] ?? decomposeValue(cond.field, cond.value).unit;
                  const numericRaw = Number(cond.value);
                  const displayVal =
                    cond.field === 'change24h' || !Number.isFinite(numericRaw)
                      ? cond.value
                      : String(numericRaw / Number(unit));

                  return (
                    <div
                      key={cond.id}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_32px]"
                    >
                      <select
                        aria-label="Campo da condição"
                        value={cond.field}
                        onChange={(e) =>
                          updateConditionField(cond.id, e.target.value as ScreenerField)
                        }
                        className="h-8 rounded border border-border bg-background px-2.5 text-foreground"
                      >
                        <option value="change24h">Variação em 24h</option>
                        <option value="volume">Volume em 24h</option>
                        <option value="marketCap">Capitalização</option>
                        <option value="price">Preço em USD</option>
                      </select>

                      <select
                        aria-label="Operador da condição"
                        value={cond.operator}
                        onChange={(e) =>
                          updateConditionOperator(cond.id, e.target.value as ScreenerOperator)
                        }
                        className="h-8 rounded border border-border bg-background px-2.5 text-foreground"
                      >
                        <option value="gt">Maior que</option>
                        <option value="lt">Menor que</option>
                        <option value="gte">Maior ou igual a</option>
                        <option value="lte">Menor ou igual a</option>
                      </select>

                      <input
                        type="number"
                        step="any"
                        aria-label="Valor da condição"
                        value={displayVal}
                        onChange={(e) =>
                          updateConditionDisplayValue(cond.id, e.target.value, unit)
                        }
                        className="h-8 rounded border border-border bg-background px-2.5 font-mono text-foreground outline-none focus:border-accent"
                      />

                      {cond.field === 'change24h' ? (
                        <div className="flex h-8 items-center rounded border border-border bg-muted/40 px-2.5 font-mono text-muted-foreground">
                          %
                        </div>
                      ) : (
                        <select
                          aria-label="Unidade do valor"
                          value={unit}
                          onChange={(e) =>
                            updateConditionUnit(cond.id, e.target.value as ScaleUnit, cond)
                          }
                          className="h-8 rounded border border-border bg-background px-2.5 text-foreground"
                        >
                          {SCALE_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => removeCondition(cond.id)}
                        aria-label="Remover critério"
                        className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:text-negative"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={addCondition}
              className="mt-3 inline-flex h-7 items-center gap-1 rounded border border-dashed border-border px-2.5 text-muted-foreground hover:border-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Adicionar critério</span>
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-[11px] text-muted-foreground">
                {hasPendingChanges
                  ? 'Alterações pendentes. A tabela exibe a busca anterior.'
                  : 'Critérios sincronizados com a tabela.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="h-8 rounded border border-border bg-background px-3 font-medium text-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="h-8 rounded bg-accent px-3.5 font-semibold text-accent-foreground hover:opacity-90"
                >
                  Aplicar critérios
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Results Table Card */}
        <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
          {/* Action / Selection Bar */}
          {selectedCoins.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/40 bg-accent/10 px-4 py-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-accent tabular-nums">
                  {selectedCoins.length} {selectedCoins.length === 1 ? 'selecionado' : 'selecionados'}
                </span>
                <span className="font-mono font-medium text-foreground">
                  {selectedCoins.map((c) => c.symbol.toUpperCase()).join(' + ')}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="h-7 rounded border border-border bg-card px-2.5 font-medium text-foreground hover:bg-muted"
                >
                  Limpar seleção
                </button>
                <button
                  type="button"
                  onClick={() => onExportCoins(selectedCoins)}
                  className="inline-flex h-7 items-center gap-1 rounded border border-border bg-card px-2.5 font-medium text-foreground hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Exportar {selectedCoins.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCompareCoins(selectedCoins.map((c) => c.id))}
                  className="inline-flex h-7 items-center gap-1.5 rounded bg-accent px-3 font-semibold text-accent-foreground hover:opacity-90"
                >
                  <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Comparar {selectedCoins.length}</span>
                </button>
                {onAnalyzeInChat ? (
                  <button
                    type="button"
                    onClick={() =>
                      onAnalyzeInChat({
                        source: 'Screener',
                        coins: selectedCoins,
                        filters: appliedConditions,
                        matchMode: appliedMode,
                      })
                    }
                    className="inline-flex h-7 items-center gap-1.5 rounded border border-border bg-card px-2.5 font-medium text-foreground hover:bg-muted"
                  >
                    <MessageSquareText className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    <span>Analisar {selectedCoins.length} selecionados</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-nav px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2 tabular-nums text-muted-foreground">
                <strong className="text-foreground">
                  {results.length} {results.length === 1 ? 'ativo encontrado' : 'ativos encontrados'}
                </strong>
                <span>/</span>
                <span>{coins.length} monitorados</span>
              </div>

              <div className="flex items-center gap-2">
                {onAnalyzeInChat ? (
                  <button
                    type="button"
                    disabled={results.length === 0}
                    onClick={() =>
                      onAnalyzeInChat({
                        source: 'Screener',
                        coins: results,
                        filters: appliedConditions,
                        matchMode: appliedMode,
                      })
                    }
                    className="inline-flex h-7 items-center gap-1.5 rounded border border-border bg-card px-2.5 font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <MessageSquareText className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    <span>Analisar no chat</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={results.length === 0}
                  onClick={() => onExportCoins(results)}
                  className="inline-flex h-7 items-center gap-1.5 rounded border border-border bg-card px-2.5 font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>
          )}

          {results.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center gap-3 px-4 text-center text-xs text-muted-foreground">
              <p>Nenhum ativo corresponde aos critérios aplicados.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className="h-7 rounded border border-border bg-background px-3 font-medium text-foreground hover:bg-muted"
                >
                  Editar critérios
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="h-7 rounded border border-border bg-background px-3 text-muted-foreground hover:text-foreground"
                >
                  Limpar critérios
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="border-b border-border bg-nav text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="w-10 px-4 py-2.5">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os ativos exibidos"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          className="h-3.5 w-3.5 rounded border-border accent-accent"
                        />
                      </th>
                      <th className="px-3 py-2.5">Ativo</th>
                      <th className="px-3 py-2.5 text-right">Preço USD</th>
                      <th className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('change')}
                          className="inline-flex items-center justify-end gap-1 hover:text-foreground"
                        >
                          <span>Variação 24h</span>
                          {sortBy === 'change-asc' ? (
                            <ArrowUp className="h-3 w-3 text-accent" aria-hidden="true" />
                          ) : sortBy === 'change-desc' ? (
                            <ArrowDown className="h-3 w-3 text-accent" aria-hidden="true" />
                          ) : null}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('volume')}
                          className="inline-flex items-center justify-end gap-1 hover:text-foreground"
                        >
                          <span>Volume 24h</span>
                          {sortBy === 'volume-desc' ? (
                            <ArrowDown className="h-3 w-3 text-accent" aria-hidden="true" />
                          ) : sortBy === 'volume-asc' ? (
                            <ArrowUp className="h-3 w-3 text-accent" aria-hidden="true" />
                          ) : null}
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('cap')}
                          className="inline-flex items-center justify-end gap-1 hover:text-foreground"
                        >
                          <span>Cap. USD</span>
                          {sortBy === 'cap-desc' ? (
                            <ArrowDown className="h-3 w-3 text-accent" aria-hidden="true" />
                          ) : sortBy === 'cap-asc' ? (
                            <ArrowUp className="h-3 w-3 text-accent" aria-hidden="true" />
                          ) : null}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border tabular-nums">
                    {results.map((coin) => {
                      const checked = selectedIds.includes(coin.id);
                      const isNeg = coin.priceChange24h < 0;
                      const barPct = Math.min(
                        100,
                        Math.max(4, (Math.abs(coin.priceChange24h) / maxAbsChange) * 100)
                      );

                      return (
                        <tr
                          key={coin.id}
                          className={`h-11 transition-colors hover:bg-muted/30 ${
                            checked ? 'bg-accent/5' : ''
                          }`}
                        >
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${coin.name}`}
                              checked={checked}
                              onChange={() => toggleRow(coin.id)}
                              className="h-3.5 w-3.5 rounded border-border accent-accent"
                            />
                          </td>

                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => onOpenAsset(coin.id)}
                              className="inline-flex items-baseline gap-2 text-left hover:underline"
                            >
                              <span className="font-mono text-sm font-semibold uppercase text-foreground">
                                {coin.symbol}
                              </span>
                              <span className="text-xs text-muted-foreground">{coin.name}</span>
                            </button>
                          </td>

                          <td className="px-3 py-2 text-right font-mono text-sm text-foreground">
                            {formatPrice(coin.currentPrice, fmtOpts)}
                          </td>

                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center justify-end gap-2.5">
                              <span
                                className={`font-mono text-sm font-medium ${
                                  isNeg ? 'text-negative' : 'text-positive'
                                }`}
                              >
                                {formatPercent(coin.priceChange24h, preferences.numberLocale)}
                              </span>
                              <div
                                className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block"
                                aria-hidden="true"
                              >
                                <div
                                  className={`h-full rounded-full ${
                                    isNeg ? 'bg-rose-500/80' : 'bg-emerald-500/80'
                                  }`}
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-2 text-right font-mono text-sm text-foreground">
                            US$ {formatCompactNumber(coin.totalVolume, preferences.numberLocale)}
                          </td>

                          <td className="px-4 py-2 text-right font-mono text-sm text-foreground">
                            US$ {formatCompactNumber(coin.marketCap, preferences.numberLocale)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Slice Summary Footer */}
              {summaryStats ? (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-nav/60 px-4 py-2.5 text-xs">
                  <span className="font-semibold text-muted-foreground">Neste recorte</span>
                  <div className="flex flex-wrap items-center gap-6 tabular-nums">
                    <div>
                      <span className="text-muted-foreground">
                        {summaryStats.worstDrop.priceChange24h < 0
                          ? 'Maior queda'
                          : 'Menor variação'}{' '}
                      </span>
                      <span className="ml-1 font-mono font-semibold text-foreground">
                        {summaryStats.worstDrop.symbol.toUpperCase()}
                      </span>{' '}
                      <span
                        className={`font-mono font-semibold ${
                          summaryStats.worstDrop.priceChange24h < 0
                            ? 'text-negative'
                            : 'text-positive'
                        }`}
                      >
                        {formatPercent(
                          summaryStats.worstDrop.priceChange24h,
                          preferences.numberLocale
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Maior volume </span>
                      <span className="ml-1 font-mono font-semibold text-foreground">
                        {summaryStats.topVolume.symbol.toUpperCase()}
                      </span>{' '}
                      <span className="font-mono font-semibold text-foreground">
                        US${' '}
                        {formatCompactNumber(
                          summaryStats.topVolume.totalVolume,
                          preferences.numberLocale
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
      </div>

      {savedModalOpen ? (
        <SavedSearchesModal
          searches={savedSearches}
          currentMatchMode={appliedMode}
          currentConditions={appliedConditions}
          onOpenSearch={handleOpenSaved}
          onSaveCurrent={(name) =>
            saveSearch({
              name,
              matchMode: appliedMode,
              conditions: appliedConditions,
            })
          }
          onDeleteSearch={deleteSearch}
          onClose={() => setSavedModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
