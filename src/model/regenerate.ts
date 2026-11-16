import { offsetPolygon, pointInPolygon, polygonArea, roundPolygon, type SolidSpec } from '../geometry/solid';
import type { Design, Feature, FeatureStatus, Vec2 } from '../types';
import { evaluate, parameterValues } from './expressions';
import { profileOf } from './profile';

export type BodySolid = {
  bodyId: string;
  featureId: string;
  componentId: string;
  spec: SolidSpec;
  rounded: boolean;
};

export type Regenerated = {
  bodies: Record<string, BodySolid>;
  bodyOrder: string[];
  status: Record<string, FeatureStatus>;
  paramValues: Record<string, number>;
  paramErrors: Record<string, string>;
};

/**
 * Replay the active timeline, resolving parameters and producing solids.
 * This is the stand-in for a CAD kernel's feature regeneration: the document holds
 * intent, this function derives geometry, and every failure is reported per feature.
 */
export function regenerate(design: Design): Regenerated {
  const { values, errors: paramErrors } = parameterValues(design.parameters);
  const status: Record<string, FeatureStatus> = {};
  const bodies: Record<string, BodySolid> = {};
  const bodyOrder: string[] = [];

  const limit = Math.max(0, Math.min(design.rollback, design.timeline.length));
  const activeEntries = design.timeline.slice(0, limit);

  const evalExpr = (expr: string, featureId: string): number | null => {
    try {
      const value = evaluate(expr, (name) => {
        if (!(name in values)) throw new Error(`Unknown parameter "${name}"`);
        return values[name];
      });
      if (!Number.isFinite(value)) throw new Error('Value is not a finite number');
      return value;
    } catch (err) {
      status[featureId] = { status: 'error', message: (err as Error).message };
      return null;
    }
  };

  const fail = (feature: Feature, message: string) => {
    status[feature.id] = { status: 'error', message };
  };

  for (const entry of activeEntries) {
    if (entry.type !== 'feature') continue;
    const feature = design.features.find((f) => f.id === entry.refId);
    if (!feature) continue;
    if (feature.suppressed) {
      status[feature.id] = { status: 'suppressed', message: 'Feature is suppressed' };
      continue;
    }
    if (status[feature.id]?.status === 'error') continue;

    if (feature.kind === 'extrude') {
      const sketch = design.sketches.find((s) => s.id === feature.sketchId);
      if (!sketch) {
        fail(feature, 'Profile sketch was deleted');
        continue;
      }
      const resolved = profileOf(sketch);
      if ('error' in resolved) {
        fail(feature, resolved.error);
        continue;
      }
      const { profile } = resolved;
      const distance = evalExpr(feature.distance, feature.id);
      if (distance === null) continue;
      if (Math.abs(distance) < 0.01) {
        fail(feature, 'Distance must be greater than zero');
        continue;
      }

      if (feature.operation === 'cut') {
        const target = bodies[feature.bodyId];
        if (!target) {
          fail(feature, 'Cut target body is unavailable');
          continue;
        }
        if (target.spec.plane !== sketch.plane) {
          fail(feature, `Cut sketch must lie on the ${target.spec.plane} plane`);
          continue;
        }
        const outside = profile.polygon.some((point) => !pointInPolygon(point, target.spec.polygon));
        if (outside) {
          fail(feature, 'Cut profile must lie fully inside the target face');
          continue;
        }
        const holes = target.spec.holes ?? [];
        target.spec.holes = [...holes, profile.polygon, ...profile.holes];
        continue;
      }

      if (!bodies[feature.bodyId]) bodyOrder.push(feature.bodyId);
      const component = design.components.find((c) => c.id === feature.componentId);
      bodies[feature.bodyId] = {
        bodyId: feature.bodyId,
        featureId: feature.id,
        componentId: feature.componentId,
        rounded: false,
        spec: {
          plane: sketch.plane,
          polygon: profile.polygon,
          holes: profile.holes.length ? profile.holes : undefined,
          z0: 0,
          z1: distance,
          transform: component ? { ...component.transform } : { x: 0, y: 0, z: 0 },
        },
      };
      continue;
    }

    const target = bodies[feature.bodyId];
    if (!target) {
      fail(feature, 'Referenced body is unavailable');
      continue;
    }

    if (feature.kind === 'fillet') {
      const radius = evalExpr(feature.radius, feature.id);
      if (radius === null) continue;
      if (radius <= 0.01) {
        fail(feature, 'Fillet radius must be greater than zero');
        continue;
      }
      if (target.rounded) {
        status[feature.id] = { status: 'warning', message: 'Profile corners are already rounded' };
        continue;
      }
      if (target.spec.holes?.length) {
        status[feature.id] = { status: 'warning', message: 'Fillet is skipped for profiles with holes' };
        continue;
      }
      const rounded = roundPolygon(target.spec.polygon, radius);
      target.spec.polygon = rounded.poly;
      target.rounded = true;
      if (rounded.clamped) {
        status[feature.id] = { status: 'warning', message: 'Radius was clamped to fit the profile edges' };
      }
      continue;
    }

    if (feature.kind === 'shell') {
      const thickness = evalExpr(feature.thickness, feature.id);
      if (thickness === null) continue;
      if (thickness <= 0.01) {
        fail(feature, 'Wall thickness must be greater than zero');
        continue;
      }
      const height = Math.abs(target.spec.z1 - target.spec.z0);
      if (thickness * 2 >= height) {
        fail(feature, `Wall thickness must be under ${(height / 2).toFixed(2)} mm`);
        continue;
      }
      if (target.spec.holes?.length) {
        status[feature.id] = { status: 'warning', message: 'Shell is skipped for profiles with holes' };
        continue;
      }
      const inner = offsetPolygon(target.spec.polygon, thickness);
      const outerArea = Math.abs(polygonArea(target.spec.polygon));
      if (Math.abs(polygonArea(inner)) < outerArea * 0.02) {
        fail(feature, 'Wall thickness is too large for this profile');
        continue;
      }
      target.spec.shell = thickness;
      continue;
    }

    const x = evalExpr(feature.offset.x, feature.id);
    if (x === null) continue;
    const y = evalExpr(feature.offset.y, feature.id);
    if (y === null) continue;
    const z = evalExpr(feature.offset.z, feature.id);
    if (z === null) continue;
    target.spec.transform = {
      x: target.spec.transform.x + x,
      y: target.spec.transform.y + y,
      z: target.spec.transform.z + z,
    };
  }

  for (const entry of activeEntries) {
    if (entry.type !== 'feature') continue;
    if (!status[entry.refId]) status[entry.refId] = { status: 'ok' };
  }

  return { bodies, bodyOrder, status, paramValues: values, paramErrors };
}

/** Bounding helper used by the properties panel before geometry is built. */
export function profileExtent(polygon: Vec2[]): { width: number; height: number } {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
