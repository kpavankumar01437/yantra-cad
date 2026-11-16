import { create } from 'zustand';
import type { Selection, Vec2 } from '../types';

export type Workspace = 'design' | 'sketch' | 'render' | 'simulation' | 'manufacture' | 'drawing';
export type DisplayMode = 'shaded' | 'shadedEdges' | 'wireframe';
export type SketchTool = 'select' | 'line' | 'rectangle' | 'circle' | 'polyline';

export type SketchSession = {
  sketchId: string;
  tool: SketchTool;
  pendingPoints: Vec2[];
  cursor: Vec2 | null;
  snap: 'grid' | 'point' | 'axis' | null;
  selectedEntityId: string | null;
};

export type DialogState =
  | { kind: 'share' }
  | { kind: 'versions' }
  | { kind: 'rename'; target: Selection; value: string }
  | null;

export type ContextTarget =
  | { kind: 'body'; id: string }
  | { kind: 'feature'; id: string }
  | { kind: 'sketch'; id: string }
  | { kind: 'component'; id: string }
  | { kind: 'parameter'; id: string }
  | { kind: 'timeline'; index: number }
  | { kind: 'canvas' }
  | null;

export type ContextMenuState = { x: number; y: number; target: ContextTarget } | null;

type UiState = {
  workspace: Workspace;
  displayMode: DisplayMode;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  units: 'mm' | 'cm' | 'in';
  browserOpen: boolean;
  propertiesOpen: boolean;
  sketchSession: SketchSession | null;
  dialog: DialogState;
  contextMenu: ContextMenuState;
  toast: { message: string; tone: 'ok' | 'error' | 'info' } | null;

  setWorkspace: (workspace: Workspace) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setUnits: (units: 'mm' | 'cm' | 'in') => void;
  toggleBrowser: () => void;
  toggleProperties: () => void;
  startSketchSession: (sketchId: string) => void;
  patchSketchSession: (patch: Partial<SketchSession>) => void;
  endSketchSession: () => void;
  setDialog: (dialog: DialogState) => void;
  openContextMenu: (x: number, y: number, target: ContextTarget) => void;
  closeContextMenu: () => void;
  notify: (message: string, tone?: 'ok' | 'error' | 'info') => void;
  clearToast: () => void;
};

export const useUiStore = create<UiState>()((set) => ({
  workspace: 'design',
  displayMode: 'shadedEdges',
  showGrid: true,
  snapToGrid: true,
  gridSize: 5,
  units: 'mm',
  browserOpen: true,
  propertiesOpen: true,
  sketchSession: null,
  dialog: null,
  contextMenu: null,
  toast: null,

  setWorkspace: (workspace) => set({ workspace }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  setUnits: (units) => set({ units }),
  toggleBrowser: () => set((s) => ({ browserOpen: !s.browserOpen })),
  toggleProperties: () => set((s) => ({ propertiesOpen: !s.propertiesOpen })),

  startSketchSession: (sketchId) =>
    set({
      workspace: 'sketch',
      sketchSession: { sketchId, tool: 'rectangle', pendingPoints: [], cursor: null, snap: null, selectedEntityId: null },
    }),

  patchSketchSession: (patch) =>
    set((state) => (state.sketchSession ? { sketchSession: { ...state.sketchSession, ...patch } } : state)),

  endSketchSession: () => set((state) => ({ sketchSession: null, workspace: state.workspace === 'sketch' ? 'design' : state.workspace })),

  setDialog: (dialog) => set({ dialog }),
  openContextMenu: (x, y, target) => set({ contextMenu: { x, y, target } }),
  closeContextMenu: () => set({ contextMenu: null }),
  notify: (message, tone = 'info') => set({ toast: { message, tone } }),
  clearToast: () => set({ toast: null }),
}));
