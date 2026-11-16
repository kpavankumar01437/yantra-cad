import type { SolidSpec } from '../geometry/solid';
import { newId, uniqueName } from '../model/doc';
import { profileOf } from '../model/profile';
import { regenerate } from '../model/regenerate';
import { useCommandStore, type ActiveCommand, type CommandId } from '../stores/commandStore';
import { useDesignStore } from '../stores/designStore';
import { useHistoryStore } from '../stores/historyStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';
import type { Design, ExtrudeFeature, Feature, PlaneId, Selection, Sketch } from '../types';
import { commitDesign } from './document';
import { validateStructure, validateValues } from './validation';

export const COMMAND_LABELS: Record<CommandId, string> = {
  newSketch: 'New Sketch',
  extrude: 'Extrude',
  fillet: 'Fillet',
  shell: 'Shell',
  move: 'Move / Copy',
};

export type FieldDef =
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; hint?: string }
  | { key: string; label: string; type: 'text'; unit?: string; hint?: string }
  | { key: string; label: string; type: 'note'; text: string };

export function commandFields(design: Design, active: ActiveCommand): FieldDef[] {
  const componentName = (id: string) => design.components.find((c) => c.id === id)?.name ?? '—';
  const bodyOptions = design.bodies.map((body) => ({
    value: body.id,
    label: `${componentName(body.componentId)} / ${body.name}`,
  }));

  if (active.id === 'newSketch') {
    return [
      {
        key: 'plane',
        label: 'Sketch plane',
        type: 'select',
        options: [
          { value: 'XY', label: 'XY plane (top)' },
          { value: 'XZ', label: 'XZ plane (front)' },
          { value: 'YZ', label: 'YZ plane (right)' },
        ],
        hint: 'A planar body face or an origin plane.',
      },
      { key: '_n', label: '', type: 'note', text: 'The sketch opens in the Sketch workspace when you confirm.' },
    ];
  }

  if (active.id === 'extrude') {
    const cut = active.inputs.operation === 'cut';
    return [
      {
        key: 'sketchId',
        label: 'Profile',
        type: 'select',
        options: design.sketches.map((sketch) => ({
          value: sketch.id,
          label: `${sketch.name} · ${sketch.plane} · ${componentName(sketch.componentId)}`,
        })),
        hint: 'Closed loops only. Nested loops become holes.',
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'new', label: 'New body' },
          { value: 'cut', label: 'Cut (through hole)' },
        ],
      },
      ...(cut
        ? ([
            {
              key: 'bodyId',
              label: 'Target body',
              type: 'select',
              options: bodyOptions,
              hint: 'The cut profile must lie inside this body’s face.',
            },
          ] as FieldDef[])
        : []),
      {
        key: 'distance',
        label: 'Distance',
        type: 'text',
        unit: 'mm',
        hint: 'Accepts parameters: plate_thickness * 2',
      },
      { key: '_n', label: '', type: 'note', text: 'Live preview uses the mock kernel; Join is not supported yet.' },
    ];
  }

  if (active.id === 'fillet') {
    return [
      { key: 'bodyId', label: 'Body', type: 'select', options: bodyOptions, hint: 'Or click a body in the canvas.' },
      { key: 'radius', label: 'Radius', type: 'text', unit: 'mm' },
      { key: '_n', label: '', type: 'note', text: 'Rounds the profile corners of a prismatic body.' },
    ];
  }

  if (active.id === 'shell') {
    return [
      { key: 'bodyId', label: 'Body', type: 'select', options: bodyOptions },
      { key: 'thickness', label: 'Inside thickness', type: 'text', unit: 'mm' },
      { key: '_n', label: '', type: 'note', text: 'Removes material from the top face, keeping a floor and walls.' },
    ];
  }

  return [
    { key: 'bodyId', label: 'Body', type: 'select', options: bodyOptions },
    { key: 'x', label: 'X offset', type: 'text', unit: 'mm' },
    { key: 'y', label: 'Y offset', type: 'text', unit: 'mm' },
    { key: 'z', label: 'Z offset', type: 'text', unit: 'mm' },
    { key: '_n', label: '', type: 'note', text: 'Recorded on the timeline so it stays editable and undoable.' },
  ];
}

