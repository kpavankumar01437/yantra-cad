import { evaluate, parameterValues } from '../model/expressions';
import { newId, uniqueName } from '../model/doc';
import { applyDimension, solveSketch } from '../model/sketch';
import { useDesignStore } from '../stores/designStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';
import type {
  ConstraintType,
  Design,
  Feature,
  Selection,
  Sketch,
  SketchEntity,
  Vec3,
} from '../types';
import { commit } from './document';

function removeBodies(draft: Design, bodyIds: string[]) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const feature of [...draft.features]) {
      const referencesBody = feature.kind !== 'extrude' ? bodyIds.includes(feature.bodyId) : feature.operation === 'cut' && bodyIds.includes(feature.bodyId);
      if (referencesBody) {
        draft.features = draft.features.filter((f) => f.id !== feature.id);
        draft.timeline = draft.timeline.filter((e) => e.refId !== feature.id);
        changed = true;
      }
    }
    for (const feature of [...draft.features]) {
      if (feature.kind === 'extrude' && feature.operation === 'new' && bodyIds.includes(feature.bodyId)) {
        draft.features = draft.features.filter((f) => f.id !== feature.id);
        draft.timeline = draft.timeline.filter((e) => e.refId !== feature.id);
        changed = true;
      }
    }
  }
  draft.bodies = draft.bodies.filter((b) => !bodyIds.includes(b.id));
}

export function deleteSelection(selection: Selection[]) {
  const target = selection[0];
  if (!target) return;

  commit((draft) => {
    if (target.kind === 'body' || target.kind === 'face' || target.kind === 'edge') {
      removeBodies(draft, [target.bodyId ?? target.id]);
    } else if (target.kind === 'feature') {
      const feature = draft.features.find((f) => f.id === target.id);
      if (!feature) return;
      if (feature.kind === 'extrude' && feature.operation === 'new') removeBodies(draft, [feature.bodyId]);
      draft.features = draft.features.filter((f) => f.id !== feature.id);
      draft.timeline = draft.timeline.filter((e) => e.refId !== feature.id);
    } else if (target.kind === 'sketch') {
      const extrudes = draft.features.filter((f) => f.kind === 'extrude' && f.operation === 'new' && f.sketchId === target.id);
      removeBodies(
        draft,
        extrudes.map((f) => (f.kind === 'extrude' ? f.bodyId : '')),
      );
      draft.features = draft.features.filter((f) => !(f.kind === 'extrude' && f.sketchId === target.id));
      draft.timeline = draft.timeline.filter((e) => !(e.type === 'sketch' && e.refId === target.id));
      draft.timeline = draft.timeline.filter((e) => draft.features.some((f) => f.id === e.refId) || e.type === 'sketch');
      draft.sketches = draft.sketches.filter((s) => s.id !== target.id);
    } else if (target.kind === 'component') {
      const component = draft.components.find((c) => c.id === target.id);
      if (!component || component.parentId === null) return;
      const bodyIds = draft.bodies.filter((b) => b.componentId === target.id).map((b) => b.id);
      removeBodies(draft, bodyIds);
      draft.sketches = draft.sketches.filter((s) => s.componentId !== target.id);
      draft.components = draft.components.filter((c) => c.id !== target.id && c.parentId !== target.id);
    } else if (target.kind === 'sketchEntity') {
      const sketch = draft.sketches.find((s) => s.id === target.subId);
      if (!sketch) return;
      sketch.entities = sketch.entities.filter((e) => e.id !== target.id);
      sketch.dimensions = sketch.dimensions.filter((d) => d.entityId !== target.id && d.otherEntityId !== target.id);
      sketch.constraints = sketch.constraints.filter((c) => c.entityId !== target.id && c.otherEntityId !== target.id);
    } else if (target.kind === 'parameter') {
      draft.parameters = draft.parameters.filter((p) => p.id !== target.id);
    } else if (target.kind === 'joint') {
      draft.joints = draft.joints.filter((j) => j.id !== target.id);
    }
  });

  useSelectionStore.getState().clear();
  useUiStore.getState().notify('Deleted', 'info');
}

