import { create } from 'zustand';
import type { Design } from '../types';

const LIMIT = 80;

type HistoryState = {
  past: Design[];
  future: Design[];
  record: (snapshot: Design) => void;
  takeUndo: () => Design | null;
  takeRedo: () => Design | null;
  clear: () => void;
};

/** Undo/redo snapshot stacks. The document service swaps snapshots into designStore. */
export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],

  record: (snapshot) =>
    set((state) => ({ past: [...state.past, snapshot].slice(-LIMIT), future: [] })),

  takeUndo: () => {
    const { past } = get();
    if (!past.length) return null;
    set({ past: past.slice(0, -1) });
    return past[past.length - 1];
  },

  takeRedo: () => {
    const { future } = get();
    if (!future.length) return null;
    set({ future: future.slice(1) });
    return future[0];
  },

  clear: () => set({ past: [], future: [] }),
}));

export function pushFuture(snapshot: Design) {
  useHistoryStore.setState((state) => ({ future: [snapshot, ...state.future].slice(0, LIMIT) }));
}

export function pushPast(snapshot: Design) {
  useHistoryStore.setState((state) => ({ past: [...state.past, snapshot].slice(-LIMIT) }));
}
