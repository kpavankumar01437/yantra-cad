import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  buildSolidGeometry,
  faceArea,
  localToSketch,
  planeNormalLocal,
  sketchPointToLocal,
} from '../geometry/solid';
import { previewCommand } from '../services/commands';
import { useRegenerated } from '../services/geometry';
import { useCommandStore } from '../stores/commandStore';
import { useDesignStore } from '../stores/designStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore, type DisplayMode } from '../stores/uiStore';
import type { FaceInfo, PlaneId, Selection, Sketch, Vec2 } from '../types';
import { draftSegments, sketchSegments, snapPoint } from './viewport/sketchMath';

export type ViewportApi = {
  fit: () => void;
  view: (name: 'iso' | 'front' | 'top' | 'right') => void;
};

type OrbitLike = {
  target: THREE.Vector3;
  update: () => void;
};

const MATERIALS: Record<string, { color: string; metalness: number; roughness: number }> = {
  'Steel satin': { color: '#9aa9ba', metalness: 0.35, roughness: 0.45 },
  Aluminium: { color: '#c3ccd6', metalness: 0.55, roughness: 0.35 },
  Default: { color: '#9aa9ba', metalness: 0.2, roughness: 0.6 },
};

function toModelPoint(world: THREE.Vector3): THREE.Vector3 {
  // The model group is rotated -90° about X: world (x, y, z) -> model (x, -z, y).
  return new THREE.Vector3(world.x, -world.z, world.y);
}

function faceInfoFor(
  geometry: THREE.BufferGeometry,
  faceIndex: number,
  worldPoint: THREE.Vector3,
): FaceInfo {
  const position = geometry.getAttribute('position');
  const i = faceIndex * 3;
  if (i + 2 >= position.count) {
    return { area: 0, normal: { x: 0, y: 0, z: 1 }, point: { x: 0, y: 0, z: 0 } };
  }
  const a = new THREE.Vector3().fromBufferAttribute(position, i);
  const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
  const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
  const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const point = toModelPoint(worldPoint);
  return {
    area: faceArea(geometry, faceIndex),
    normal: { x: normal.x, y: normal.y, z: normal.z },
    point: { x: point.x, y: point.y, z: point.z },
  };
}

type BodyMeshProps = {
  bodyId: string;
  spec: Parameters<typeof buildSolidGeometry>[0];
  material: string;
  visible: boolean;
  selected: boolean;
  hovered: boolean;
  displayMode: DisplayMode;
  pickingEnabled: boolean;
  onPick: (selection: Selection, event: ThreeEvent<MouseEvent>) => void;
  onHover: (selection: Selection | null) => void;
};