export function commandDefaults(design: Design, selection: Selection[], id: CommandId): Record<string, string> {
  const selectedBody = selection.find((s) => s.kind === 'body' || s.kind === 'face' || s.kind === 'edge');
  const bodyId = selectedBody ? design.bodies.find((b) => b.id === (selectedBody.bodyId ?? selectedBody.id))?.id ?? '' : '';
  const selectedSketch = selection.find((s) => s.kind === 'sketch')?.id ?? '';
  const selectedPlane = selection.find((s) => s.kind === 'plane')?.id ?? 'XY';

  if (id === 'newSketch') return { plane: selectedPlane };
  if (id === 'extrude') {
    return {
      sketchId: selectedSketch || design.sketches[design.sketches.length - 1]?.id || '',
      operation: 'new',
      bodyId: bodyId || design.bodies[0]?.id || '',
      distance: '10',
    };
  }
  if (id === 'fillet') return { bodyId, radius: '3' };
  if (id === 'shell') return { bodyId, thickness: '2' };
  return { bodyId, x: '0', y: '0', z: '10' };
}

export function featureInputs(feature: Feature): Record<string, string> {
  if (feature.kind === 'extrude') {
    return {
      sketchId: feature.sketchId,
      distance: feature.distance,
      operation: feature.operation,
      bodyId: feature.bodyId,
    };
  }
  if (feature.kind === 'fillet') return { bodyId: feature.bodyId, radius: feature.radius };
  if (feature.kind === 'shell') return { bodyId: feature.bodyId, thickness: feature.thickness };
  return {
    bodyId: feature.bodyId,
    x: feature.offset.x,
    y: feature.offset.y,
    z: feature.offset.z,
  };
}

export type BuildOutcome = {
  design?: Design;
  error?: string;
  fieldErrors?: Record<string, string>;
  bodyId?: string;
  featureId?: string;
  sketchId?: string;
};

function finalize(design: Design, featureId: string, bodyId?: string, sketchId?: string): BuildOutcome {
  const regen = regenerate(design);
  const status = regen.status[featureId];
  if (status?.status === 'error') {
    return { error: status.message ?? 'The feature could not be built', featureId, bodyId };
  }
  return { design, featureId, bodyId, sketchId };
}

