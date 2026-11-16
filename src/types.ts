/** Core document model for the CAD frontend.
 *  This is the UI-side representation of a design. Geometry is derived from it
 *  by the regeneration pipeline, never stored directly in the document.
 */

export type PlaneId = 'XY' | 'XZ' | 'YZ';
export type Units = 'mm' | 'cm' | 'in';

export type Vec2 = { x: number; y: number };

export type SketchEntity =
  | { id: string; kind: 'rect'; a: Vec2; b: Vec2 }
  | { id: string; kind: 'circle'; c: Vec2; r: number }
  | { id: string; kind: 'line'; a: Vec2; b: Vec2 };

export type Sketch = {
  id: string;
  name: string;
  componentId: string;
  plane: PlaneId;
  entities: SketchEntity[];
};

export type Feature =
  | {
      id: string;
      kind: 'extrude';
      name: string;
      componentId: string;
      sketchId: string;
      distance: string;
      bodyId: string;
    }
  | {
      id: string;
      kind: 'fillet';
      name: string;
      componentId: string;
      bodyId: string;
      radius: string;
    }
  | {
      id: string;
      kind: 'shell';
      name: string;
      componentId: string;
      bodyId: string;
      thickness: string;
    }
  | {
      id: string;
      kind: 'move';
      name: string;
      componentId: string;
      bodyId: string;
      offset: { x: string; y: string; z: string };
    };

export type FeatureKind = Feature['kind'];

export type Component = {
  id: string;
  name: string;
  parentId: string | null;
  visible: boolean;
};

export type Body = {
  id: string;
  name: string;
  componentId: string;
  featureId: string;
  visible: boolean;
};

export type Parameter = {
  id: string;
  name: string;
  expression: string;
};

export type Joint = {
  id: string;
  name: string;
  type: 'rigid' | 'revolute' | 'slider' | 'cylindrical' | 'planar' | 'ball';
  a: string;
  b: string;
};

export type TimelineEntry = {
  id: string;
  type: 'sketch' | 'feature';
  refId: string;
};

export type Doc = {
  id: string;
  name: string;
  units: Units;
  components: Component[];
  sketches: Sketch[];
  features: Feature[];
  bodies: Body[];
  parameters: Parameter[];
  joints: Joint[];
  timeline: TimelineEntry[];
  /** Number of timeline entries that are active. Entries after this are rolled back. */
  rollback: number;
};

export type SelectionKind =
  | 'body'
  | 'sketch'
  | 'feature'
  | 'component'
  | 'parameter'
  | 'joint'
  | 'plane';

export type Selection = { kind: SelectionKind; id: string };

export type FaceInfo = {
  area: number;
  normal: [number, number, number];
  point: [number, number, number];
};

export type FeatureStatus = { status: 'ok' | 'warning' | 'error'; message?: string };