export function renameSelection(target: Selection, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  commit((draft) => {
    if (target.kind === 'body') {
      const body = draft.bodies.find((b) => b.id === target.id);
      if (body) body.name = trimmed;
    } else if (target.kind === 'sketch') {
      const sketch = draft.sketches.find((s) => s.id === target.id);
      if (sketch) sketch.name = trimmed;
    } else if (target.kind === 'feature') {
      const feature = draft.features.find((f) => f.id === target.id);
      if (feature) feature.name = trimmed;
    } else if (target.kind === 'component') {
      const component = draft.components.find((c) => c.id === target.id);
      if (component) component.name = trimmed;
    } else if (target.kind === 'parameter') {
      const parameter = draft.parameters.find((p) => p.id === target.id);
      if (parameter) parameter.name = trimmed.replace(/\s+/g, '_');
    } else if (target.kind === 'joint') {
      const joint = draft.joints.find((j) => j.id === target.id);
      if (joint) joint.name = trimmed;
    }
  });
}

export function toggleBodyVisibility(bodyId: string) {
  commit((draft) => {
    const body = draft.bodies.find((b) => b.id === bodyId);
    if (body) body.visible = !body.visible;
  });
}

export function toggleComponentVisibility(componentId: string) {
  commit((draft) => {
    const component = draft.components.find((c) => c.id === componentId);
    if (component) component.visible = !component.visible;
  });
}

export function setComponentMaterial(componentId: string, material: string) {
  commit((draft) => {
    const component = draft.components.find((c) => c.id === componentId);
    if (component) component.material = material;
  });
}

export function setBodyMaterial(bodyId: string, material: string) {
  commit((draft) => {
    const body = draft.bodies.find((b) => b.id === bodyId);
    if (body) body.material = material;
  });
}

export function setComponentTransform(componentId: string, patch: Partial<Vec3>) {
  commit((draft) => {
    const component = draft.components.find((c) => c.id === componentId);
    if (component) component.transform = { ...component.transform, ...patch };
  });
}

export function setParameterExpression(parameterId: string, expression: string) {
  commit((draft) => {
    const parameter = draft.parameters.find((p) => p.id === parameterId);
    if (parameter) parameter.expression = expression;
  });
}

export function addParameter() {
  let created = '';
  commit((draft) => {
    const parameter = {
      id: newId('p'),
      name: uniqueName('param', draft.parameters),
      expression: '10',
      unit: 'mm' as const,
    };
    draft.parameters.push(parameter);
    created = parameter.id;
  });
  if (created) useSelectionStore.getState().select({ kind: 'parameter', id: created });
}

export function setFeatureExpression(featureId: string, key: string, value: string) {
  commit((draft) => {
    const feature = draft.features.find((f) => f.id === featureId);
    if (!feature) return;
    if (feature.kind === 'extrude' && key === 'distance') feature.distance = value;
    else if (feature.kind === 'fillet' && key === 'radius') feature.radius = value;
    else if (feature.kind === 'shell' && key === 'thickness') feature.thickness = value;
    else if (feature.kind === 'move' && (key === 'x' || key === 'y' || key === 'z')) {
      feature.offset = { ...feature.offset, [key]: value };
    }
  });
}

export function toggleFeatureSuppressed(featureId: string) {
  commit((draft) => {
    const feature = draft.features.find((f) => f.id === featureId);
    if (feature) feature.suppressed = !feature.suppressed;
  });
}

export function setRollback(index: number) {
  commit((draft) => {
    draft.rollback = Math.max(0, Math.min(index, draft.timeline.length));
  });
}

