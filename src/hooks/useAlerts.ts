import { useCallback, useEffect, useState } from 'react';
import type { AlertEvent, AlertRule, CoinMarket } from '../types/crypto';
import { subscribeMarketSnapshot } from '../services/coingecko';

const RULES_STORAGE_KEY = 'lct-alert-rules-v1';
const EVENTS_STORAGE_KEY = 'lct-alert-events-v1';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useAlerts(coins: CoinMarket[], fetchedAt?: number) {
  const [rules, setRules] = useState<AlertRule[]>(() => readStorage(RULES_STORAGE_KEY, []));
  const [events, setEvents] = useState<AlertEvent[]>(() => readStorage(EVENTS_STORAGE_KEY, []));

  useEffect(() => {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    } catch {
      // Ignore storage errors
    }
  }, [rules]);

  useEffect(() => {
    try {
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch {
      // Ignore storage errors
    }
  }, [events]);

  // Subscribe to fresh market snapshots from the CoinGecko service
  useEffect(() => {
    return subscribeMarketSnapshot(({ coins: freshCoins, fetchedAt: ts }) => {
      if (freshCoins.length === 0) return;

      const coinMap = new Map(freshCoins.map((c) => [c.id, c]));
      const triggered: AlertEvent[] = [];

      setRules((prevRules) => {
        let changed = false;
        const nextRules = prevRules.map((rule) => {
          const coin = coinMap.get(rule.coinId);
          if (!coin) return rule;

          const current = rule.metric === 'price' ? coin.currentPrice : coin.priceChange24h;
          if (!Number.isFinite(current)) return rule;

          if (rule.status !== 'active') {
            if (rule.lastReading !== current) {
              changed = true;
              return { ...rule, lastReading: current, lastReadingAt: ts };
            }
            return rule;
          }

          const prev = rule.lastReading;
          const prevAt = rule.lastReadingAt ?? ts;

          if (prev === undefined) {
            changed = true;
            return { ...rule, lastReading: current, lastReadingAt: ts };
          }

          let armed = rule.armed;
          if (!armed) {
            if (rule.condition === 'cross_above' && current < rule.threshold) {
              armed = true;
              changed = true;
            } else if (rule.condition === 'cross_below' && current > rule.threshold) {
              armed = true;
              changed = true;
            }
          }

          const crossedAbove =
            rule.condition === 'cross_above' && prev < rule.threshold && current >= rule.threshold;
          const crossedBelow =
            rule.condition === 'cross_below' && prev > rule.threshold && current <= rule.threshold;

          if (armed && (crossedAbove || crossedBelow)) {
            changed = true;
            triggered.push({
              id: `evt-${ts}-${rule.id}`,
              ruleId: rule.id,
              coinId: coin.id,
              coinSymbol: coin.symbol.toUpperCase(),
              coinName: coin.name,
              metric: rule.metric,
              condition: rule.condition,
              thresholdSnapshot: rule.threshold,
              previousReading: prev,
              previousTimestamp: prevAt,
              triggeredReading: current,
              triggeredTimestamp: ts,
            });

            if (rule.repeat === 'once') {
              return {
                ...rule,
                status: 'paused' as const,
                armed: false,
                lastReading: current,
                lastReadingAt: ts,
              };
            }
            return {
              ...rule,
              armed: false,
              lastReading: current,
              lastReadingAt: ts,
            };
          }

          if (prev !== current || armed !== rule.armed) {
            changed = true;
            return { ...rule, armed, lastReading: current, lastReadingAt: ts };
          }
          return rule;
        });

        return changed ? nextRules : prevRules;
      });

      if (triggered.length > 0) {
        setEvents((prev) => [...triggered, ...prev].slice(0, 100));
      }
    });
  }, []);

  const createRule = useCallback(
    (input: Omit<AlertRule, 'id' | 'armed' | 'status' | 'lastReading' | 'lastReadingAt'>) => {
      const coin = coins.find((c) => c.id === input.coinId);
      const initialReading = coin
        ? input.metric === 'price'
          ? coin.currentPrice
          : coin.priceChange24h
        : undefined;

      const rule: AlertRule = {
        ...input,
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        status: 'active',
        armed: true,
        lastReading: initialReading,
        lastReadingAt: fetchedAt,
      };
      setRules((prev) => [rule, ...prev]);
      return rule;
    },
    [coins, fetchedAt]
  );

  const updateRule = useCallback((id: string, patch: Partial<Omit<AlertRule, 'id'>>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, armed: true } : r)));
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    rules,
    events,
    createRule,
    updateRule,
    deleteRule,
  };
}
