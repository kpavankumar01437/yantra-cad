import { circlePolygon, sketchPointToLocal } from '../../geometry/solid';
import type { Design, PlaneId, Sketch, SketchEntity, Vec2 } from '../../types';
import type { SketchSession } from '../../stores/uiStore';

export type SnapResult = { point: Vec2; snap: 'grid' | 'point' | 'axis' | null };

function entityPoints(entity: SketchEntity): Vec2[] {
  if (entity.kind === 'rect') {
    return [
      { x: entity.a.x, y: entity.a.y },
      { x: entity.b.x, y: entity.a.y },
      { x: entity.b.x, y: entity.b.y },
      { x: entity.a.x, y: entity.b.y },
    ];
  }
  if (entity.kind === 'circle') {
    return [
      entity.c,
      { x: entity.c.x + entity.r, y: entity.c.y },
      { x: entity.c.x - entity.r, y: entity.c.y },
      { x: entity.c.x, y: entity.c.y + entity.r },
      { x: entity.c.x, y: entity.c.y - entity.r },
    ];
  }
  if (entity.kind === 'line') return [entity.a, entity.b];
  return entity.points;
}

/** Snap to existing entity points, sketch axes, then the grid. */
export function snapPoint(
  design: Design,
  sketchId: string,
  raw: Vec2,
  snapToGrid: boolean,
  gridSize: number,
): SnapResult {
  const sketch = design.sketches.find((s) => s.id === sketchId);
  const tolerance = 3.5;

  for (const entity of sketch?.entities ?? []) {
    for (const point of entityPoints(entity)) {
      if (Math.hypot(point.x - raw.x, point.y - raw.y) < tolerance) return { point, snap: 'point' };
    }
  }

  if (Math.abs(raw.x) < tolerance * 0.6) return { point: { x: 0, y: round(raw.y, gridSize, snapToGrid) }, snap: 'axis' };
  if (Math.abs(raw.y) < tolerance * 0.6) return { point: { x: round(raw.x, gridSize, snapToGrid), y: 0 }, snap: 'axis' };

  if (snapToGrid && gridSize > 0) {
    return {
      point: { x: Math.round(raw.x / gridSize) * gridSize, y: Math.round(raw.y / gridSize) * gridSize },
      snap: 'grid',
    };
  }
  return { point: { x: raw.x, y: raw.y }, snap: null };
}

function round(value: number, gridSize: number, snapToGrid: boolean): number {
  return snapToGrid && gridSize > 0 ? Math.round(value / gridSize) * gridSize : value;
}

function pushSegment(out: number[], plane: PlaneId, a: Vec2, b: Vec2, offset = 0.06) {
  const p = sketchPointToLocal(plane, a.x, a.y, offset);
  const q = sketchPointToLocal(plane, b.x, b.y, offset);
  out.push(p.x, p.y, p.z, q.x, q.y, q.z);
}

/** Line positions for a sketch's entities (pairs of points). */
export function sketchSegments(sketch: Sketch): Float32Array {
  const out: number[] = [];
  for (const entity of sketch.entities) {
    if (entity.kind === 'line') {
      pushSegment(out, sketch.plane, entity.a, entity.b);
    } else if (entity.kind === 'rect') {
      const corners = entityPoints(entity);
      for (let i = 0; i < corners.length; i += 1) {
        pushSegment(out, sketch.plane, corners[i], corners[(i + 1) % corners.length]);
      }
    } else if (entity.kind === 'polyline') {
      for (let i = 1; i < entity.points.length; i += 1) {
        pushSegment(out, sketch.plane, entity.points[i - 1], entity.points[i]);
      }
      if (entity.closed && entity.points.length > 2) {
        pushSegment(out, sketch.plane, entity.points[entity.points.length - 1], entity.points[0]);
      }
    } else if (entity.kind === 'circle') {
      const points = circlePolygon(entity.c, entity.r, 72);
      for (let i = 0; i < points.length; i += 1) {
        pushSegment(out, sketch.plane, points[i], points[(i + 1) % points.length]);
      }
    }
  }
  return new Float32Array(out);
}

/** Preview geometry while a sketch tool has pending points. */
export function draftSegments(session: SketchSession, plane: PlaneId): Float32Array {
  const { pendingPoints, cursor, tool } = session;
  if (!cursor || !pendingPoints.length) return new Float32Array();
  const out: number[] = [];
  const anchor = pendingPoints[pendingPoints.length - 1];

  if (tool === 'rectangle') {
    const a: Vec2 = { x: anchor.x, y: cursor.y };
    const b: Vec2 = { x: cursor.x, y: anchor.y };
    pushSegment(out, plane, anchor, a, 0.12);
    pushSegment(out, plane, a, cursor, 0.12);
    pushSegment(out, plane, cursor, b, 0.12);
    pushSegment(out, plane, b, anchor, 0.12);
  } else if (tool === 'circle') {
    const radius = Math.hypot(cursor.x - anchor.x, cursor.y - anchor.y);
    pushSegment(out, plane, anchor, cursor, 0.12);
    const points = circlePolygon(anchor, radius, 72);
    for (let i = 0; i < points.length; i += 1) {
      pushSegment(out, plane, points[i], points[(i + 1) % points.length], 0.12);
    }
  } else {
    for (let i = 1; i < pendingPoints.length; i += 1) {
      pushSegment(out, plane, pendingPoints[i - 1], pendingPoints[i], 0.12);
    }
    pushSegment(out, plane, anchor, cursor, 0.12);
  }
  return new Float32Array(out);
}
