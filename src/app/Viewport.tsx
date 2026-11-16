import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { rectPolygon, sketchToLines } from '../geometry/solid';
import { commandPreview } from '../model/commands';
import { useDesign, useRegenerated, type SketchSession } from '../store/designStore';
import type { Doc, Vec2 } from '../types';
import { SceneManager, type SceneBody, type SceneDraft, type SceneSketch, type ViewName } from '../viewport/SceneManager';
import { Icon } from './icons';
import { viewportBus } from './viewportBus';

const SNAP_STEP = 5;
const SNAP_RADIUS = 3.5;

function snapPoint(point: Vec2, doc: Doc, sketchId: string): Vec2 {
  const sketch = doc.sketches.find((s) => s.id === sketchId);
  const candidates: Vec2[] = [];
  for (const entity of sketch?.entities ?? []) {
    if (entity.kind === 'rect') {
      candidates.push(...rectPolygon(entity.a, entity.b));
    } else if (entity.kind === 'circle') {
      candidates.push(entity.c, { x: entity.c.x + entity.r, y: entity.c.y });
    } else {
      candidates.push(entity.a, entity.b);
    }
  }
  for (const candidate of candidates) {
    if (Math.hypot(candidate.x - point.x, candidate.y - point.y) < SNAP_RADIUS) return candidate;
  }
  return {
    x: Math.round(point.x / SNAP_STEP) * SNAP_STEP,
    y: Math.round(point.y / SNAP_STEP) * SNAP_STEP,
  };
}

function isBodyVisible(doc: Doc, bodyId: string): boolean {
  const body = doc.bodies.find((b) => b.id === bodyId);
  if (!body || !body.visible) return false;
  let componentId: string | null = body.componentId;
  while (componentId) {
    const component = doc.components.find((c) => c.id === componentId);
    if (!component) break;
    if (!component.visible) return false;
    componentId = component.parentId;
  }
  return true;
}

function buildDraft(session: SketchSession, plane: SceneSketch['plane']): SceneDraft {
  const { pending, cursor, tool } = session;
  if (!cursor || pending.length === 0) return null;
  const anchor = pending[pending.length - 1];

  if (tool === 'rect') {
    const cornerA = { x: anchor.x, y: cursor.y };
    const cornerB = { x: cursor.x, y: anchor.y };
    return {
      plane,
      lines: [
        [anchor, cornerA],
        [cornerA, cursor],
        [cursor, cornerB],
        [cornerB, anchor],
      ],
      circles: [],
    };
  }
  if (tool === 'circle') {
    const radius = Math.hypot(cursor.x - anchor.x, cursor.y - anchor.y);
    return { plane, lines: [[anchor, cursor]], circles: [{ c: anchor, r: radius }] };
  }
  return { plane, lines: [[anchor, cursor]], circles: [] };
}