function BodyMesh({
  bodyId,
  spec,
  material,
  visible,
  selected,
  hovered,
  displayMode,
  pickingEnabled,
  onPick,
  onHover,
}: BodyMeshProps) {
  const geometry = useMemo(() => buildSolidGeometry(spec), [spec]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const appearance = MATERIALS[material] ?? MATERIALS.Default;
  const color = selected ? '#4fb2ff' : hovered ? '#b9cadb' : appearance.color;

  const edges = useMemo(
    () => (displayMode === 'shadedEdges' ? new THREE.EdgesGeometry(geometry, 22) : null),
    [geometry, displayMode],
  );
  useEffect(() => () => edges?.dispose(), [edges]);

  const makeSelection = (event: ThreeEvent<MouseEvent>): Selection => {
    if (!pickingEnabled) return { kind: 'body', id: bodyId };
    const faceIndex = event.faceIndex;
    const face = typeof faceIndex === 'number' ? faceInfoFor(geometry, faceIndex, event.point) : null;
    return face
      ? { kind: 'face', id: `${bodyId}:${event.faceIndex}`, bodyId, face, label: 'Face' }
      : { kind: 'body', id: bodyId };
  };

  return (
    <group visible={visible}>
      <mesh
        geometry={geometry}
        raycast={pickingEnabled ? undefined : () => null}
        onClick={(event) => {
          if (!pickingEnabled) return;
          event.stopPropagation();
          onPick(makeSelection(event), event);
        }}
        onPointerMove={(event) => {
          if (!pickingEnabled) return;
          event.stopPropagation();
          onHover(makeSelection(event));
        }}
        onPointerOut={() => onHover(null)}
      >
        <meshStandardMaterial
          color={color}
          emissive={selected ? '#123a5c' : '#000000'}
          metalness={appearance.metalness}
          roughness={appearance.roughness}
          flatShading
          wireframe={displayMode === 'wireframe'}
        />
      </mesh>

      {edges ? (
        <lineSegments
          geometry={edges}
          onClick={(event) => {
            if (!pickingEnabled) return;
            event.stopPropagation();
            const position = edges.getAttribute('position');
            const raw = (event.index ?? 0) as number;
            const start = raw - (raw % 2);
            if (start + 1 >= position.count) return;
            const a = new THREE.Vector3().fromBufferAttribute(position, start);
            const b = new THREE.Vector3().fromBufferAttribute(position, start + 1);
            const length = a.distanceTo(b);
            onPick(
              {
                kind: 'edge',
                id: `${bodyId}:edge:${start}`,
                bodyId,
                label: 'Edge',
                edge: {
                  length,
                  start: { x: a.x, y: a.y, z: a.z },
                  end: { x: b.x, y: b.y, z: b.z },
                },
              },
              event,
            );
          }}
        >
          <lineBasicMaterial color={selected ? '#a7d6ff' : '#26333f'} />
        </lineSegments>
      ) : null}
    </group>
  );
}

function PreviewSolid({ spec }: { spec: Parameters<typeof buildSolidGeometry>[0] }) {
  const geometry = useMemo(() => buildSolidGeometry(spec), [spec]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshStandardMaterial
        color="#38a8ff"
        transparent
        opacity={0.42}
        metalness={0.1}
        roughness={0.5}
        flatShading
        depthWrite={false}
      />
    </mesh>
  );
}

function SketchLinework({ sketch, active }: { sketch: Sketch; active: boolean }) {
  const geometry = useMemo(() => {
    const positions = sketchSegments(sketch);
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return next;
  }, [sketch]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} renderOrder={3}>
      <lineBasicMaterial color={active ? '#ffb648' : '#4a5a6b'} transparent opacity={active ? 1 : 0.9} />
    </lineSegments>
  );
}

