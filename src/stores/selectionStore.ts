import { create } from 'zustand';
import type { Selection } from '../types';

export type SelectMode = 'replace' | 'add' | 'remove';

type SelectionState = {
  selection: Selection[];
  hovered: Selection | null;
  select: (selection: Selection | null, mode?: SelectMode) => void;
  setSelection: (selection: Selection[]) => void;
  hover: (selection: Selection | null) => void;
  clear: () => void;
};

function same(a: Selection, b: Selection) {
  return a.kind === b.kind && a.id === b.id && (a.subId ?? '') === (b.subId ?? '');
}

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  selection: [],
  hovered: null,

  select: (selection, mode = 'replace') => {
    if (!selection) {
      set({ selection: [] });
      return;
    }
    if (mode === 'replace') {
      set({ selection: [selection] });
      return;
    }
    const current = get().selection;
    const exists = current.some((item) => same(item, selection));
    if (mode === 'add') {
      set({ selection: exists ? current : [...current, selection] });
    } else if (exists) {
      set({ selection: current.filter((item) => !same(item, selection)) });
    }
  },

  setSelection: (selection) => set({ selection }),
  hover: (hovered) => set({ hovered }),
  clear: () => set({ selection: [], hovered: null }),
}));

export function selectionMatches(a: Selection, b: Selection) {
  return same(a, b);
}
