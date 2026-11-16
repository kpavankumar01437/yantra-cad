import { useMemo } from 'react';
import { create } from 'zustand';
import type { Doc, FaceInfo, PlaneId, Selection, SketchEntity, Vec2 } from '../types';
import { createDefaultDoc, newId, uniqueName } from '../model/doc';
import { buildCommand, commandDefaults, featureInputs, type CommandId, type CommandState } from '../model/commands';
import { regenerate, type Regenerated } from '../model/regenerate';

const STORAGE_KEY = 'yantralab.cad.doc.v1';

export type Workspace = 'design' | 'sketch' | 'render' | 'simulation' | 'manufacture' | 'drawing';
export type SketchTool = 'rect' | 'circle' | 'line';
export type DisplayMode = 'shadedEdges' | 'shaded' | 'wireframe';

export const STORAGE_KEY = 'yantralab.cad.doc.v1';

export type SketchSession = {
  sketchId: string;
  tool: SketchTool;
  pending: Vec2[];
  cursor: Vec2 | null;
};

function loadDoc(): Doc {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Doc;
      if (parsed && Array.isArray(parsed.timeline) && Array.isArray(parsed.features)) return parsed;
    }
  } catch {
    /* corrupt or unavailable storage: start from the sample design */
  }
  return createDefaultDoc();
}

type DesignState = {
  doc: Doc;
  selection: Selection[];
  hoverBodyId: string | null;
  hoverFace: FaceInfo | null;
  pickedFace: FaceInfo | null;
  workspace: Workspace;
  cmd: CommandState | null;
  cmdError: string | null;
  sketchSession: SketchSession | null;
  displayMode: DisplayMode;
  grid: boolean;
  past: Doc[];
  future: Doc[];
  saved: boolean;

  commitDoc: (mut: (draft: Doc) => void) => void;
  select: (selection: Selection | null, additive?: boolean) => void;
  setHover: (bodyId: string | null, face: FaceInfo | null) => void;
  setPickedFace: (face: FaceInfo | null) => void;
  toggleBody: (id: string) => void;
  toggleComponent: (id: string) => void;
  setParameter: (id: string, expression: string) => void;
  setRectSize: (sketchId: string, entityId: string, width: number, height: number) => void;
  setCircleRadius: (sketchId: string, entityId: string, radius: number) => void;
  deleteSketchEntity: (sketchId: string, entityId: string) => void;
  startCommand: (id: CommandId, featureId?: string) => void;
  setCommandInput: (key: string, value: string) => void;
  commitCommand: () => void;
  cancelCommand: () => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
  rollbackTo: (index: number) => void;
  rollbackEnd: () => void;
  setWorkspace: (workspace: Workspace) => void;
  renameDoc: (name: string) => void;
  startSketchOnPlane: (plane: PlaneId) => void;
  finishSketch: () => void;
  setSketchTool: (tool: SketchTool) => void;
  sketchClick: (point: Vec2) => void;
  setSketchCursor: (point: Vec2 | null) => void;
  clearSketchPending: () => void;
  setDisplayMode: (mode: DisplayMode) => void;
  toggleGrid: () => void;
  markSaved: () => void;
  resetDoc: () => void;
};

function cascadeDeleteBody(draft: Doc, bodyIds: string[]) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const feature of [...draft.features]) {
      if (feature.kind !== 'extrude' && bodyIds.includes(feature.bodyId)) {
        draft.features = draft.features.filter((f) => f.id !== feature.id);
        draft.timeline = draft.timeline.filter((e) => e.refId !== feature.id);
        changed = true;
      }
    }
    for (const feature of [...draft.features]) {
      if (feature.kind === 'extrude' && bodyIds.includes(feature.bodyId)) {
        draft.features = draft.features.filter((f) => f.id !== feature.id);
        draft.timeline = draft.timeline.filter((e) => e.refId !== feature.id);
        changed = true;
      }
    }
  }
  draft.bodies = draft.bodies.filter((b) => !bodyIds.includes(b.id));
}

