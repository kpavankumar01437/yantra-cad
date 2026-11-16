import type { Constraint, Dimension, Sketch, SketchEntity, Vec2 } from '../types';

/**
 * Deliberately small sketch solver.
 * Constraints are satisfied by iterative projection (a few dozen passes), which is
 * enough for the MVP's line-based constraints. Rectangles and circles are stored
 * parametrically, so their dimensions are exact by construction.
 */

export type SolveResult = {
  entities: SketchEntity[];
  residual: number;
  iterations: number;
};

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function rotateAbout(point: Vec2, center: Vec2, angle: number): Vec2 {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

export function solveSketch(sketch: Sketch): SolveResult {
  const entities: SketchEntity[] = structuredClone(sketch.entities);
  const index = new Map(entities.map((entity, i) => [entity.id, i]));

  const lineAt = (id: string) => {
    const i = index.get(id);
    if (i === undefined) return null;
    const entity = entities[i];
    return entity.kind === 'line' ? entity : null;
  };

  const pointAt = (id: string, which: number): Vec2 | null => {
    const line = lineAt(id);
    if (!line) return null;
    return which === 0 ? line.a : line.b;
  };

  let residual = 0;
  let iterations = 0;

  for (let iter = 0; iter < 40; iter += 1) {
    iterations = iter + 1;
    let movement = 0;

    for (const constraint of sketch.constraints) {
      const line = lineAt(constraint.entityId);
      if (!line) continue;

      if (constraint.type === 'horizontal') {
        const mid = (line.a.y + line.b.y) / 2;
        movement += Math.abs(line.a.y - mid) + Math.abs(line.b.y - mid);
        line.a.y = mid;
        line.b.y = mid;
      } else if (constraint.type === 'vertical') {
        const mid = (line.a.x + line.b.x) / 2;
        movement += Math.abs(line.a.x - mid) + Math.abs(line.b.x - mid);
        line.a.x = mid;
        line.b.x = mid;
      } else if (constraint.type === 'coincident' && constraint.otherEntityId) {
        const p = pointAt(constraint.entityId, constraint.pointIndex ?? 0);
        const q = pointAt(constraint.otherEntityId, constraint.otherPointIndex ?? 0);
        if (!p || !q) continue;
        const mid = midpoint(p, q);
        movement += Math.abs(p.x - mid.x) + Math.abs(p.y - mid.y);
        p.x = mid.x;
        p.y = mid.y;
        q.x = mid.x;
        q.y = mid.y;
      } else if ((constraint.type === 'parallel' || constraint.type === 'perpendicular') && constraint.otherEntityId) {
        const other = lineAt(constraint.otherEntityId);
        if (!other) continue;
        const dirA = Math.atan2(line.b.y - line.a.y, line.b.x - line.a.x);
        const dirB = Math.atan2(other.b.y - other.a.y, other.b.x - other.a.x);
        const target = constraint.type === 'parallel' ? dirA : dirA + Math.PI / 2;
        let delta = target - dirB;
        while (delta > Math.PI / 2) delta -= Math.PI;
        while (delta < -Math.PI / 2) delta += Math.PI;
        if (Math.abs(delta) < 1e-4) continue;
        const center = midpoint(other.a, other.b);
        other.a = rotateAbout(other.a, center, delta);
        other.b = rotateAbout(other.b, center, delta);
        movement += Math.abs(delta);
      }
    }

    residual = movement;
    if (movement < 1e-6) break;
  }

  return { entities, residual, iterations };
}

/** True when a sketch's stored geometry violates its constraints. */
export function sketchConflict(sketch: Sketch): boolean {
  return solveSketch(sketch).residual > 0.05;
}

function variableCount(entity: SketchEntity): number {
  if (entity.kind === 'rect') return 4; // centre x/y, width, height
  if (entity.kind === 'circle') return 3; // centre x/y, radius
  if (entity.kind === 'line') return 4; // two endpoints
  return entity.points.length * 2;
}

function equationCount(constraints: Constraint[]): number {
  return constraints.reduce((total, constraint) => {
    if (constraint.type === 'coincident') return total + 2;
    return total + 1;
  }, 0);
}

export type DofSummary = {
  variables: number;
  equations: number;
  dof: number;
  overConstrained: boolean;
  fullyConstrained: boolean;
};

/**
 * Degrees-of-freedom estimate used for the "fully constrained" indicator.
 * The first entity is treated as anchored to the sketch origin (2 equations),
 * mirroring how Fusion-style sketches ground themselves on the origin point.
 */
export function sketchDof(sketch: Sketch): DofSummary {
  const entities = sketch.entities;
  const variables = entities.reduce((total, entity) => total + variableCount(entity), 0);
  const anchored = entities.length ? variables - 2 : 0;
  const equations = equationCount(sketch.constraints) + sketch.dimensions.length;
  const dof = Math.max(0, anchored - equations);
  return {
    variables: anchored,
    equations,
    dof,
    overConstrained: equations > anchored,
    fullyConstrained: anchored > 0 && dof === 0 && !sketchConflict(sketch),
  };
}

/** Measured value of a dimension, in millimetres. */
export function measureDimension(sketch: Sketch, dimension: Dimension): number {
  const entity = sketch.entities.find((e) => e.id === dimension.entityId);
  if (!entity) return 0;

  if (dimension.type === 'radius') {
    if (entity.kind === 'circle') return entity.r;
    if (entity.kind === 'rect') return Math.min(Math.abs(entity.b.x - entity.a.x), Math.abs(entity.b.y - entity.a.y)) / 2;
    return 0;
  }
  if (dimension.type === 'width' && entity.kind === 'rect') return Math.abs(entity.b.x - entity.a.x);
  if (dimension.type === 'height' && entity.kind === 'rect') return Math.abs(entity.b.y - entity.a.y);
  if (entity.kind === 'line') return Math.hypot(entity.b.x - entity.a.x, entity.b.y - entity.a.y);
  if (entity.kind === 'polyline') {
    let length = 0;
    for (let i = 1; i < entity.points.length; i += 1) {
      length += Math.hypot(entity.points[i].x - entity.points[i - 1].x, entity.points[i].y - entity.points[i - 1].y);
    }
    return length;
  }
  return 0;
}

/** Apply an edited dimension by moving the geometry (rect/circle) or scaling (line). */
export function applyDimension(sketch: Sketch, dimension: Dimension, value: number): SketchEntity[] {
  return sketch.entities.map((entity) => {
    if (entity.id !== dimension.entityId) return entity;
    const next = { ...entity };

    if (next.kind === 'rect' && dimension.type === 'width') {
      const cx = (next.a.x + next.b.x) / 2;
      const half = Math.max(value, 0.1) / 2;
      next.a = { x: cx - half, y: next.a.y };
      next.b = { x: cx + half, y: next.b.y };
      return next;
    }
    if (next.kind === 'rect' && dimension.type === 'height') {
      const cy = (next.a.y + next.b.y) / 2;
      const half = Math.max(value, 0.1) / 2;
      next.a = { x: next.a.x, y: cy - half };
      next.b = { x: next.b.x, y: cy + half };
      return next;
    }
    if (next.kind === 'rect' && dimension.type === 'radius') {
      const cx = (next.a.x + next.b.x) / 2;
      const cy = (next.a.y + next.b.y) / 2;
      const half = Math.max(value, 0.1) / 2;
      next.a = { x: cx - half, y: cy - half };
      next.b = { x: cx + half, y: cy + half };
      return next;
    }
    if (next.kind === 'circle' && dimension.type === 'radius') {
      next.r = Math.max(value, 0.1);
      return next;
    }
    if (next.kind === 'line' && dimension.type === 'length') {
      const mid = midpoint(next.a, next.b);
      const current = Math.hypot(next.b.x - next.a.x, next.b.y - next.a.y) || 1;
      const scale = Math.max(value, 0.1) / current;
      next.a = { x: mid.x + (next.a.x - mid.x) * scale, y: mid.y + (next.a.y - mid.y) * scale };
      next.b = { x: mid.x + (next.b.x - mid.x) * scale, y: mid.y + (next.b.y - mid.y) * scale };
      return next;
    }
    return next;
  });
}
