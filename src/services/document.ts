import { DESIGN_STORAGE_KEY, useDesignStore } from '../stores/designStore';
import { pushFuture, pushPast, useHistoryStore } from '../stores/historyStore';
import type { Design } from '../types';

/**
 * The only write path for the design document.
 * The UI dispatches an intent, this applies it to a clone, records history, and swaps
 * the document into the store. Geometry is never mutated directly.
 */
export function commit(mutator: (draft: Design) => void): Design {
  const current = useDesignStore.getState().design;
  const draft = structuredClone(current);
  mutator(draft);
  draft.updatedAt = Date.now();
  draft.rollback = Math.max(0, Math.min(draft.rollback, draft.timeline.length));
  useHistoryStore.getState().record(current);
  useDesignStore.getState().setDesign(draft);
  return draft;
}

/** Commit an already-built document (used by the command layer). */
export function commitDesign(next: Design) {
  const current = useDesignStore.getState().design;
  const draft = structuredClone(next);
  draft.updatedAt = Date.now();
  draft.rollback = Math.max(0, Math.min(draft.rollback, draft.timeline.length));
  useHistoryStore.getState().record(current);
  useDesignStore.getState().setDesign(draft);
}

export function undo() {
  const previous = useHistoryStore.getState().takeUndo();
  if (!previous) return;
  pushFuture(useDesignStore.getState().design);
  useDesignStore.getState().replaceDesign(previous);
}

export function redo() {
  const next = useHistoryStore.getState().takeRedo();
  if (!next) return;
  pushPast(useDesignStore.getState().design);
  useDesignStore.getState().replaceDesign(next);
}

export function saveDesign() {
  const store = useDesignStore.getState();
  store.saveNow();
  return Date.now();
}

export function loadSample() {
  const store = useDesignStore.getState();
  store.resetToSample();
  useHistoryStore.getState().clear();
  try {
    localStorage.removeItem(DESIGN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
