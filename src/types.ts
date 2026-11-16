/** Design document model. UI state lives in the stores, never here. */

export type PlaneId = 'XY' | 'XZ' | 'YZ';
export type Units = 'mm' | 'cm' | 'in';

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

/* ---------------- sketches ---------------- */

export type SketchEntity =
  | { id: string; kind: 'line'; a: Vec2; b: Vec2; construction?: boolean }
  | { id: string; kind: 'polyline'; points: Vec2[]; closed: boolean }
  | { id: string; kind: 'rect'; a: Vec2; b: Vec2 }
  | { id: string; kind: 'circle'; c: Vec2; r: number };

export type ConstraintType = 'horizontal' | 'vertical' | 'coincident' | 'parallel' | 'perpendicular';

export type Constraint = {
  id: string;
  type: ConstraintType;
  entityId: string;
  otherEntityId?: string;
  /** 0 = start, 1 = end (lines only, used by coincident). */
  pointIndex?: number;
  otherPointIndex?: number;
};

export type DimensionType = 'length' | 'radius' | 'distance' | 'width' | 'height';

export type Dimension = {
  id: string;
  type: DimensionType;
  entityId: string;
  otherEntityId?: string;
  /** Expression text; evaluated against design parameters. */
  expression: string;
};

export type Sketch = {
  id: string;
  name: string;
  componentId: string;
  plane: PlaneId;
  entities: SketchEntity[];
  constraints: Constraint[];
  dimensions: Dimension[];
};

/* ---------------- features ---------------- */

export type ExtrudeOperation = 'new' | 'cut';

type FeatureBase = {
  id: string;
  name: string;
  componentId: string;
  suppressed: boolean;
};

export type ExtrudeFeature = FeatureBase & {
  kind: 'extrude';
  sketchId: string;
  distance: string;
  operation: ExtrudeOperation;
  /** For 'new' this is the created body; for 'cut' this is the target body. */
  bodyId: string;
};

export type FilletFeature = FeatureBase & {
  kind: 'fillet';
  bodyId: string;
  radius: string;
};

export type ShellFeature = FeatureBase & {
  kind: 'shell';
  bodyId: string;
  thickness: string;
};

export type MoveFeature = FeatureBase & {
  kind: 'move';
  bodyId: string;
  offset: { x: string; y: string; z: string };
};

export type Feature = ExtrudeFeature | FilletFeature | ShellFeature | MoveFeature;
export type FeatureKind = Feature['kind'];

/* ---------------- document ---------------- */

export type Component = {
  id: string;
  name: string;
  parentId: string | null;
  visible: boolean;
  transform: Vec3;
  material: string;
};

export type Body = {
  id: string;
  name: string;
  componentId: string;
  featureId: string;
  visible: boolean;
  material: string;
};

export type Parameter = {
  id: string;
  name: string;
  expression: string;
  unit: 'mm' | '';
};

export type JointType = 'rigid' | 'revolute' | 'slider' | 'cylindrical' | 'planar' | 'ball';

export type Joint = {
  id: string;
  name: string;
  type: JointType;
  a: string;
  b: string;
  limits: { min: number; max: number } | null;
};

export type TimelineEntry = {
  id: string;
  type: 'sketch' | 'feature';
  refId: string;
};

export type Design = {
  id: string;
  name: string;
  units: Units;
  components: Component[];
  bodies: Body[];
  sketches: Sketch[];
  features: Feature[];
  parameters: Parameter[];
  joints: Joint[];
  timeline: TimelineEntry[];
  /** Number of timeline entries currently active (rollback marker position). */
  rollback: number;
  updatedAt: number;
};

/* ---------------- selection / command ---------------- */

export type SelectionKind =
  | 'body'
  | 'face'
  | 'edge'
  | 'sketch'
  | 'sketchEntity'
  | 'feature'
  | 'component'
  | 'parameter'
  | 'joint'
  | 'plane';

export type FaceInfo = {
  area: number;
  normal: Vec3;
  point: Vec3;
};

export type EdgeInfo = {
  length: number;
  start: Vec3;
  end: Vec3;
};

export type Selection = {
  kind: SelectionKind;
  /** Design object id, plane id, or body id for face/edge picks. */
  id: string;
  /** Body id when a face or edge is picked. */
  bodyId?: string;
  /** Parent object id for sub-selections (sketch entities). */
  subId?: string;
  label?: string;
  face?: FaceInfo;
  edge?: EdgeInfo;
};

export type FeatureStatusKind = 'ok' | 'warning' | 'error' | 'suppressed';

export type FeatureStatus = {
  status: FeatureStatusKind;
  message?: string;
};
