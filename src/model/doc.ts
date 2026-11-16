import type { Body, Component, Design, Feature, Joint, Parameter, Sketch, TimelineEntry } from '../types';

let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function uniqueName(base: string, existing: { name: string }[]): string {
  const taken = new Set(existing.map((item) => item.name));
  let index = 1;
  while (taken.has(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}

export function createSampleDesign(): Design {
  const components: Component[] = [
    { id: 'c_root', name: 'Bracket Assembly', parentId: null, visible: true, transform: { x: 0, y: 0, z: 0 }, material: 'Default' },
    { id: 'c_plate', name: 'Base Plate', parentId: 'c_root', visible: true, transform: { x: 0, y: 0, z: 0 }, material: 'Steel satin' },
    { id: 'c_boss', name: 'Boss', parentId: 'c_root', visible: true, transform: { x: 0, y: 0, z: 0 }, material: 'Aluminium' },
    { id: 'c_wall', name: 'Side Wall', parentId: 'c_root', visible: true, transform: { x: 0, y: 0, z: 0 }, material: 'Steel satin' },
  ];

  const sketches: Sketch[] = [
    {
      id: 's_plate',
      name: 'Sketch1',
      componentId: 'c_plate',
      plane: 'XY',
      entities: [{ id: 'e_plate', kind: 'rect', a: { x: -40, y: -25 }, b: { x: 40, y: 25 } }],
      constraints: [],
      dimensions: [
        { id: 'd_plate_w', type: 'width', entityId: 'e_plate', expression: 'plate_width' },
        { id: 'd_plate_h', type: 'height', entityId: 'e_plate', expression: 'plate_depth' },
      ],
    },
    {
      id: 's_boss',
      name: 'Sketch2',
      componentId: 'c_boss',
      plane: 'XY',
      entities: [{ id: 'e_boss', kind: 'circle', c: { x: 0, y: 0 }, r: 9 }],
      constraints: [],
      dimensions: [{ id: 'd_boss_r', type: 'radius', entityId: 'e_boss', expression: 'boss_diameter / 2' }],
    },
    {
      id: 's_wall',
      name: 'Sketch3',
      componentId: 'c_wall',
      plane: 'XY',
      entities: [{ id: 'e_wall', kind: 'rect', a: { x: -40, y: -3 }, b: { x: 40, y: 3 } }],
      constraints: [],
      dimensions: [
        { id: 'd_wall_w', type: 'width', entityId: 'e_wall', expression: 'plate_width' },
        { id: 'd_wall_h', type: 'height', entityId: 'e_wall', expression: 'wall_thickness' },
      ],
    },
  ];

  const bodies: Body[] = [
    { id: 'b_plate', name: 'Body1', componentId: 'c_plate', featureId: 'f_ext_plate', visible: true, material: 'Steel satin' },
    { id: 'b_boss', name: 'Body1', componentId: 'c_boss', featureId: 'f_ext_boss', visible: true, material: 'Aluminium' },
    { id: 'b_wall', name: 'Body1', componentId: 'c_wall', featureId: 'f_ext_wall', visible: true, material: 'Steel satin' },
  ];

  const features: Feature[] = [
    {
      id: 'f_ext_plate',
      kind: 'extrude',
      name: 'Extrude1',
      componentId: 'c_plate',
      suppressed: false,
      sketchId: 's_plate',
      distance: 'plate_thickness',
      operation: 'new',
      bodyId: 'b_plate',
    },
    {
      id: 'f_fillet_plate',
      kind: 'fillet',
      name: 'Fillet1',
      componentId: 'c_plate',
      suppressed: false,
      bodyId: 'b_plate',
      radius: 'fillet_radius',
    },
    {
      id: 'f_ext_boss',
      kind: 'extrude',
      name: 'Extrude2',
      componentId: 'c_boss',
      suppressed: false,
      sketchId: 's_boss',
      distance: 'boss_height',
      operation: 'new',
      bodyId: 'b_boss',
    },
    {
      id: 'f_move_boss',
      kind: 'move',
      name: 'Move1',
      componentId: 'c_boss',
      suppressed: false,
      bodyId: 'b_boss',
      offset: { x: '0', y: '0', z: 'plate_thickness' },
    },
    {
      id: 'f_ext_wall',
      kind: 'extrude',
      name: 'Extrude3',
      componentId: 'c_wall',
      suppressed: false,
      sketchId: 's_wall',
      distance: 'wall_height',
      operation: 'new',
      bodyId: 'b_wall',
    },
    {
      id: 'f_move_wall',
      kind: 'move',
      name: 'Move2',
      componentId: 'c_wall',
      suppressed: false,
      bodyId: 'b_wall',
      offset: { x: '0', y: '22', z: 'plate_thickness' },
    },
  ];

  const parameters: Parameter[] = [
    { id: 'p_width', name: 'plate_width', expression: '80', unit: 'mm' },
    { id: 'p_depth', name: 'plate_depth', expression: '50', unit: 'mm' },
    { id: 'p_thickness', name: 'plate_thickness', expression: '6', unit: 'mm' },
    { id: 'p_fillet', name: 'fillet_radius', expression: '5', unit: 'mm' },
    { id: 'p_boss_d', name: 'boss_diameter', expression: '18', unit: 'mm' },
    { id: 'p_boss_h', name: 'boss_height', expression: '18', unit: 'mm' },
    { id: 'p_wall_h', name: 'wall_height', expression: '26', unit: 'mm' },
    { id: 'p_wall_t', name: 'wall_thickness', expression: '6', unit: 'mm' },
  ];

  const joints: Joint[] = [
    { id: 'j_rigid', name: 'Rigid1', type: 'rigid', a: 'c_plate', b: 'c_boss', limits: null },
    { id: 'j_rev', name: 'Revolute1', type: 'revolute', a: 'c_wall', b: 'c_plate', limits: { min: 0, max: 90 } },
  ];

  const timeline: TimelineEntry[] = [
    { id: 't1', type: 'sketch', refId: 's_plate' },
    { id: 't2', type: 'feature', refId: 'f_ext_plate' },
    { id: 't3', type: 'feature', refId: 'f_fillet_plate' },
    { id: 't4', type: 'sketch', refId: 's_boss' },
    { id: 't5', type: 'feature', refId: 'f_ext_boss' },
    { id: 't6', type: 'feature', refId: 'f_move_boss' },
    { id: 't7', type: 'sketch', refId: 's_wall' },
    { id: 't8', type: 'feature', refId: 'f_ext_wall' },
    { id: 't9', type: 'feature', refId: 'f_move_wall' },
  ];

  return {
    id: 'design_bracket',
    name: 'Mounting Bracket',
    units: 'mm',
    components,
    bodies,
    sketches,
    features,
    parameters,
    joints,
    timeline,
    rollback: timeline.length,
    updatedAt: Date.now(),
  };
}