function SketchPlane({
  plane,
  onPoint,
  onDraft,
}: {
  plane: PlaneId;
  onPoint: (point: Vec2) => void;
  onDraft: (point: Vec2 | null) => void;
}) {
  const rotation: [number, number, number] =
    plane === 'XZ' ? [-Math.PI / 2, 0, 0] : plane === 'YZ' ? [0, Math.PI / 2, 0] : [0, 0, 0];

  const toSketch = (event: ThreeEvent<PointerEvent | MouseEvent>): Vec2 => {
    const model = toModelPoint(event.point);
    return localToSketch(plane, model);
  };

  return (
    <mesh
      rotation={rotation}
      position={sketchPointToLocal(plane, 0, 0, 0)}
      onPointerMove={(event) => onDraft(toSketch(event))}
      onPointerOut={() => onDraft(null)}
      onClick={(event) => onPoint(toSketch(event))}
    >
      <planeGeometry args={[700, 700]} />
      <meshBasicMaterial color="#35a7ff" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function DraftLines({ session, plane }: { session: NonNullable<ReturnType<typeof useUiStore.getState>['sketchSession']>; plane: PlaneId }) {
  const geometry = useMemo(() => {
    const positions = draftSegments(session, plane);
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return next;
  }, [session, plane]);

  if (!session.cursor || !session.pendingPoints.length) return null;

  return (
    <lineSegments geometry={geometry} renderOrder={4}>
      <lineDashedMaterial color="#ffd08a" dashSize={2.5} gapSize={1.5} />
    </lineSegments>
  );
}

function CameraRig({
  apiRef,
  bounds,
}: {
  apiRef: React.MutableRefObject<ViewportApi | null>;
  bounds: THREE.Box3 | null;
}) {
  const controlsRef = useRef<OrbitLike | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    const boxFor = () => {
      if (bounds && !bounds.isEmpty()) return bounds.clone();
      return new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(120, 120, 120));
    };

    const distanceFor = (radius: number) =>
      (radius / Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360)) * 1.25;

    const apply = (position: THREE.Vector3, up: THREE.Vector3, target: THREE.Vector3) => {
      camera.up.copy(up);
      camera.position.copy(position);
      camera.lookAt(target);
      if (controlsRef.current) {
        controlsRef.current.target.copy(target);
        controlsRef.current.update();
      }
    };

    apiRef.current = {
      fit: () => {
        const box = boxFor();
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const distance = distanceFor(Math.max(size.length() / 2, 20));
        const direction = camera.position.clone().sub(box.getCenter(new THREE.Vector3()));
        if (direction.lengthSq() < 1e-4) direction.set(1, 0.8, 1);
        direction.normalize();
        apply(center.clone().addScaledVector(direction, distance), new THREE.Vector3(0, 1, 0), center);
      },
      view: (name) => {
        const box = boxFor();
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const d = distanceFor(Math.max(size.length() / 2, 20));
        if (name === 'front') apply(center.clone().add(new THREE.Vector3(0, 0, d)), new THREE.Vector3(0, 1, 0), center);
        else if (name === 'top') apply(center.clone().add(new THREE.Vector3(0, d, 0.01)), new THREE.Vector3(0, 0, -1), center);
        else if (name === 'right') apply(center.clone().add(new THREE.Vector3(d, 0, 0)), new THREE.Vector3(0, 1, 0), center);
        else
          apply(
            center.clone().add(new THREE.Vector3(d * 0.72, d * 0.62, d * 0.72)),
            new THREE.Vector3(0, 1, 0),
            center,
          );
      },
    };
  }, [apiRef, camera, bounds]);

  return (
    <OrbitControls
      ref={controlsRef as never}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.85}
      zoomSpeed={0.9}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}

