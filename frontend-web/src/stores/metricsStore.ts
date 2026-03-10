import { create } from 'zustand';
import { Hand } from '@types';

// Re-export Hand type for convenience
export type { Hand };

interface Metric {
  id: string;
  title: string;
  value: number | string;
  unit?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
  timestamp: Date;
}

interface ApiCost {
  inputTokens?: number;
  outputTokens?: number;
  total?: number;
}

interface HistoryEntry {
  timestamp: string;
  duration: number;
  apiCost?: ApiCost;
  error?: string;
  path?: string;
}

interface MetricsState {
  metrics: Metric[];
  history: HistoryEntry[];
  activeHands: Hand[];
  addMetric: (metric: Omit<Metric, 'id' | 'timestamp'>) => void;
  updateMetric: (id: string, updates: Partial<Metric>) => void;
  removeMetric: (id: string) => void;
  clearMetrics: () => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  setActiveHands: (hands: Hand[]) => void;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  metrics: [],
  history: [],
  activeHands: [],
  addMetric: (metric) =>
    set((state) => ({
      metrics: [
        ...state.metrics,
        { ...metric, id: crypto.randomUUID(), timestamp: new Date() },
      ],
    })),
  updateMetric: (id, updates) =>
    set((state) => ({
      metrics: state.metrics.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  removeMetric: (id) =>
    set((state) => ({
      metrics: state.metrics.filter((m) => m.id !== id),
    })),
  clearMetrics: () => set({ metrics: [] }),
  addHistoryEntry: (entry) =>
    set((state) => ({
      history: [...state.history, { ...entry, timestamp: new Date().toISOString() }],
    })),
  setActiveHands: (hands) => set({ activeHands: hands }),
}));
