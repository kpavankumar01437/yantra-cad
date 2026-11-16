# Yantra CAD — review pack

A browser-based mechanical CAD workspace (React 19 + TypeScript + Vite + Tailwind + Zustand + React Three Fiber/Three.js + Zod + Lucide). This document is the architecture and evidence package; screenshots live in `artifacts/review/` and the same content is published as a plain-HTML page.

- **Live app:** https://site-45f0583ab1dd4bd09aec9ad1f6315563.freebuff.page
- **Readable review page (no JavaScript):** https://site-45f0583ab1dd4bd09aec9ad1f6315563.freebuff.page/review/
- **Screenshots:** `artifacts/review/01-workspace.png` … `09-panel-timeline.png`
- **Source bundle:** `artifacts/yantra-cad-source.zip`

The app is a WebGL SPA: its HTML is pre-rendered for crawlers (1.9k characters of real UI text), but orbiting, raycast picking and commands need a real browser with WebGL. A text fetcher can read the page structure, the review page and the screenshots; it cannot execute the canvas.

## 1. Component and folder structure

```
src/
  main.tsx                  React root
  index.css                 Tailwind layers + component classes (panel, tool-btn, menu, badge, num)
  types.ts                  document + selection types
  geometry/solid.ts         SolidSpec → BufferGeometry, earcut triangulation with holes, shell,
                            fillet rounding, coplanar face area, volume, plane transforms
  model/
    expressions.ts          parameter evaluation (arithmetic + references)
    profile.ts              sketch entities → closed polygon + nested holes
    sketch.ts               simplified constraint solver, DOF estimate, dimension measure/apply
    regenerate.ts           timeline replay → solids + per-feature status
    doc.ts                  sample Mounting Bracket design
  stores/                   designStore, selectionStore, commandStore, historyStore, uiStore
  services/
    document.ts             only write path: commit(mutator) → clone, snapshot, swap
    commands.ts             command fields/defaults, build, preview, commit, undo/redo
    validation.ts           Zod structural + semantic expression validation
    actions.ts              delete/rename/visibility/material/transform/parameter/sketch mutations
    geometry.ts             derived metrics + useRegenerated()
    versions.ts             localStorage version snapshots
  components/
    App.tsx                 layout, hotkeys, autosave, toast
    TopBar · WorkspaceTabs · Toolbar · StatusBar
    BrowserPanel · PropertiesPanel · CommandPanel · Timeline
    Viewport3D.tsx          R3F scene: bodies, picking, sketch plane/lines, preview, camera rig
    viewport/sketchMath.ts  snap resolution + sketch/draft line generation
    ContextMenu · Dialogs · WorkspacePlaceholder
sites/index.js              static asset worker, SPA fallback, real 404s for /assets/*
sites/app-shell.html        pre-rendered first paint injected at build time
scripts/inject-shell.mjs    postbuild step that injects the shell into dist/index.html
public/review/              plain-HTML review page + screenshots
```

## 2. Zustand store design

| Store | Owns | Actions |
| --- | --- | --- |
| `designStore` | the Design document only, dirty flag, last save | `setDesign`, `replaceDesign`, `saveNow`, `resetToSample` |
| `selectionStore` | selected objects (face area/normal, edge length), hovered object | `select(item, mode)`, `hover`, `clear` |
| `commandStore` | one active command, string inputs, field errors | `start`, `setInput`, `setErrors`, `cancel` |
| `historyStore` | undo/redo snapshot stacks (limit 80) | `record`, `takeUndo`, `takeRedo` |
| `uiStore` | workspace, display mode, grid/snap, panels, sketch session, dialogs, toast | `setWorkspace`, `setDisplayMode`, `startSketchSession`, `notify` |

UI never mutates geometry; every edit goes through `commit()`:

```ts
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
```

Solids are derived, never stored: `regenerate(design)` replays the active timeline.

## 3. TypeScript data model (abridged)

```ts
type Design = {
  id; name; units;
  components: Component[]; bodies: Body[]; sketches: Sketch[]; features: Feature[];
  parameters: Parameter[]; joints: Joint[]; timeline: TimelineEntry[];
  rollback: number; updatedAt: number;
};

type Sketch = { id; name; componentId; plane: 'XY'|'XZ'|'YZ';
  entities: SketchEntity[];   // line | polyline | rect | circle
  constraints: Constraint[];  // horizontal | vertical | coincident | parallel | perpendicular
  dimensions: Dimension[];    // expression text, evaluated against parameters
};

type Feature =
  | { kind: 'extrude'; sketchId; distance: string; operation: 'new'|'cut'; bodyId }
  | { kind: 'fillet';  bodyId; radius: string }
  | { kind: 'shell';   bodyId; thickness: string }
  | { kind: 'move';    bodyId; offset: { x: string; y: string; z: string } };
// plus id, name, componentId, suppressed

type Selection = {
  kind: 'body'|'face'|'edge'|'sketch'|'sketchEntity'|'feature'|'component'|'parameter'|'joint'|'plane';
  id; bodyId?; subId?;
  face?: { area; normal; point };
  edge?: { length; start; end };
};
```