export function Viewport3D() {
  const design = useDesignStore((state) => state.design);
  const displayMode = useUiStore((state) => state.displayMode);
  const showGrid = useUiStore((state) => state.showGrid);
  const session = useUiStore((state) => state.sketchSession);
  const snapToGrid = useUiStore((state) => state.snapToGrid);
  const gridSize = useUiStore((state) => state.gridSize);
  const patchSession = useUiStore((state) => state.patchSketchSession);
  const selection = useSelectionStore((state) => state.selection);
  const hovered = useSelectionStore((state) => state.hovered);
  const select = useSelectionStore((state) => state.select);
  const hover = useSelectionStore((state) => state.hover);

  const apiRef = useRef<ViewportApi | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fittedRef = useRef(false);

  const solids = useRegenerated();
  const activeSketch = session ? design.sketches.find((s) => s.id === session.sketchId) : undefined;
  const activeCommand = useCommandStore((state) => state.active);

  // Live command preview is derived geometry; it is never written to the document.
  const preview = useMemo(
    () => (activeCommand ? previewCommand(design, activeCommand, selection) : null),
    [activeCommand, design, selection],
  );

  // World-space bounds of the generated solids (model Z maps to world Y).
  const bounds = useMemo(() => {
    const box = new THREE.Box3();
    for (const bodyId of solids.bodyOrder) {
      const spec = solids.bodies[bodyId]?.spec;
      if (!spec || spec.polygon.length === 0) continue;
      const xs = spec.polygon.map((point) => point.x);
      const ys = spec.polygon.map((point) => point.y);
      const t = spec.transform ?? { x: 0, y: 0, z: 0 };
      const zMin = Math.min(spec.z0, spec.z1) + t.z;
      const zMax = Math.max(spec.z0, spec.z1) + t.z;
      box.expandByPoint(new THREE.Vector3(Math.min(...xs) + t.x, zMin, -(Math.max(...ys) + t.y)));
      box.expandByPoint(new THREE.Vector3(Math.max(...xs) + t.x, zMax, -(Math.min(...ys) + t.y)));
    }
    return box.isEmpty() ? null : box;
  }, [solids]);

  useEffect(() => {
    if (fittedRef.current || !bounds) return;
    fittedRef.current = true;
    const timer = window.setTimeout(() => apiRef.current?.fit(), 60);
    return () => window.clearTimeout(timer);
  }, [bounds]);

  // Frame the sketch plane when a session starts, and return to isometric when it ends.
  const sessionSketchId = session?.sketchId ?? null;
  const wasSketchingRef = useRef(false);
  useEffect(() => {
    if (sessionSketchId) {
      wasSketchingRef.current = true;
      const sketch = design.sketches.find((s) => s.id === sessionSketchId);
      if (!sketch) return;
      const view = sketch.plane === 'XY' ? 'top' : sketch.plane === 'XZ' ? 'front' : 'right';
      const timer = window.setTimeout(() => apiRef.current?.view(view), 80);
      return () => window.clearTimeout(timer);
    }
    if (wasSketchingRef.current) {
      wasSketchingRef.current = false;
      const timer = window.setTimeout(() => apiRef.current?.view('iso'), 60);
      return () => window.clearTimeout(timer);
    }
  }, [sessionSketchId]);

  useEffect(() => {
    const handleFit = () => apiRef.current?.fit();
    const handleView = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === 'iso' || detail === 'front' || detail === 'top' || detail === 'right') {
        apiRef.current?.view(detail);
      }
    };
    window.addEventListener('yantra:fit', handleFit);
    window.addEventListener('yantra:view', handleView);
    return () => {
      window.removeEventListener('yantra:fit', handleFit);
      window.removeEventListener('yantra:view', handleView);
    };
  }, []);

  const handlePick = (picked: Selection, event: ThreeEvent<MouseEvent>) => {
    const additive = event.nativeEvent.ctrlKey || event.nativeEvent.metaKey;
    const remove = event.nativeEvent.shiftKey;
    select(picked, remove ? 'remove' : additive ? 'add' : 'replace');
  };

  const handleSketchPoint = (raw: Vec2) => {
    if (!session || !activeSketch) return;
    const { point } = snapPoint(design, session.sketchId, raw, snapToGrid, gridSize);

    if (session.tool === 'rectangle' || session.tool === 'circle') {
      if (!session.pendingPoints.length) {
        patchSession({ pendingPoints: [point] });
        return;
      }
      const anchor = session.pendingPoints[0];
      if (session.tool === 'rectangle') {
        if (Math.abs(point.x - anchor.x) < 0.5 || Math.abs(point.y - anchor.y) < 0.5) {
          patchSession({ pendingPoints: [] });
          return;
        }
        addRectangle(session.sketchId, anchor, point);
      } else {
        const radius = Math.hypot(point.x - anchor.x, point.y - anchor.y);
        if (radius < 0.5) {
          patchSession({ pendingPoints: [] });
          return;
        }
        addCircle(session.sketchId, anchor, radius);
      }
      patchSession({ pendingPoints: [] });
      return;
    }

    if (session.tool === 'line') {
      if (!session.pendingPoints.length) {
        patchSession({ pendingPoints: [point] });
        return;
      }
      const from = session.pendingPoints[session.pendingPoints.length - 1];
      if (Math.hypot(point.x - from.x, point.y - from.y) < 0.4) return;
      addLine(session.sketchId, from, point);
      patchSession({ pendingPoints: [point] });
      return;
    }

    if (session.tool === 'polyline') {
      patchSession({ pendingPoints: [...session.pendingPoints, point] });
    }
  };

  const handleDraft = (raw: Vec2 | null) => {
    if (!raw || !session || !activeSketch) {
      patchSession({ cursor: null, snap: null });
      return;
    }
    const snapped = snapPoint(design, session.sketchId, raw, snapToGrid, gridSize);
    patchSession({ cursor: snapped.point, snap: snapped.snap });
  };

  const isSketching = Boolean(session && activeSketch);
  const selectedBodyId =
    selection.find((s) => s.kind === 'body' || s.kind === 'face' || s.kind === 'edge')?.bodyId ??
    selection.find((s) => s.kind === 'body')?.id ??
    null;
  const hoveredBodyId = hovered?.bodyId ?? (hovered?.kind === 'body' ? hovered.id : null);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onContextMenu={(event) => {
        event.preventDefault();
        const bodySelection = selection.find((s) => s.kind === 'body' || s.kind === 'face' || s.kind === 'edge');
        useUiStore.getState().openContextMenu(
          event.clientX,
          event.clientY,
          bodySelection ? { kind: 'body', id: bodySelection.bodyId ?? bodySelection.id } : { kind: 'canvas' },
        );
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [170, 150, 190], fov: 45, near: 1, far: 8000 }}
        gl={{ antialias: true }}
        raycaster={{ params: { Line: { threshold: 1.4 } } } as never}
        onPointerMissed={() => {
          if (!isSketching) select(null);
        }}
      >
        <color attach="background" args={['#0d1219']} />
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#cfe0f2', '#0a1018', 0.9]} />
        <directionalLight position={[180, 260, 160]} intensity={2.2} />
        <directionalLight position={[-200, 120, -160]} intensity={0.55} color="#9dc0e8" />

        <group rotation={[-Math.PI / 2, 0, 0]}>
          {showGrid ? (
            <Grid
              args={[420, 42]}
              rotation={[Math.PI / 2, 0, 0]}
              cellColor="#1d2a38"
              sectionColor="#2b3d4e"
              cellSize={5}
              sectionSize={25}
              fadeDistance={460}
              fadeStrength={1}
              infiniteGrid={false}
            />
          ) : null}
          <axesHelper args={[36]} />

          {solids.bodyOrder.map((bodyId) => {
            const solid = solids.bodies[bodyId];
            const meta = design.bodies.find((b) => b.id === bodyId);
            if (!solid || !meta) return null;
            const component = design.components.find((c) => c.id === meta.componentId);
            const visible = meta.visible && (component?.visible ?? true);
            return (
              <BodyMesh
                key={bodyId}
                bodyId={bodyId}
                spec={solid.spec}
                material={meta.material}
                visible={visible}
                selected={selectedBodyId === bodyId}
                hovered={hoveredBodyId === bodyId}
                displayMode={displayMode}
                pickingEnabled={!isSketching}
                onPick={handlePick}
                onHover={hover}
              />
            );
          })}

          {preview?.spec ? <PreviewSolid spec={preview.spec} /> : null}

          {design.sketches.map((sketch) => (
            <SketchLinework key={sketch.id} sketch={sketch} active={sketch.id === session?.sketchId} />
          ))}

          {isSketching && activeSketch ? (
            <>
              <SketchPlane plane={activeSketch.plane} onPoint={handleSketchPoint} onDraft={handleDraft} />
              {session ? <DraftLines session={session} plane={activeSketch.plane} /> : null}
              {session?.cursor ? <SnapMarker cursor={session.cursor} snap={session.snap} /> : null}
            </>
          ) : null}
        </group>

        <CameraRig apiRef={apiRef} bounds={bounds} />
      </Canvas>

      <ViewportOverlay apiRef={apiRef} />
    </div>
  );
}

