import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUp,
  Bookmark,
  Bot,
  Database,
  FileText,
  FolderOpen,
  GitCompare,
  Menu,
  Plus,
  RefreshCw,
  Send,
  Table,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CoinMarket,
  ResearchAnswerBlock,
  ResearchConversation,
  ResearchContextSnapshot,
  ResearchMessage,
  SavedResearchAnalysis,
} from '../../types/crypto';
import { formatCompactNumber, formatCurrencyUSD, formatPercent, formatTime } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import { Sidebar } from '../shell/Sidebar';
import { runResearchQuery } from '../../lib/researchEngine';
import {
  deleteConversation,
  deleteSavedAnalysis,
  loadAllConversations,
  loadSavedAnalyses,
  putConversation,
  putSavedAnalysis,
} from '../../lib/researchDb';

function nowMs(): number {
  return Date.now();
}

interface ResearchViewProps {
  liveCoins: CoinMarket[];
  liveFetchedAt?: number;
  initialContext?: ResearchContextSnapshot | null;
  sidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onExit: () => void;
  onCompareCoins: (coinIds: string[]) => void;
  onOpenReportWithContext: (coinIds: string[]) => void;
  onOpenAnalytics: () => void;
}

type LibraryView = 'chat' | 'saved';

export function ResearchView({
  liveCoins,
  liveFetchedAt,
  initialContext,
  sidebarCollapsed,
  onToggleSidebarCollapse,
  onExit,
  onCompareCoins,
  onOpenReportWithContext,
  onOpenAnalytics,
}: ResearchViewProps) {
  const { preferences } = usePreferences();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [libraryView, setLibraryView] = useState<LibraryView>('chat');
  const [conversations, setConversations] = useState<ResearchConversation[]>([]);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedResearchAnalysis[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [draftContext, setDraftContext] = useState<ResearchContextSnapshot>(
    () =>
      initialContext ?? {
        source: 'Monitor de mercado',
        capturedAt: liveFetchedAt ?? Date.now(),
        totalUniverseCount: liveCoins.length,
        coins: liveCoins,
      }
  );
  const [input, setInput] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [tableViewByMsg, setTableViewByMsg] = useState<Record<string, boolean>>({});
  const [evidenceOpenByMsg, setEvidenceOpenByMsg] = useState<Record<string, boolean>>({});
  const [contextPickerOpen, setContextPickerOpen] = useState(false);

  useEffect(() => {
    void loadAllConversations().then((list) => {
      setConversations(list);
    });
    void loadSavedAnalyses().then((list) => {
      setSavedAnalyses(list);
    });
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [activeConvId, conversations]
  );

  const currentContext = activeConversation?.context ?? draftContext;

  const suggestions = useMemo(() => {
    if (currentContext.source === 'Screener' || currentContext.filters?.length) {
      return [
        'Qual dessas quedas teve maior volume?',
        'Quais ativos mais caíram em 24 horas?',
        currentContext.coins.length >= 2
          ? `Como ${currentContext.coins[0].symbol.toUpperCase()} e ${currentContext.coins[1].symbol.toUpperCase()} se comparam neste recorte?`
          : 'Resuma o panorama deste recorte',
      ];
    }
    return [
      'Quais ativos mais caíram em 24 horas?',
      'Quais concentram o maior volume negociado?',
      'Como BTC e ETH se comparam neste recorte?',
    ];
  }, [currentContext]);

  const startNewAnalysis = () => {
    setActiveConvId(null);
    setLibraryView('chat');
    setDraftContext({
      source: 'Monitor de mercado',
      capturedAt: liveFetchedAt ?? Date.now(),
      totalUniverseCount: liveCoins.length,
      coins: liveCoins,
    });
  };

  const handleSend = async (overrideText?: string) => {
    const question = (overrideText ?? input).trim();
    if (!question) return;
    if (!overrideText) setInput('');

    const answer: ResearchAnswerBlock = runResearchQuery(
      question,
      currentContext,
      preferences.numberLocale
    );

    const now = nowMs();
    const userMsg: ResearchMessage = {
      id: `msg-u-${now}`,
      role: 'user',
      createdAt: now,
      text: question,
    };
    const assistantMsg: ResearchMessage = {
      id: `msg-a-${now + 1}`,
      role: 'assistant',
      createdAt: now + 1,
      text: answer.headline,
      snapshotCapturedAt: currentContext.capturedAt,
      answer,
    };

    if (activeConversation) {
      const updated: ResearchConversation = {
        ...activeConversation,
        updatedAt: now,
        messages: [...activeConversation.messages, userMsg, assistantMsg],
      };
      setConversations((prev) => [updated, ...prev.filter((c) => c.id !== updated.id)]);
      await putConversation(updated);
    } else {
      const title =
        question.length > 42 ? `${question.slice(0, 42).trim()}…` : question;
      const created: ResearchConversation = {
        id: `conv-${now}`,
        title,
        updatedAt: now,
        context: currentContext,
        messages: [userMsg, assistantMsg],
      };
      setConversations((prev) => [created, ...prev]);
      setActiveConvId(created.id);
      await putConversation(created);
    }
    setLibraryView('chat');
  };

  const handleUseNewerSnapshot = async () => {
    const nextCapturedAt = liveFetchedAt ?? Date.now();
    const idSet = new Set(currentContext.coins.map((c) => c.id));
    const updatedCoins =
      currentContext.source === 'Monitor de mercado'
        ? liveCoins
        : liveCoins.filter((c) => idSet.has(c.id));

    const nextContext: ResearchContextSnapshot = {
      ...currentContext,
      capturedAt: nextCapturedAt,
      totalUniverseCount: liveCoins.length,
      coins: updatedCoins.length > 0 ? updatedCoins : liveCoins,
    };

    if (activeConversation) {
      const divider: ResearchMessage = {
        id: `msg-div-${Date.now()}`,
        role: 'divider',
        createdAt: Date.now(),
        text: `Dados atualizados às ${formatTime(nextCapturedAt, preferences.timezone)} · próximas respostas`,
      };
      const updated: ResearchConversation = {
        ...activeConversation,
        updatedAt: Date.now(),
        context: nextContext,
        messages: [...activeConversation.messages, divider],
      };
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      await putConversation(updated);
    } else {
      setDraftContext(nextContext);
    }
  };

  const handleSwitchUniverse = async (mode: 'all' | 'top10' | 'losers') => {
    const baseCoins =
      mode === 'top10'
        ? liveCoins.slice(0, 10)
        : mode === 'losers'
          ? [...liveCoins].filter((c) => c.priceChange24h < 0).slice(0, 15)
          : liveCoins;
    const nextContext: ResearchContextSnapshot = {
      source: mode === 'all' ? 'Monitor de mercado' : 'Universo selecionado',
      capturedAt: liveFetchedAt ?? Date.now(),
      totalUniverseCount: liveCoins.length,
      coins: baseCoins,
    };
    if (activeConversation) {
      const updated: ResearchConversation = {
        ...activeConversation,
        updatedAt: Date.now(),
        context: nextContext,
      };
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      await putConversation(updated);
    } else {
      setDraftContext(nextContext);
    }
    setContextPickerOpen(false);
  };

  const handleSaveAnalysis = async (question: string, answer: ResearchAnswerBlock) => {
    const savedAt = nowMs();
    const entry: SavedResearchAnalysis = {
      id: `saved-${savedAt}`,
      title: answer.headline,
      question,
      savedAt,
      context: currentContext,
      answer,
    };
    setSavedAnalyses((prev) => [entry, ...prev]);
    await putSavedAnalysis(entry);
  };

  const handleDeleteConversation = async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) setActiveConvId(null);
    await deleteConversation(id);
  };

  const handleDeleteSaved = async (id: string) => {
    setSavedAnalyses((prev) => prev.filter((s) => s.id !== id));
    await deleteSavedAnalysis(id);
  };

  return (
    <div className="fixed inset-0 z-40 flex bg-background text-foreground">
      <Sidebar
        mode="research"
        activeRoute="research"
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onSelectRoute={() => {}}
        onToggleCollapse={onToggleSidebarCollapse}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onGoHome={onExit}
        research={{
          libraryView,
          conversations,
          savedCount: savedAnalyses.length,
          activeConvId,
          onExit,
          onNewAnalysis: startNewAnalysis,
          onChangeLibraryView: setLibraryView,
          onSelectConversation: (id) => {
            setActiveConvId(id);
            setLibraryView('chat');
          },
          onDeleteConversation: (id) => void handleDeleteConversation(id),
        }}
      />

      {/* Main Column */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {libraryView === 'chat' && !activeConversation ? (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu do Cipher"
            className="absolute left-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          /* Topbar */
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-nav px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu do Cipher"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground lg:hidden"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="font-semibold text-foreground">Cipher</span>
              <span className="text-muted-foreground">/</span>
              <span className="truncate text-muted-foreground">
                {libraryView === 'saved'
                  ? 'Análises salvas'
                  : activeConversation?.title ?? 'Nova análise'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setInspectorOpen((p) => !p)}
              className={`inline-flex h-7 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors ${
                inspectorOpen
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Dados {currentContext.coins.length}</span>
            </button>
          </header>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Reading Area (~900px centered) */}
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4 lg:p-8">
            <div className="mx-auto w-full max-w-[900px] flex-1">
              {libraryView === 'saved' ? (
                <div className="space-y-4">
                  <div>
                    <h1 className="text-xl font-semibold text-foreground">Análises salvas</h1>
                    <p className="text-xs text-muted-foreground">
                      Respostas salvas localmente neste dispositivo via IndexedDB.
                    </p>
                  </div>

                  {savedAnalyses.length === 0 ? (
                    <div className="rounded-md border border-border bg-card p-8 text-center text-xs text-muted-foreground shadow-card">
                      Nenhuma análise salva ainda. Clique em <strong>Salvar análise</strong> em
                      qualquer resposta da conversa.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {savedAnalyses.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-border bg-card p-4 shadow-card"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] text-muted-foreground">{item.question}</p>
                              <h2 className="mt-0.5 text-sm font-semibold text-foreground">
                                {item.title}
                              </h2>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDeleteSaved(item.id)}
                              aria-label="Remover análise salva"
                              className="rounded p-1 text-muted-foreground hover:text-negative"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            {item.answer.summary}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onOpenReportWithContext(
                                  item.context.coins.slice(0, 6).map((c) => c.id)
                                )
                              }
                              className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
                            >
                              <FileText className="h-3 w-3 text-accent" aria-hidden="true" />
                              <span>Levar ao Caderno LCT</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : !activeConversation ? (
                /* Empty / New Analysis State (Centered Composer) */
                <div className="mx-auto flex min-h-full w-full max-w-[680px] flex-col items-center justify-center py-8">
                  <h1 className="mb-7 text-center text-2xl font-medium tracking-tight text-foreground sm:text-[28px]">
                    No que vamos trabalhar?
                  </h1>

                  <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card focus-within:border-accent/60">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSend();
                      }}
                      className="px-4 pb-3 pt-3.5"
                    >
                      <textarea
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (input.trim()) {
                              void handleSend();
                            }
                          }
                        }}
                        placeholder="Trabalhe com o Cipher..."
                        aria-label="Perguntar ao Cipher"
                        className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      />

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setContextPickerOpen((p) => !p)}
                          title="Selecionar universo de dados"
                          aria-label="Selecionar universo de dados"
                          aria-expanded={contextPickerOpen}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <div className="flex items-center gap-2.5">
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            {currentContext.source} · {currentContext.coins.length} ativos
                          </span>
                          <button
                            type="submit"
                            disabled={!input.trim()}
                            aria-label="Enviar análise"
                            title="Enviar"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-card transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </form>

                    {/* Attached Quick Actions Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-nav/70 px-4 py-2 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setContextPickerOpen((p) => !p)}
                          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                        >
                          <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Escolher universo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLibraryView('saved')}
                          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                        >
                          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Análises ({savedAnalyses.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectorOpen((p) => !p)}
                          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                        >
                          <Database className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Dados</span>
                        </button>
                      </div>

                      <span className="hidden font-mono text-[11px] text-muted-foreground/80 sm:inline">
                        Captura {formatTime(currentContext.capturedAt, preferences.timezone)}
                      </span>
                    </div>

                    {contextPickerOpen ? (
                      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 bg-background/50 px-4 py-2.5 text-xs">
                        <span className="text-[11px] text-muted-foreground">Universo:</span>
                        <button
                          type="button"
                          onClick={() => void handleSwitchUniverse('all')}
                          className="rounded-md border border-border bg-card px-2.5 py-1 text-foreground hover:border-accent/50 hover:bg-muted"
                        >
                          Todos ({liveCoins.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSwitchUniverse('top10')}
                          className="rounded-md border border-border bg-card px-2.5 py-1 text-foreground hover:border-accent/50 hover:bg-muted"
                        >
                          Top 10
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSwitchUniverse('losers')}
                          className="rounded-md border border-border bg-card px-2.5 py-1 text-foreground hover:border-accent/50 hover:bg-muted"
                        >
                          Em queda 24h
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Single-line Guided Suggestion Footer */}
                  {suggestions.length > 0 ? (
                    <div className="mt-5 flex w-full flex-col gap-1.5 px-2">
                      {suggestions.slice(0, 1).map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => void handleSend(sug)}
                          className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                        >
                          <Bot
                            className="h-4 w-4 shrink-0 text-accent transition-transform group-hover:scale-105"
                            aria-hidden="true"
                          />
                          <span className="truncate">{sug}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                /* Active Conversation */
                <div className="space-y-6 pb-8">
                  {/* Context Pills Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded border border-border bg-card px-2 py-0.5 font-medium text-foreground">
                        {currentContext.source} / {currentContext.coins.length} ativos
                      </span>
                      <span className="rounded border border-border bg-card px-2 py-0.5 text-muted-foreground">
                        Últimas 24h
                      </span>
                      <span className="rounded border border-border bg-card px-2 py-0.5 font-mono text-muted-foreground">
                        USD
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Captura das {formatTime(currentContext.capturedAt, preferences.timezone)}
                    </span>
                  </div>

                  {/* Messages */}
                  <div className="space-y-6">
                    {activeConversation.messages.map((msg, idx) => {
                      if (msg.role === 'divider') {
                        return (
                          <div
                            key={msg.id}
                            className="flex items-center gap-3 text-[11px] text-muted-foreground"
                          >
                            <div className="h-px flex-1 bg-border" />
                            <span className="font-mono">{msg.text}</span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                        );
                      }

                      if (msg.role === 'user') {
                        return (
                          <div key={msg.id} className="flex justify-end">
                            <div className="max-w-lg rounded-md border border-border bg-card px-3.5 py-2.5 text-xs font-medium text-foreground shadow-card">
                              {msg.text}
                            </div>
                          </div>
                        );
                      }

                      const answer = msg.answer;
                      if (!answer) return null;
                      const prevUserMsg = activeConversation.messages[idx - 1];
                      const questionText = prevUserMsg?.role === 'user' ? prevUserMsg.text : '';
                      const showTable = Boolean(tableViewByMsg[msg.id]);
                      const showEvidence = Boolean(evidenceOpenByMsg[msg.id]);
                      const maxBar =
                        answer.bars?.reduce((m, b) => Math.max(m, b.value), 0) || 1;

                      return (
                        <article key={msg.id} className="space-y-4">
                          <div>
                            <h2 className="text-base font-semibold text-foreground">
                              {answer.headline}
                            </h2>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                              {answer.summary}
                            </p>
                          </div>

                          {answer.bars && answer.bars.length > 0 ? (
                            <div className="rounded-md border border-border bg-card p-4 shadow-card">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-foreground">
                                    {answer.chartTitle}
                                  </p>
                                  {answer.chartSubtitle ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      {answer.chartSubtitle}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTableViewByMsg((p) => ({ ...p, [msg.id]: !p[msg.id] }))
                                  }
                                  className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-[11px] font-medium text-foreground hover:bg-muted"
                                >
                                  <Table className="h-3 w-3" aria-hidden="true" />
                                  <span>{showTable ? 'Ver gráfico' : 'Ver tabela'}</span>
                                </button>
                              </div>

                              {showTable && answer.evidence ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse text-left text-xs tabular-nums">
                                    <thead className="border-b border-border text-[10px] uppercase text-muted-foreground">
                                      <tr>
                                        <th className="py-1.5 pr-3">Ativo</th>
                                        <th className="py-1.5 px-3 text-right">Preço USD</th>
                                        <th className="py-1.5 px-3 text-right">24h</th>
                                        <th className="py-1.5 pl-3 text-right">Volume 24h</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {answer.evidence.rows.map((r) => (
                                        <tr key={r.symbol}>
                                          <td className="py-2 pr-3 font-mono font-semibold text-foreground">
                                            {r.symbol}{' '}
                                            <span className="font-sans font-normal text-muted-foreground">
                                              {r.name}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono">
                                            {formatCurrencyUSD(r.priceUsd, {
                                              locale: preferences.numberLocale,
                                            })}
                                          </td>
                                          <td
                                            className={`py-2 px-3 text-right font-mono ${
                                              r.change24h >= 0 ? 'text-positive' : 'text-negative'
                                            }`}
                                          >
                                            {formatPercent(r.change24h, preferences.numberLocale)}
                                          </td>
                                          <td className="py-2 pl-3 text-right font-mono">
                                            US${' '}
                                            {formatCompactNumber(
                                              r.volume24h,
                                              preferences.numberLocale
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="space-y-2.5">
                                  {answer.bars.map((bar) => {
                                    const widthPct = Math.min(
                                      100,
                                      Math.max(4, (bar.value / maxBar) * 100)
                                    );
                                    return (
                                      <div
                                        key={bar.id}
                                        className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 text-xs"
                                      >
                                        <span className="font-mono font-semibold text-foreground">
                                          {bar.symbol}
                                        </span>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                                          <div
                                            className="h-full rounded-full bg-accent"
                                            style={{ width: `${widthPct}%` }}
                                          />
                                        </div>
                                        <span className="font-mono font-medium tabular-nums text-foreground">
                                          {bar.formattedValue}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ) : null}

                          {answer.missingHistory ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={onOpenAnalytics}
                                className="inline-flex h-8 items-center gap-1.5 rounded border border-accent/40 bg-accent/15 px-3 text-xs font-medium text-accent hover:bg-accent/25"
                              >
                                <span>Abrir Analytics (séries diárias)</span>
                              </button>
                            </div>
                          ) : null}

                          {answer.suggestedFollowups && answer.suggestedFollowups.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {answer.suggestedFollowups.map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => void handleSend(sug)}
                                  className="rounded border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                                >
                                  {sug}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {/* Action Buttons on Response */}
                          <div className="flex flex-wrap items-center gap-2">
                            {answer.evidence ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setEvidenceOpenByMsg((p) => ({ ...p, [msg.id]: !p[msg.id] }))
                                }
                                className={`inline-flex h-7 items-center gap-1 rounded border px-2.5 text-[11px] font-medium ${
                                  showEvidence
                                    ? 'border-accent bg-accent/15 text-accent'
                                    : 'border-border bg-card text-foreground hover:bg-muted'
                                }`}
                              >
                                <Database className="h-3 w-3" aria-hidden="true" />
                                <span>Ver dados usados</span>
                              </button>
                            ) : null}

                            {answer.compareIds && answer.compareIds.length >= 2 ? (
                              <button
                                type="button"
                                onClick={() => onCompareCoins(answer.compareIds!)}
                                className="inline-flex h-7 items-center gap-1 rounded border border-border bg-card px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
                              >
                                <GitCompare className="h-3 w-3 text-accent" aria-hidden="true" />
                                <span>
                                  Comparar{' '}
                                  {answer.compareIds
                                    .map((id) =>
                                      currentContext.coins
                                        .find((c) => c.id === id)
                                        ?.symbol.toUpperCase()
                                    )
                                    .filter(Boolean)
                                    .join(' e ')}
                                </span>
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => void handleSaveAnalysis(questionText, answer)}
                              className="inline-flex h-7 items-center gap-1 rounded border border-border bg-card px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
                            >
                              <Bookmark className="h-3 w-3" aria-hidden="true" />
                              <span>Salvar análise</span>
                            </button>
                          </div>

                          {/* Evidence Drawer */}
                          {showEvidence && answer.evidence ? (
                            <div className="rounded-md border border-border bg-nav p-3 text-xs">
                              <p className="font-mono text-[11px] text-foreground">
                                {answer.evidence.formula}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Captura das{' '}
                                {formatTime(answer.evidence.capturedAt, preferences.timezone)} ·{' '}
                                {answer.evidence.rows.length} registros auditáveis
                              </p>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Prompt Bar when inside conversation */}
            {activeConversation && libraryView === 'chat' ? (
              <div className="mx-auto mt-auto w-full max-w-[900px] pt-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSend();
                  }}
                  className="rounded-md border border-border bg-card p-2.5 shadow-card"
                >
                  <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                    <span>Contexto: {currentContext.coins.length} ativos</span>
                    <span className="font-mono">
                      Captura {formatTime(currentContext.capturedAt, preferences.timezone)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Pergunte sobre estes dados..."
                      className="h-8 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="inline-flex h-8 items-center gap-1.5 rounded bg-accent px-3 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Enviar</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>

          {/* On-Demand Context Inspector Drawer */}
          {inspectorOpen ? (
            <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card text-xs">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-semibold text-foreground">Dados desta conversa</span>
                <button
                  type="button"
                  onClick={() => setInspectorOpen(false)}
                  aria-label="Fechar inspetor"
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <dl className="divide-y divide-border">
                  <div className="flex justify-between py-2">
                    <dt className="text-muted-foreground">Origem</dt>
                    <dd className="font-medium text-foreground">{currentContext.source}</dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-muted-foreground">Captura</dt>
                    <dd className="font-mono text-foreground">
                      {formatTime(currentContext.capturedAt, preferences.timezone)}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-muted-foreground">Universo</dt>
                    <dd className="font-mono text-foreground">
                      {currentContext.coins.length} de {currentContext.totalUniverseCount} ativos
                    </dd>
                  </div>
                  <div className="flex justify-between py-2">
                    <dt className="text-muted-foreground">Moeda</dt>
                    <dd className="font-mono text-foreground">USD</dd>
                  </div>
                </dl>

                {currentContext.filters && currentContext.filters.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Filtros herdados
                    </p>
                    <div className="space-y-1">
                      {currentContext.filters.map((f) => (
                        <div
                          key={f.id}
                          className="flex justify-between rounded border border-border bg-background px-2.5 py-1.5 font-mono text-[11px]"
                        >
                          <span className="text-muted-foreground">{f.field}</span>
                          <span className="text-foreground">
                            {f.operator} {f.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Ativos ({currentContext.coins.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {currentContext.coins.slice(0, 24).map((c) => (
                      <span
                        key={c.id}
                        className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {c.symbol.toUpperCase()}
                      </span>
                    ))}
                    {currentContext.coins.length > 24 ? (
                      <span className="px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        +{currentContext.coins.length - 24}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Histórico
                  </p>
                  <p className="text-muted-foreground">Série de preços: Não carregada</p>
                </div>
              </div>

              <div className="space-y-2 border-t border-border p-4">
                <button
                  type="button"
                  onClick={() => void handleUseNewerSnapshot()}
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded border border-border bg-background px-3 font-medium text-foreground hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  <span>Usar captura mais nova</span>
                </button>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
