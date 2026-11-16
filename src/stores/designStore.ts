import { create } from 'zustand';
import { createSampleDesign } from '../model/doc';
import type { Design } from '../types';

export const DESIGN_STORAGE_KEY = 'yantracad.design.v1';

type DesignState = {
  design: Design;
  dirty: boolean;
  lastSavedAt: number | null;
  setDesign: (design: Design) => void;
  replaceDesign: (design: Design, opts?: { dirty?: boolean }) => void;
  markSaved: (at: number) => void;
  saveNow: () => void;
  resetToSample: () => void;
};

function loadInitial(): { design: Design; lastSavedAt: number | null } {
  try {
    const raw = localStorage.getItem(DESIGN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { design?: Design; savedAt?: number };
      if (parsed?.design && Array.isArray(parsed.design.timeline)) {
        return { design: parsed.design, lastSavedAt: parsed.savedAt ?? null };
      }
    }
  } catch {
    /* ignore unreadable storage */
  }
  return { design: createSampleDesign(), lastSavedAt: null };
}

const initial = loadInitial();

/** Holds the design document only. All edits go through services/document.ts. */
export const useDesignStore = create<DesignState>()((set, get) => ({
  design: initial.design,
  dirty: false,
  lastSavedAt: initial.lastSavedAt,

  setDesign: (design) => set({ design, dirty: true }),

  replaceDesign: (design, opts) => set({ design, dirty: opts?.dirty ?? true }),

  markSaved: (at) => set({ dirty: false, lastSavedAt: at }),

  saveNow: () => {
    const { design } = get();
    try {
      const at = Date.now();
      localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify({ design, savedAt: at }));
      set({ dirty: false, lastSavedAt: at });
    } catch {
      /* storage full or unavailable */
    }
  },

  resetToSample: () => {
    const design = createSampleDesign();
    set({ design, dirty: true });
  },
}));
