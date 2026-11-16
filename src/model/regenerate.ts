import type { Doc, Feature, FeatureStatus } from '../types';
import { evaluate, parameterValues } from './expressions';
import { offsetPolygon, polygonArea, profileOf, roundPolygon, type SolidSpec } from '../geometry/solid';

export type BodySolid = {
  bodyId: string;
  featureId: string;
  componentId: string;
  spec: SolidSpec;
  rounded?: boolean;
};

export type Regenerated = {
  bodies: Record<string, BodySolid>;
  bodyOrder: string[];
  status: Record<string, FeatureStatus>;
  paramValues: Record<string, number>;
  paramErrors: Record<string, string>;
};

/**
 * Replay the active timeline, turning features into solids.
 * This is the frontend's stand-in for the CAD kernel's feature regeneration:
 * it resolves parameters, evaluates features in order and reports per-feature status.
 */
export function regenerate(doc: Doc): Regenerated {
  const { values, errors: paramErrors } = parameterValues(doc.parameters);
  const status: Record<string, FeatureStatus> = {};
  const bodies: Record<string, BodySolid> = {};
  const bodyOrder: string[] = [];

  const limit = Math.max(0, Math.min(doc.rollback, doc.timeline.length));
  const activeEntries = doc.timeline.slice(0, limit);

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
    const feature = doc.features.find((f) => f.id === entry.refId);
    if (!feature) continue;
    if (status[feature.id]?.status === 'error') continue;

    if (feature.kind === 'extrude') {
      const sketch = doc.sketches.find((s) => s.id === feature.sketchId);
      if (!sketch) {
        fail(feature, 'Profile sketch was deleted');
        continue;
      }
      const profile = profileOf(sketch);
      if ('error' in profile) {
        fail(feature, profile.error);
        continue;
      }
      const distance = evalExpr(feature.distance, feature.id);
      if (distance === null) continue;
      if (Math.abs(distance) < 0.01) {
        fail(feature, 'Distance must be greater than zero');
        continue;
      }
      if (!bodies[feature.bodyId]) bodyOrder.push(feature.bodyId);
      bodies[feature.bodyId] = {
        bodyId: feature.bodyId,
        featureId: feature.id,
        componentId: feature.componentId,
        spec: {
          plane: sketch.plane,
          polygon: profile.polygon,
          z0: 0,
          z1: distance,
          transform: { x: 0, y: 0, z: 0 },
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
      const rounded = roundPolygon(target.spec.polygon, radius);
      target.spec.polygon = rounded.poly;
      target.rounded = true;
      if (rounded.clamped) {
        status[feature.id] = {
          status: 'warning',
          message: 'Radius was clamped so it fits the profile edges',
        };
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
      const inner = offsetPolygon(target.spec.polygon, thickness);
      const outerArea = Math.abs(polygonArea(target.spec.polygon));
      const innerArea = Math.abs(polygonArea(inner));
      if (!(innerArea > outerArea * 0.02)) {
        fail(feature, 'Wall thickness is too large for this profile');
        continue;
      }
      target.spec.shell = thickness;
      continue;
    }

    if (feature.kind === 'move') {
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
  }

  for (const entry of activeEntries) {
    if (entry.type !== 'feature') continue;
    if (!status[entry.refId]) status[entry.refId] = { status: 'ok' };
  }

  return { bodies, bodyOrder, status, paramValues: values, paramErrors };
}

/** Status of the feature that produced a body. */
export function bodyStatus(regen: Regenerated, featureId: string): FeatureStatus {
  return regen.status[featureId] ?? { status: 'ok' };
}