export function Viewport() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<SceneManager | null>(null);
  const pointer = useRef<{ x: number; y: number; button: number; moved: boolean } | null>(null);

  const doc = useDesign((s) => s.doc);
  const regen = useRegenerated();
  const selection = useDesign((s) => s.selection);
  const hoverBodyId = useDesign((s) => s.hoverBodyId);
  const displayMode = useDesign((s) => s.displayMode);
  const grid = useDesign((s) => s.grid);
  const workspace = useDesign((s) => s.workspace);
  const cmd = useDesign((s) => s.cmd);
  const sketchSession = useDesign((s) => s.sketchSession);
  const setHover = useDesign((s) => s.setHover);
  const select = useDesign((s) => s.select);
  const setPickedFace = useDesign((s) => s.setPickedFace);
  const sketchClick = useDesign((s) => s.sketchClick);
  const setSketchCursor = useDesign((s) => s.setSketchCursor);
  const setDisplayMode = useDesign((s) => s.setDisplayMode);
  const toggleGrid = useDesign((s) => s.toggleGrid);

  const selectedBodyId = selection.find((item) => item.kind === 'body')?.id ?? null;
  const activeSketch = sketchSession ? doc.sketches.find((s) => s.id === sketchSession.sketchId) : undefined;
  const preview = useMemo(() => (cmd ? commandPreview(doc, cmd, selection) : null), [cmd, doc, selection]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const manager = new SceneManager(host);
    managerRef.current = manager;
    manager.frame();
    viewportBus.fit = () => manager.frame();
    viewportBus.view = (view: ViewName) => manager.setView(view);
    return () => {
      viewportBus.fit = undefined;
      viewportBus.view = undefined;
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    const bodies: SceneBody[] = regen.bodyOrder.map((bodyId) => ({
      bodyId,
      spec: regen.bodies[bodyId].spec,
      visible: isBodyVisible(doc, bodyId),
    }));

    const sketches: SceneSketch[] = doc.sketches.map((sketch) => ({
      sketchId: sketch.id,
      plane: sketch.plane,
      ...sketchToLines(sketch),
      active: sketch.id === sketchSession?.sketchId,
      visible: true,
    }));

    const draft = sketchSession && activeSketch ? buildDraft(sketchSession, activeSketch.plane) : null;

    manager.update({
      bodies,
      sketches,
      draft,
      preview: preview?.spec ?? null,
      displayMode,
      grid,
      sketchPlane: activeSketch?.plane ?? null,
      selectedBodyId,
      hoverBodyId,
    });
  }, [
    regen,
    doc,
    sketchSession,
    activeSketch,
    preview,
    displayMode,
    grid,
    selectedBodyId,
    hoverBodyId,
  ]);

  useEffect(() => {
    managerRef.current?.setSketchInteraction(Boolean(activeSketch));
  }, [activeSketch]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointer.current = { x: event.clientX, y: event.clientY, button: event.button, moved: false };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const manager = managerRef.current;
    if (!manager) return;

    if (pointer.current) {
      const moved = Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y);
      if (moved > 4) pointer.current.moved = true;
    }

    if (sketchSession && activeSketch) {
      const point = manager.sketchPointAt(event.clientX, event.clientY, activeSketch.plane);
      setSketchCursor(point ? snapPoint(point, doc, activeSketch.id) : null);
    }

    if (pointer.current?.moved) return;
    const hit = manager.pick(event.clientX, event.clientY);
    setHover(hit?.bodyId ?? null, hit?.face ?? null);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointer.current;
    pointer.current = null;
    if (!start || start.button !== 0 || start.moved) return;
    const manager = managerRef.current;
    if (!manager) return;

    if (sketchSession && activeSketch) {
      const point = manager.sketchPointAt(event.clientX, event.clientY, activeSketch.plane);
      if (point) sketchClick(snapPoint(point, doc, activeSketch.id));
      return;
    }

    const hit = manager.pick(event.clientX, event.clientY);
    if (!hit) {
      select(null);
      setPickedFace(null);
      setHover(null, null);
      return;
    }
    select({ kind: 'body', id: hit.bodyId });
    setPickedFace(hit.face);
  };

  const handlePointerLeave = () => {
    pointer.current = null;
    setHover(null, null);
    setSketchCursor(null);
  };

  const hint = (() => {
    if (!sketchSession) return null;
    if (sketchSession.tool === 'rect') {
      return sketchSession.pending.length
        ? 'Rectangle · click the opposite corner'
        : 'Rectangle · click the first corner';
    }
    if (sketchSession.tool === 'circle') {
      return sketchSession.pending.length ? 'Circle · click to set the radius' : 'Circle · click the centre';
    }
    return sketchSession.pending.length
      ? 'Line · click the next point · Enter ends the chain'
      : 'Line · click the start point';
  })();

  const modeLabel =
    displayMode === 'shadedEdges' ? 'Shaded + edges' : displayMode === 'shaded' ? 'Shaded' : 'Wireframe';

  return (
    <div className="viewport">
      <div
        ref={hostRef}
        className={`viewport-canvas ${sketchSession ? 'is-sketching' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(event) => event.preventDefault()}
      />

      <div className="viewport-topleft">
        <div className="breadcrumb">
          {workspace === 'sketch' ? 'Sketch' : 'Design'} <span>/</span>{' '}
          {workspace === 'sketch' ? activeSketch?.name ?? 'no sketch' : doc.name}
        </div>
        {hint ? <div className="hint-chip">{hint}</div> : null}
        {sketchSession ? (
          <div className="hint-chip subtle">
            Grid snap {SNAP_STEP} mm · Esc clears · R-click drag pans
          </div>
        ) : null}
      </div>

      <div className="view-controls">
        <button className="icon-btn" title="Fit to view (F)" onClick={() => viewportBus.fit?.()}>
          <Icon.Fit />
        </button>
        <div className="view-divider" />
        <button className="icon-btn text" title="Isometric view (1)" onClick={() => viewportBus.view?.('iso')}>
          ISO
        </button>
        <button className="icon-btn text" title="Front view (2)" onClick={() => viewportBus.view?.('front')}>
          FR
        </button>
        <button className="icon-btn text" title="Top view (3)" onClick={() => viewportBus.view?.('top')}>
          TOP
        </button>
        <button className="icon-btn text" title="Right view (4)" onClick={() => viewportBus.view?.('right')}>
          RT
        </button>
        <div className="view-divider" />
        <button
          className="icon-btn text wide"
          title="Cycle display mode"
          onClick={() =>
            setDisplayMode(
              displayMode === 'shadedEdges' ? 'shaded' : displayMode === 'shaded' ? 'wireframe' : 'shadedEdges',
            )
          }
        >
          {modeLabel}
        </button>
        <button
          className={`icon-btn ${grid ? 'is-on' : ''}`}
          title={grid ? 'Hide grid' : 'Show grid'}
          onClick={toggleGrid}
        >
          <Icon.Grid />
        </button>
      </div>

      <div className="viewport-footer">
        <span>
          <b>LMB</b> orbit
        </span>
        <span>
          <b>RMB</b> pan
        </span>
        <span>
          <b>Wheel</b> zoom
        </span>
        <span className="viewport-mode">{sketchSession ? 'Orbit locked while sketching' : 'Perspective'}</span>
      </div>

      {workspace === 'sketch' && !sketchSession ? (
        <div className="viewport-empty">
          <div className="empty-card">
            <h3>No sketch is open</h3>
            <p>Create one from the Design workspace, or pick a plane in the Browser.</p>
          </div>
        </div>
      ) : null}

      {preview?.error && cmd ? (
        <div className="preview-error" role="status">
          <Icon.Warning size={12} /> {preview.error}
        </div>
      ) : null}
    </div>
  );
}