export function buildCommand(design: Design, active: ActiveCommand, selection: Selection[]): BuildOutcome {
  const fieldErrors = {
    ...validateStructure(active.id, active.inputs),
    ...validateValues(active.id, active.inputs, design),
  };
  if (Object.keys(fieldErrors).length) {
    return { error: 'Fix the highlighted inputs', fieldErrors };
  }

  const next = structuredClone(design);
  const inputs = active.inputs;

  if (active.id === 'newSketch') {
    const plane = (inputs.plane as PlaneId) ?? 'XY';
    const selectedBody = selection.find((s) => s.kind === 'body' || s.kind === 'face');
    const selectedComponent = selectedBody
      ? design.bodies.find((b) => b.id === (selectedBody.bodyId ?? selectedBody.id))?.componentId
      : undefined;
    const componentId =
      selectedComponent ?? design.components.find((c) => c.parentId !== null)?.id ?? design.components[0].id;

    const sketch: Sketch = {
      id: newId('s'),
      name: uniqueName('Sketch', next.sketches),
      componentId,
      plane,
      entities: [],
      constraints: [],
      dimensions: [],
    };
    next.sketches.push(sketch);
    next.timeline.push({ id: newId('t'), type: 'sketch', refId: sketch.id });
    return { design: next, sketchId: sketch.id, featureId: sketch.id };
  }

  if (active.id === 'extrude') {
    const sketch = next.sketches.find((s) => s.id === inputs.sketchId);
    if (!sketch) return { error: 'That sketch no longer exists' };
    const resolvedProfile = profileOf(sketch);
    if ('error' in resolvedProfile) return { error: resolvedProfile.error };

    if (active.editingFeatureId) {
      const feature = next.features.find((f) => f.id === active.editingFeatureId);
      if (!feature || feature.kind !== 'extrude') return { error: 'Feature no longer exists' };
      feature.distance = inputs.distance;
      return finalize(next, feature.id, feature.bodyId);
    }

    const operation = inputs.operation === 'cut' ? 'cut' : 'new';
    const bodyId = operation === 'new' ? newId('b') : inputs.bodyId;
    const feature: ExtrudeFeature = {
      id: newId('f'),
      kind: 'extrude',
      name: uniqueName('Extrude', next.features),
      componentId: sketch.componentId,
      suppressed: false,
      sketchId: sketch.id,
      distance: inputs.distance,
      operation,
      bodyId,
    };
    next.features.push(feature);

    if (operation === 'new') {
      next.bodies.push({
        id: bodyId,
        name: uniqueName(
          'Body',
          next.bodies.filter((b) => b.componentId === sketch.componentId),
        ),
        componentId: sketch.componentId,
        featureId: feature.id,
        visible: true,
        material: 'Steel satin',
      });
    }
    next.timeline.push({ id: newId('t'), type: 'feature', refId: feature.id });
    return finalize(next, feature.id, bodyId);
  }

  const body = next.bodies.find((b) => b.id === inputs.bodyId);
  if (!body) return { error: 'Select a body first' };

  if (active.editingFeatureId) {
    const feature = next.features.find((f) => f.id === active.editingFeatureId);
    if (!feature || feature.kind === 'extrude') return { error: 'Feature no longer exists' };
    if (feature.kind === 'fillet' && active.id === 'fillet') feature.radius = inputs.radius;
    if (feature.kind === 'shell' && active.id === 'shell') feature.thickness = inputs.thickness;
    if (feature.kind === 'move' && active.id === 'move') {
      feature.offset = { x: inputs.x, y: inputs.y, z: inputs.z };
    }
    return finalize(next, feature.id, body.id);
  }

  let feature: Feature;
  if (active.id === 'fillet') {
    feature = {
      id: newId('f'),
      kind: 'fillet',
      name: uniqueName('Fillet', next.features),
      componentId: body.componentId,
      suppressed: false,
      bodyId: body.id,
      radius: inputs.radius,
    };
  } else if (active.id === 'shell') {
    feature = {
      id: newId('f'),
      kind: 'shell',
      name: uniqueName('Shell', next.features),
      componentId: body.componentId,
      suppressed: false,
      bodyId: body.id,
      thickness: inputs.thickness,
    };
  } else {
    feature = {
      id: newId('f'),
      kind: 'move',
      name: uniqueName('Move', next.features),
      componentId: body.componentId,
      suppressed: false,
      bodyId: body.id,
      offset: { x: inputs.x, y: inputs.y, z: inputs.z },
    };
  }

  next.features.push(feature);
  next.timeline.push({ id: newId('t'), type: 'feature', refId: feature.id });
  return finalize(next, feature.id, body.id);
}

export function previewCommand(
  design: Design,
  active: ActiveCommand,
  selection: Selection[],
): { spec: SolidSpec | null; bodyId?: string; error?: string; warning?: string } {
  const outcome = buildCommand(design, active, selection);
  if (outcome.error) return { spec: null, error: outcome.error };
  if (!outcome.design || !outcome.bodyId) return { spec: null };
  const regen = regenerate(outcome.design);
  const body = regen.bodies[outcome.bodyId];
  if (!body) return { spec: null };
  const status = outcome.featureId ? regen.status[outcome.featureId] : undefined;
  return {
    spec: body.spec,
    bodyId: outcome.bodyId,
    warning: status?.status === 'warning' ? status.message : undefined,
  };
}