export function setDimensionExpression(sketchId: string, dimensionId: string, expression: string): string | null {
  const design = useDesignStore.getState().design;
  const sketch = design.sketches.find((s) => s.id === sketchId);
  const dimension = sketch?.dimensions.find((d) => d.id === dimensionId);
  if (!sketch || !dimension) return 'Dimension no longer exists';

  const { values } = parameterValues(design.parameters);
  let value: number;
  try {
    value = evaluate(expression, (name) => {
      if (!(name in values)) throw new Error(`Unknown parameter "${name}"`);
      return values[name];
    });
  } catch (err) {
    return (err as Error).message;
  }
  if (!Number.isFinite(value) || value <= 0.05) return 'Value must be greater than zero';

  const entities = applyDimension(sketch, dimension, value);
  commit((draft) => {
    const target = draft.sketches.find((s) => s.id === sketchId);
    if (!target) return;
    target.entities = entities;
    const dim = target.dimensions.find((d) => d.id === dimensionId);
    if (dim) dim.expression = expression;
  });
  return null;
}

export function addSketchEntity(sketchId: string, entity: SketchEntity) {
  commit((draft) => {
    const sketch = draft.sketches.find((s) => s.id === sketchId);
    if (!sketch) return;
    sketch.entities.push(entity);

    if (entity.kind === 'rect') {
      sketch.dimensions.push(
        {
          id: newId('d'),
          type: 'width',
          entityId: entity.id,
          expression: Math.abs(entity.b.x - entity.a.x).toFixed(1),
        },
        {
          id: newId('d'),
          type: 'height',
          entityId: entity.id,
          expression: Math.abs(entity.b.y - entity.a.y).toFixed(1),
        },
      );
    } else if (entity.kind === 'circle') {
      sketch.dimensions.push({ id: newId('d'), type: 'radius', entityId: entity.id, expression: entity.r.toFixed(1) });
    } else if (entity.kind === 'line') {
      sketch.dimensions.push({
        id: newId('d'),
        type: 'length',
        entityId: entity.id,
        expression: Math.hypot(entity.b.x - entity.a.x, entity.b.y - entity.a.y).toFixed(1),
      });
    }
  });
}

export function deleteSketchEntity(sketchId: string, entityId: string) {
  commit((draft) => {
    const sketch: Sketch | undefined = draft.sketches.find((s) => s.id === sketchId);
    if (!sketch) return;
    sketch.entities = sketch.entities.filter((e) => e.id !== entityId);
    sketch.dimensions = sketch.dimensions.filter((d) => d.entityId !== entityId && d.otherEntityId !== entityId);
    sketch.constraints = sketch.constraints.filter(
      (c) => c.entityId !== entityId && c.otherEntityId !== entityId,
    );
  });
}

export function addConstraint(
  sketchId: string,
  type: ConstraintType,
  entityId: string,
  otherEntityId?: string,
): string | null {
  const design = useDesignStore.getState().design;
  const sketch = design.sketches.find((s) => s.id === sketchId);
  if (!sketch) return 'Sketch no longer exists';
  const entity = sketch.entities.find((e) => e.id === entityId);
  if (!entity) return 'Select a sketch entity first';
  if (entity.kind !== 'line') return 'Constraints apply to lines in this MVP';
  if ((type === 'parallel' || type === 'perpendicular') && !otherEntityId) {
    return 'Select a second line for this constraint';
  }

  commit((draft) => {
    const target = draft.sketches.find((s) => s.id === sketchId);
    if (!target) return;
    target.constraints.push({ id: newId('c'), type, entityId, otherEntityId });
    target.entities = solveSketch(target).entities;
  });
  return null;
}

export function removeConstraint(sketchId: string, constraintId: string) {
  commit((draft) => {
    const sketch = draft.sketches.find((s) => s.id === sketchId);
    if (sketch) sketch.constraints = sketch.constraints.filter((c) => c.id !== constraintId);
  });
}

export function updateSketchEntityGeometry(sketchId: string, entities: SketchEntity[]) {
  commit((draft) => {
    const sketch = draft.sketches.find((s) => s.id === sketchId);
    if (sketch) sketch.entities = entities;
  });
}

export function featureById(features: Feature[], id: string) {
  return features.find((f) => f.id === id);
}
