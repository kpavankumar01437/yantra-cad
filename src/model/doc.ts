import type { Body, Component, Doc, Feature, Joint, Parameter, Sketch, TimelineEntry } from '../types';

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

export function newId(prefix: string): string {
  return uid(prefix);
}

export const PLANE_IDS: ('XY' | 'XZ' | 'YZ')[] = ['XY', 'XZ', 'YZ'];

export function createDefaultDoc(): Doc {
  const components: Component[] = [
    { id: 'c_root', name: 'Mounting Bracket', parentId: null, visible: true },
    { id: 'c_plate', name: 'Base Plate', parentId: 'c_root', visible: true },
    { id: 'c_boss', name: 'Boss', parentId: 'c_root', visible: true },
  ];

  const sketches: Sketch[] = [
    {
      id: 's_plate',
      name: 'Sketch1',
      componentId: 'c_plate',
      plane: 'XY',
      entities: [{ id: 'e_plate', kind: 'rect', a: { x: -40, y: -25 }, b: { x: 40, y: 25 } }],
    },
    {
      id: 's_boss',
      name: 'Sketch2',
      componentId: 'c_boss',
      plane: 'XY',
      entities: [{ id: 'e_boss', kind: 'circle', c: { x: 0, y: 0 }, r: 9 }],
    },
  ];

  const bodies: Body[] = [
    { id: 'b_plate', name: 'Body1', componentId: 'c_plate', featureId: 'f_extrude_plate', visible: true },
    { id: 'b_boss', name: 'Body1', componentId: 'c_boss', featureId: 'f_extrude_boss', visible: true },
  ];

  const features: Feature[] = [
    {
      id: 'f_extrude_plate',
      kind: 'extrude',
      name: 'Extrude1',
      componentId: 'c_plate',
      sketchId: 's_plate',
      distance: 'plate_thickness',
      bodyId: 'b_plate',
    },
    {
      id: 'f_fillet_plate',
      kind: 'fillet',
      name: 'Fillet1',
      componentId: 'c_plate',
      bodyId: 'b_plate',
      radius: 'fillet_radius',
    },
    {
      id: 'f_extrude_boss',
      kind: 'extrude',
      name: 'Extrude2',
      componentId: 'c_boss',
      sketchId: 's_boss',
      distance: 'boss_height',
      bodyId: 'b_boss',
    },
    {
      id: 'f_move_boss',
      kind: 'move',
      name: 'Move1',
      componentId: 'c_boss',
      bodyId: 'b_boss',
      offset: { x: '0', y: '0', z: 'plate_thickness' },
    },
  ];

  const parameters: Parameter[] = [
    { id: 'p_w', name: 'plate_width', expression: '80' },
    { id: 'p_d', name: 'plate_depth', expression: '50' },
    { id: 'p_t', name: 'plate_thickness', expression: '6' },
    { id: 'p_f', name: 'fillet_radius', expression: '5' },
    { id: 'p_bh', name: 'boss_height', expression: '18' },
  ];

  const joints: Joint[] = [
    { id: 'j_rigid', name: 'Rigid1', type: 'rigid', a: 'c_plate', b: 'c_boss' },
    { id: 'j_rev', name: 'Revolute1', type: 'revolute', a: 'c_boss', b: 'c_plate' },
  ];

  const timeline: TimelineEntry[] = [
    { id: 't1', type: 'sketch', refId: 's_plate' },
    { id: 't2', type: 'feature', refId: 'f_extrude_plate' },
    { id: 't3', type: 'feature', refId: 'f_fillet_plate' },
    { id: 't4', type: 'sketch', refId: 's_boss' },
    { id: 't5', type: 'feature', refId: 'f_extrude_boss' },
    { id: 't6', type: 'feature', refId: 'f_move_boss' },
  ];

  return {
    id: 'doc_bracket',
    name: 'Mounting Bracket',
    units: 'mm',
    components,
    sketches,
    features,
    bodies,
    parameters,
    joints,
    timeline,
    rollback: timeline.length,
  };
}

export function uniqueName(base: string, existing: { name: string }[]): string {
  const taken = new Set(existing.map((item) => item.name));
  let index = 1;
  while (taken.has(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}