export function startCommand(id: CommandId, editingFeatureId?: string) {
  const design = useDesignStore.getState().design;
  const selection = useSelectionStore.getState().selection;

  if (editingFeatureId) {
    const feature = design.features.find((f) => f.id === editingFeatureId);
    if (!feature) return;
    useCommandStore.getState().start({
      id: feature.kind,
      inputs: featureInputs(feature),
      editingFeatureId: feature.id,
      startedAt: Date.now(),
    });
    return;
  }

  useCommandStore.getState().start({
    id,
    inputs: commandDefaults(design, selection, id),
    startedAt: Date.now(),
  });
}

export function commitActiveCommand() {
  const active = useCommandStore.getState().active;
  if (!active) return;

  const design = useDesignStore.getState().design;
  const selection = useSelectionStore.getState().selection;
  const outcome = buildCommand(design, active, selection);

  if (!outcome.design) {
    useCommandStore.getState().setErrors({
      ...(outcome.fieldErrors ?? {}),
      _form: outcome.error ?? 'The command could not be built',
    });
    return;
  }

  const next = outcome.design;
  next.rollback = next.timeline.length;
  commitDesign(next);
  useCommandStore.getState().cancel();

  if (outcome.sketchId) {
    useSelectionStore.getState().setSelection([{ kind: 'sketch', id: outcome.sketchId }]);
    useUiStore.getState().startSketchSession(outcome.sketchId);
    return;
  }
  if (outcome.bodyId) {
    useSelectionStore.getState().setSelection([{ kind: 'body', id: outcome.bodyId }]);
    useUiStore.getState().notify(`${COMMAND_LABELS[active.id]} committed`, 'ok');
    return;
  }
  if (outcome.featureId) {
    useSelectionStore.getState().setSelection([{ kind: 'feature', id: outcome.featureId }]);
    useUiStore.getState().notify(`${COMMAND_LABELS[active.id]} committed`, 'ok');
  }
}

/** Drops selection entries whose objects no longer exist after a history swap. */
function pruneSelection() {
  const design = useDesignStore.getState().design;
  const selection = useSelectionStore.getState().selection;
  const exists = (item: Selection): boolean => {
    switch (item.kind) {
      case 'body':
      case 'face':
      case 'edge':
        return design.bodies.some((body) => body.id === (item.bodyId ?? item.id));
      case 'feature':
        return design.features.some((feature) => feature.id === item.id);
      case 'sketch':
        return design.sketches.some((sketch) => sketch.id === item.id);
      case 'component':
        return design.components.some((component) => component.id === item.id);
      case 'parameter':
        return design.parameters.some((parameter) => parameter.id === item.id);
      case 'joint':
        return design.joints.some((joint) => joint.id === item.id);
      case 'sketchEntity':
        return design.sketches.some(
          (sketch) => sketch.id === item.subId && sketch.entities.some((entity) => entity.id === item.id),
        );
      default:
        return true;
    }
  };
  const next = selection.filter(exists);
  if (next.length !== selection.length) useSelectionStore.getState().setSelection(next);
}

export function undo() {
  const history = useHistoryStore.getState();
  const previous = history.takeUndo();
  if (!previous) return;
  useHistoryStore.setState((state) => ({
    future: [useDesignStore.getState().design, ...state.future].slice(0, 80),
  }));
  useDesignStore.getState().replaceDesign(previous);
  pruneSelection();
  useUiStore.getState().notify('Undo', 'info');
}

export function redo() {
  const history = useHistoryStore.getState();
  const next = history.takeRedo();
  if (!next) return;
  useHistoryStore.setState((state) => ({
    past: [...state.past, useDesignStore.getState().design].slice(-80),
  }));
  useDesignStore.getState().replaceDesign(next);
  pruneSelection();
  useUiStore.getState().notify('Redo', 'info');
}