## 4. UI wireframe

```
┌────────────────────────────────────────────────────────────────────┐
│ Top bar  logo · design name · save state · undo/redo · save · share │
├────────────────────────────────────────────────────────────────────┤
│ Design · Sketch · Render(soon) · Simulation(soon) · …              │
├────────────────────────────────────────────────────────────────────┤
│ Toolbar  New Sketch · Extrude · Fillet · Shell · Move · Delete · … │
├──────────────┬───────────────────────────────┬─────────────────────┤
│ BROWSER 300  │  3D CANVAS (R3F)              │ PROPERTIES / CMD 340│
│ Design       │  grid, axes, shaded+edges     │ selection driven    │
│  Origin      │  hover / selected highlight   │ fields, metrics,    │
│  Components  │  orbit · pan · zoom · fit     │ validation          │
│   Bodies     │  standard views, wireframe    │                     │
│   Sketches   │  live command preview         │                     │
│   Features   │                               │                     │
│  Joints      │                               │                     │
│  Parameters  │                               │                     │
├──────────────┴───────────────────────────────┴─────────────────────┤
│ TIMELINE  Sketch1 → Extrude1 → Fillet1 → Sketch2 → …                │
├────────────────────────────────────────────────────────────────────┤
│ Status  selection · units · grid/snap · errors/warnings · kernel    │
└────────────────────────────────────────────────────────────────────┘
```

## 5. Milestone plan — delivered

| Step | Scope | State |
| --- | --- | --- |
| M1 | Shell layout, theme, five stores, document model, sample design | done |
| M2 | Interactive viewport: orbit/pan/zoom, grid, axes, lights, picking, hover/selection, fit, views, display modes | done |
| M3 | Browser tree, Properties per selection kind, status bar | done |
| M4 | Sketch workspace: plane session, line/rect/circle/polyline, snapping, dimensions, constraints, DOF badge | done |
| M5 | Command framework + Extrude (new body / cut) with Zod validation, expressions, preview, commit | done |
| M6 | Timeline: select, edit, rollback, suppress, rename, delete, error badges | done |
| M7 | Undo/redo on every commit, autosave, versions, share, hotkeys | done |
| M8 | Fillet / Shell / Move on the same framework | done (prismatic approximations) |
| Next | WASM B-rep kernel behind the `SolidSpec` seam, edge fillets, real solver, project files | planned |

## 6. Measured verification on the deployed build

| Check | Result |
| --- | --- |
| Build | `tsc --noEmit` + Vite pass (only the expected three.js chunk warning) |
| Initial | 3 bodies, timeline 9/9, nothing selected |
| Canvas face pick | `Face · Base Plate / Body1 · 3978.3 mm²`, normal `0.00 0.00 1.00` |
| Browser sync | 1 row highlighted (`Base Plate → Body1`), Properties header `BASE PLATE / BODY1 · Face` |
| Body properties | volume 23869.9 mm³, area 9465.0 mm², bbox 80.0 × 50.0 × 6.0 mm, 204 triangles |
| Extrude | fields + live “Preview ready”, OK commits |
| Commit | timeline 9 → 10/10, bodies 3 → 4, new `Body2` in Side Wall |
| Ctrl+Z | 9/9, 3 bodies |
| Ctrl+Shift+Z | 10/10, 4 bodies |
| Sketch session | Select/Line/Rect/Circle/Polyline, five constraints, Finish, camera frames plane |
| Sketch → rectangle | 2 clicks → 1 entity + width/height dimensions |
| Sketch → extrude | new body, timeline and Browser update |
| Deep links | `/design` 200 html, hashed JS 200 `text/javascript`, missing asset 404 |

## 7. Deliberate limits

- Mock prismatic kernel: extrusion, through holes, rounded profile corners, shelled prisms, moves — no NURBS or general booleans.
- Simplified sketch solver: rectangle/circle dimensions are exact, line constraints iterate.
- Saving is per-browser (`localStorage`); no backend, accounts or collaboration.
- Simulation, CAM, PCB, drawings and motion are “coming soon” workspaces only.