function SnapMarker({ cursor, snap }: { cursor: Vec2; snap: string | null }) {
  const session = useUiStore((state) => state.sketchSession);
  const design = useDesignStore((state) => state.design);
  const sketch = design.sketches.find((s) => s.id === session?.sketchId);
  if (!sketch) return null;
  const position = sketchPointToLocal(sketch.plane, cursor.x, cursor.y, 0.2);
  const color = snap === 'point' ? '#3fbf8f' : snap === 'axis' ? '#e0a33a' : '#35a7ff';
  return (
    <mesh position={position}>
      <ringGeometry args={[1.6, 2.6, 20]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ViewportOverlay({ apiRef }: { apiRef: React.MutableRefObject<ViewportApi | null> }) {
  const displayMode = useUiStore((state) => state.displayMode);
  const setDisplayMode = useUiStore((state) => state.setDisplayMode);
  const showGrid = useUiStore((state) => state.showGrid);
  const toggleGrid = useUiStore((state) => state.toggleGrid);
  const session = useUiStore((state) => state.sketchSession);

  const modeLabel =
    displayMode === 'shadedEdges' ? 'Shaded + edges' : displayMode === 'shaded' ? 'Shaded' : 'Wireframe';

  return (
    <>
      <div className="absolute left-2.5 top-2.5 flex flex-col gap-1.5">
        <div className="rounded border border-line bg-ink-900/80 px-2 py-0.5 text-2xs text-slate-400 backdrop-blur">
          {session ? 'Sketch workspace' : 'Design workspace'}
        </div>
        {session ? (
          <div className="rounded border border-warn/40 bg-[#2a2110]/90 px-2 py-1 text-2xs text-amber-200">
            {session.tool === 'rectangle'
              ? session.pendingPoints.length
                ? 'Rectangle · click the opposite corner'
                : 'Rectangle · click the first corner'
              : session.tool === 'circle'
                ? session.pendingPoints.length
                  ? 'Circle · click to set radius'
                  : 'Circle · click the centre'
                : session.tool === 'line'
                  ? 'Line · click points · Enter ends the chain'
                  : session.tool === 'polyline'
                    ? 'Polyline · click points · Enter finishes'
                    : 'Select · click sketch geometry'}
          </div>
        ) : null}
      </div>

      <div className="absolute right-2.5 top-2.5 flex items-center gap-0.5 rounded-md border border-line bg-ink-900/85 p-1 backdrop-blur">
        <button className="icon-btn" title="Fit to view (F)" onClick={() => apiRef.current?.fit()}>
          <FitIcon />
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button className="icon-btn px-1.5 text-3xs" title="Isometric (1)" onClick={() => apiRef.current?.view('iso')}>
          ISO
        </button>
        <button className="icon-btn px-1.5 text-3xs" title="Front (2)" onClick={() => apiRef.current?.view('front')}>
          FR
        </button>
        <button className="icon-btn px-1.5 text-3xs" title="Top (3)" onClick={() => apiRef.current?.view('top')}>
          TOP
        </button>
        <button className="icon-btn px-1.5 text-3xs" title="Right (4)" onClick={() => apiRef.current?.view('right')}>
          RT
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button
          className="icon-btn px-1.5 text-2xs"
          title="Cycle display mode"
          onClick={() =>
            setDisplayMode(
              displayMode === 'shadedEdges' ? 'shaded' : displayMode === 'shaded' ? 'wireframe' : 'shadedEdges',
            )
          }
        >
          {modeLabel}
        </button>
        <button
          className={`icon-btn ${showGrid ? 'text-accent' : ''}`}
          title={showGrid ? 'Hide grid' : 'Show grid'}
          onClick={toggleGrid}
        >
          <GridIcon />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2.5 flex items-center gap-3 rounded border border-line/70 bg-ink-900/60 px-2 py-0.5 text-3xs text-slate-500">
        <span>
          <b className="text-slate-400">LMB</b> orbit
        </span>
        <span>
          <b className="text-slate-400">RMB</b> pan
        </span>
        <span>
          <b className="text-slate-400">Wheel</b> zoom
        </span>
        <span className="border-l border-line pl-3">Perspective</span>
      </div>
    </>
  );
}

function FitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M2 6h12M2 10h12M6 2v12M10 2v12" />
    </svg>
  );
}

/* Sketch entity creation lives here so the canvas and the sketch tools share one path. */
import { addSketchEntity } from '../services/actions';
import { newId } from '../model/doc';

function addRectangle(sketchId: string, a: Vec2, b: Vec2) {
  addSketchEntity(sketchId, { id: newId('e'), kind: 'rect', a, b });
}

function addCircle(sketchId: string, c: Vec2, r: number) {
  addSketchEntity(sketchId, { id: newId('e'), kind: 'circle', c, r });
}

function addLine(sketchId: string, a: Vec2, b: Vec2) {
  addSketchEntity(sketchId, { id: newId('e'), kind: 'line', a, b });
}