export const useDesign = create<DesignState>()((set, get) => ({
  doc: loadDoc(),
  selection: [{ kind: 'body', id: 'b_plate' }],
  hoverBodyId: null,
  hoverFace: null,
  pickedFace: null,
  workspace: 'design',
  cmd: null,
  cmdError: null,
  sketchSession: null,
  displayMode: 'shadedEdges',
  grid: true,
  past: [],
  future: [],
  saved: true,

  commitDoc: (mut) =>
    set((s) => {
      const draft = structuredClone(s.doc);
      mut(draft);
      draft.rollback = Math.max(0, Math.min(draft.rollback, draft.timeline.length));
      return {
        doc: draft,
        past: [...s.past, s.doc].slice(-60),
        future: [],
        saved: false,
      };
    }),

  select: (selection, additive = false) => {
    if (!selection) {
      set({ selection: [] });
      return;
    }
    const current = get().selection;
    const exists = current.some((s) => s.kind === selection.kind && s.id === selection.id);
    if (additive) {
      set({
        selection: exists
          ? current.filter((s) => !(s.kind === selection.kind && s.id === selection.id))
          : [...current, selection],
      });
    } else {
      set({ selection: [selection] });
    }
  },

  setHover: (hoverBodyId, hoverFace) => set({ hoverBodyId, hoverFace }),

  setPickedFace: (pickedFace) => set({ pickedFace }),

  toggleBody: (id) =>
    get().commitDoc((draft) => {
      const body = draft.bodies.find((b) => b.id === id);
      if (body) body.visible = !body.visible;
    }),

  toggleComponent: (id) =>
    get().commitDoc((draft) => {
      const component = draft.components.find((c) => c.id === id);
      if (component) component.visible = !component.visible;
    }),

  setParameter: (id, expression) =>
    get().commitDoc((draft) => {
      const parameter = draft.parameters.find((p) => p.id === id);
      if (parameter) parameter.expression = expression;
    }),

  setRectSize: (sketchId, entityId, width, height) =>
    get().commitDoc((draft) => {
      const entity = draft.sketches.find((s) => s.id === sketchId)?.entities.find((e) => e.id === entityId);
      if (!entity || entity.kind !== 'rect') return;
      const centerX = (entity.a.x + entity.b.x) / 2;
      const centerY = (entity.a.y + entity.b.y) / 2;
      const w = Math.max(0.5, width);
      const h = Math.max(0.5, height);
      entity.a = { x: centerX - w / 2, y: centerY - h / 2 };
      entity.b = { x: centerX + w / 2, y: centerY + h / 2 };
    }),

  setCircleRadius: (sketchId, entityId, radius) =>
    get().commitDoc((draft) => {
      const entity = draft.sketches.find((s) => s.id === sketchId)?.entities.find((e) => e.id === entityId);
      if (!entity || entity.kind !== 'circle') return;
      entity.r = Math.max(0.25, radius);
    }),

  deleteSketchEntity: (sketchId, entityId) =>
    get().commitDoc((draft) => {
      const sketch = draft.sketches.find((s) => s.id === sketchId);
      if (sketch) sketch.entities = sketch.entities.filter((e) => e.id !== entityId);
    }),

  startCommand: (id, featureId) => {
    const { doc, selection } = get();
    if (featureId) {
      const feature = doc.features.find((f) => f.id === featureId);
      if (!feature) return;
      set({
        cmd: { id: feature.kind, inputs: featureInputs(feature), editingFeatureId: feature.id },
        cmdError: null,
      });
      return;
    }
    set({
      cmd: { id, inputs: commandDefaults(doc, selection, id) },
      cmdError: null,
    });
  },

  setCommandInput: (key, value) =>
    set((s) => (s.cmd ? { cmd: { ...s.cmd, inputs: { ...s.cmd.inputs, [key]: value } }, cmdError: null } : s)),

  commitCommand: () => {
    const { cmd, doc, selection } = get();
    if (!cmd) return;
    const result = buildCommand(doc, cmd, selection);
    if (result.error || !result.doc) {
      set({ cmdError: result.error ?? 'The operation could not be built' });
      return;
    }
    const next = result.doc;
    next.rollback = next.timeline.length;

    if (cmd.id === 'newSketch' && result.featureId) {
      set((s) => ({
        doc: next,
        past: [...s.past, doc].slice(-60),
        future: [],
        cmd: null,
        cmdError: null,
        saved: false,
        workspace: 'sketch',
        sketchSession: {
          sketchId: result.featureId as string,
          tool: 'rect',
          pending: [],
          cursor: null,
        },
        selection: [{ kind: 'sketch', id: result.featureId }],
      }));
      return;
    }

    set((s) => ({
      doc: next,
      past: [...s.past, doc].slice(-60),
      future: [],
      cmd: null,
      cmdError: null,
      saved: false,
      selection: cmd.editingFeatureId
        ? s.selection
        : result.bodyId
          ? [{ kind: 'body', id: result.bodyId }]
          : s.selection,
    }));
  },

  cancelCommand: () => set({ cmd: null, cmdError: null }),

  deleteSelection: () => {
    const { selection, commitDoc } = get();
    const target = selection[0];
    if (!target) return;

    if (target.kind === 'body') {
      commitDoc((draft) => cascadeDeleteBody(draft, [target.id]));
    } else if (target.kind === 'feature') {
      const feature = get().doc.features.find((f) => f.id === target.id);
      if (!feature) return;
      commitDoc((draft) => {
        if (feature.kind === 'extrude') cascadeDeleteBody(draft, [feature.bodyId]);
        draft.features = draft.features.filter((f) => f.id !== feature.id);
        draft.timeline = draft.timeline.filter((e) => e.refId !== feature.id);
      });
    } else if (target.kind === 'sketch') {
      commitDoc((draft) => {
        const extrudes = draft.features.filter((f) => f.kind === 'extrude' && f.sketchId === target.id);
        cascadeDeleteBody(draft, extrudes.map((f) => (f.kind === 'extrude' ? f.bodyId : '')));
        draft.sketches = draft.sketches.filter((s) => s.id !== target.id);
        draft.timeline = draft.timeline.filter((e) => e.refId !== target.id);
      });
    } else {
      return;
    }
    set({ selection: [] });
  },

  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const previous = s.past[s.past.length - 1];
      return {
        doc: previous,
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future].slice(0, 60),
        saved: false,
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0];
      return {
        doc: next,
        past: [...s.past, s.doc].slice(-60),
        future: s.future.slice(1),
        saved: false,
      };
    }),

  rollbackTo: (index) =>
    get().commitDoc((draft) => {
      draft.rollback = Math.max(0, Math.min(index, draft.timeline.length));
    }),

  rollbackEnd: () =>
    get().commitDoc((draft) => {
      draft.rollback = draft.timeline.length;
    }),

  setWorkspace: (workspace) => set({ workspace }),

  renameDoc: (name) =>
    get().commitDoc((draft) => {
      draft.name = name.trim() || 'Untitled Design';
    }),

  startSketchOnPlane: (plane) => {
    get().startCommand('newSketch');
    const state = get();
    if (!state.cmd) return;
    state.setCommandInput('plane', plane);
    get().commitCommand();
  },

  finishSketch: () => set({ workspace: 'design', sketchSession: null }),

  setSketchTool: (tool) =>
    set((s) =>
      s.sketchSession
        ? { sketchSession: { ...s.sketchSession, tool, pending: [] } }
        : s,
    ),

  sketchClick: (point) => {
    const { sketchSession, commitDoc } = get();
    if (!sketchSession) return;
    const { tool, pending, sketchId } = sketchSession;

    if (tool === 'line') {
      if (pending.length === 0) {
        set({ sketchSession: { ...sketchSession, pending: [point] } });
        return;
      }
      const from = pending[pending.length - 1];
      if (Math.hypot(point.x - from.x, point.y - from.y) < 0.4) return;
      commitDoc((draft) => {
        const sketch = draft.sketches.find((s) => s.id === sketchId);
        if (sketch) sketch.entities.push({ id: newId('e'), kind: 'line', a: from, b: point });
      });
      set({ sketchSession: { ...get().sketchSession!, pending: [point] } });
      return;
    }

    if (pending.length === 0) {
      set({ sketchSession: { ...sketchSession, pending: [point] } });
      return;
    }

    const first = pending[0];
    if (tool === 'rect') {
      const width = Math.abs(point.x - first.x);
      const height = Math.abs(point.y - first.y);
      if (width >= 0.5 && height >= 0.5) {
        commitDoc((draft) => {
          const sketch = draft.sketches.find((s) => s.id === sketchId);
          const entity: SketchEntity = { id: newId('e'), kind: 'rect', a: first, b: point };
          if (sketch) sketch.entities.push(entity);
        });
      }
      set({ sketchSession: { ...get().sketchSession!, pending: [] } });
      return;
    }

    const radius = Math.hypot(point.x - first.x, point.y - first.y);
    if (radius >= 0.5) {
      commitDoc((draft) => {
        const sketch = draft.sketches.find((s) => s.id === sketchId);
        const entity: SketchEntity = { id: newId('e'), kind: 'circle', c: first, r: radius };
        if (sketch) sketch.entities.push(entity);
      });
    }
    set({ sketchSession: { ...get().sketchSession!, pending: [] } });
  },

  setSketchCursor: (cursor) =>
    set((s) => (s.sketchSession ? { sketchSession: { ...s.sketchSession, cursor } } : s)),

  clearSketchPending: () =>
    set((s) => (s.sketchSession ? { sketchSession: { ...s.sketchSession, pending: [] } } : s)),

  setDisplayMode: (displayMode) => set({ displayMode }),
  toggleGrid: () => set((s) => ({ grid: !s.grid })),
  markSaved: () => set({ saved: true }),
  resetDoc: () =>
    set({
      doc: createDefaultDoc(),
      selection: [],
      past: [],
      future: [],
      cmd: null,
      sketchSession: null,
      workspace: 'design',
      saved: false,
    }),
}));

/** Regenerated geometry for the current document. */
export function useRegenerated(): Regenerated {
  const doc = useDesign((s) => s.doc);
  return useMemo(() => regenerate(doc), [doc]);
}

export function useDocName(): string {
  return useDesign((s) => s.doc.name);
}

export { uniqueName };
