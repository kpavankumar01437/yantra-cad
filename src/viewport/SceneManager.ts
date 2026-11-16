import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  buildSolidGeometry,
  localToSketch,
  planeNormalLocal,
  sketchPointToLocal,
  type SolidSpec,
} from '../geometry/solid';
import type { FaceInfo, PlaneId, Vec2 } from '../types';

export type DisplayMode = 'shadedEdges' | 'shaded' | 'wireframe';
export type ViewName = 'iso' | 'front' | 'top' | 'right';

export type SceneBody = { bodyId: string; spec: SolidSpec; visible: boolean };
export type SceneSketch = {
  sketchId: string;
  plane: PlaneId;
  lines: [Vec2, Vec2][];
  circles: { c: Vec2; r: number }[];
  active: boolean;
  visible: boolean;
};
export type SceneDraft = { plane: PlaneId; lines: [Vec2, Vec2][]; circles: { c: Vec2; r: number }[] } | null;

export type SceneState = {
  bodies: SceneBody[];
  sketches: SceneSketch[];
  draft: SceneDraft;
  preview: SolidSpec | null;
  displayMode: DisplayMode;
  grid: boolean;
  sketchPlane: PlaneId | null;
  selectedBodyId: string | null;
  hoverBodyId: string | null;
};

export type PickResult = { bodyId: string; face: FaceInfo };

const EMPTY_STATE: SceneState = {
  bodies: [],
  sketches: [],
  draft: null,
  preview: null,
  displayMode: 'shadedEdges',
  grid: true,
  sketchPlane: null,
  selectedBodyId: null,
  hoverBodyId: null,
};

export class SceneManager {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  /** Model space is Z-up; this group maps it into three's Y-up world. */
  private readonly world = new THREE.Group();
  private readonly modelGroup = new THREE.Group();
  private readonly sketchGroup = new THREE.Group();
  private readonly draftGroup = new THREE.Group();
  private readonly helperGroup = new THREE.Group();
  private readonly grid: THREE.GridHelper;
  private readonly planeGroup = new THREE.Group();
  private readonly bodyMeshes = new Map<string, THREE.Mesh>();
  private previewMesh: THREE.Mesh | null = null;

  private readonly matBody: THREE.MeshStandardMaterial;
  private readonly matSelected: THREE.MeshStandardMaterial;
  private readonly matHover: THREE.MeshStandardMaterial;
  private readonly matWire: THREE.MeshBasicMaterial;
  private readonly matPreview: THREE.MeshStandardMaterial;
  private readonly matEdge: THREE.LineBasicMaterial;
  private readonly matSketch: THREE.LineBasicMaterial;
  private readonly matSketchActive: THREE.LineBasicMaterial;
  private readonly matDraft: THREE.LineDashedMaterial;

  private state: SceneState = EMPTY_STATE;
  private frameId: number | null = null;
  private resizeObserver: ResizeObserver;
  private disposed = false;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0d1219);
    this.scene.add(this.world);
    this.world.rotation.x = -Math.PI / 2;
    this.world.add(this.modelGroup, this.sketchGroup, this.draftGroup, this.helperGroup);

    const hemi = new THREE.HemisphereLight(0xdbe7f5, 0x0a1018, 1.5);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(180, 260, 160);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8fb6e0, 0.75);
    fill.position.set(-220, 120, -160);
    this.scene.add(fill);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 8000);
    this.camera.position.set(150, 135, 170);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.9;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.target.set(0, 0, 0);

    this.grid = new THREE.GridHelper(400, 40, 0x33475c, 0x1e2a38);
    this.grid.rotation.x = Math.PI / 2;
    const gridMaterial = this.grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.85;
    this.helperGroup.add(this.grid, this.planeGroup);

    const axes = new THREE.Group();
    const axis = (dir: [number, number, number], color: number) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(dir[0] * 34, dir[1] * 34, dir[2] * 34),
      ]);
      return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }));
    };
    axes.add(axis([1, 0, 0], 0xe0605e), axis([0, 1, 0], 0x63c07a), axis([0, 0, 1], 0x5c9bf0));
    this.helperGroup.add(axes);

    this.matBody = new THREE.MeshStandardMaterial({
      color: 0x9aabbd,
      metalness: 0.35,
      roughness: 0.45,
      flatShading: true,
    });
    this.matSelected = new THREE.MeshStandardMaterial({
      color: 0x6fb4ff,
      emissive: 0x183a5e,
      metalness: 0.3,
      roughness: 0.35,
      flatShading: true,
    });
    this.matHover = new THREE.MeshStandardMaterial({
      color: 0xb4c6d8,
      emissive: 0x1d2c3c,
      metalness: 0.35,
      roughness: 0.4,
      flatShading: true,
    });
    this.matWire = new THREE.MeshBasicMaterial({ color: 0x8fb4d8, wireframe: true });
    this.matPreview = new THREE.MeshStandardMaterial({
      color: 0x53c7ff,
      emissive: 0x1a4a63,
      metalness: 0.2,
      roughness: 0.4,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      flatShading: true,
    });
    this.matEdge = new THREE.LineBasicMaterial({ color: 0x2a3b4d });
    this.matSketch = new THREE.LineBasicMaterial({ color: 0x6d8aa6 });
    this.matSketchActive = new THREE.LineBasicMaterial({ color: 0xffb648 });
    this.matDraft = new THREE.LineDashedMaterial({ color: 0xffd18a, dashSize: 2, gapSize: 1.4 });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.animate();
  }

  private animate = () => {
    if (this.disposed) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.animate);
  };

  private resize = () => {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(width, height, true);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private clearGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }
  }

  update(next: Partial<SceneState>) {
    this.state = { ...this.state, ...next };
    this.rebuild();
  }

  private rebuild() {
    const s = this.state;
    this.clearGroup(this.modelGroup);
    this.clearGroup(this.sketchGroup);
    this.clearGroup(this.draftGroup);
    this.clearGroup(this.planeGroup);
    this.bodyMeshes.clear();
    this.previewMesh = null;
    this.grid.visible = s.grid;

    for (const body of s.bodies) {
      const geometry = buildSolidGeometry(body.spec);
      const mesh = new THREE.Mesh(geometry, this.matBody);
      mesh.userData.bodyId = body.bodyId;
      mesh.visible = body.visible;
      this.modelGroup.add(mesh);
      this.bodyMeshes.set(body.bodyId, mesh);

      if (s.displayMode === 'shadedEdges') {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), this.matEdge);
        mesh.add(edges);
      }
    }

    if (s.preview) {
      const geometry = buildSolidGeometry(s.preview);
      const mesh = new THREE.Mesh(geometry, this.matPreview);
      mesh.renderOrder = 2;
      this.modelGroup.add(mesh);
      this.previewMesh = mesh;
    }

    for (const sketch of s.sketches) {
      if (!sketch.visible) continue;
      const material = sketch.active ? this.matSketchActive : this.matSketch;
      const positions: number[] = [];
      const push = (a: Vec2, b: Vec2) => {
        const p = sketchPointToLocal(sketch.plane, a.x, a.y, 0.06);
        const q = sketchPointToLocal(sketch.plane, b.x, b.y, 0.06);
        positions.push(p.x, p.y, p.z, q.x, q.y, q.z);
      };
      for (const [a, b] of sketch.lines) push(a, b);
      for (const circle of sketch.circles) {
        const segments = 64;
        for (let i = 0; i < segments; i += 1) {
          const t0 = (i / segments) * Math.PI * 2;
          const t1 = ((i + 1) / segments) * Math.PI * 2;
          push(
            { x: circle.c.x + Math.cos(t0) * circle.r, y: circle.c.y + Math.sin(t0) * circle.r },
            { x: circle.c.x + Math.cos(t1) * circle.r, y: circle.c.y + Math.sin(t1) * circle.r },
          );
        }
      }
      if (!positions.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      this.sketchGroup.add(new THREE.LineSegments(geometry, material));
    }

    if (s.draft) {
      const positions: number[] = [];
      const push = (a: Vec2, b: Vec2) => {
        const p = sketchPointToLocal(s.draft!.plane, a.x, a.y, 0.12);
        const q = sketchPointToLocal(s.draft!.plane, b.x, b.y, 0.12);
        positions.push(p.x, p.y, p.z, q.x, q.y, q.z);
      };
      for (const [a, b] of s.draft.lines) push(a, b);
      for (const circle of s.draft.circles) {
        const segments = 64;
        for (let i = 0; i < segments; i += 1) {
          const t0 = (i / segments) * Math.PI * 2;
          const t1 = ((i + 1) / segments) * Math.PI * 2;
          push(
            { x: circle.c.x + Math.cos(t0) * circle.r, y: circle.c.y + Math.sin(t0) * circle.r },
            { x: circle.c.x + Math.cos(t1) * circle.r, y: circle.c.y + Math.sin(t1) * circle.r },
          );
        }
      }
      if (positions.length) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const lines = new THREE.LineSegments(geometry, this.matDraft);
        lines.computeLineDistances();
        this.draftGroup.add(lines);
      }
    }

    if (s.sketchPlane) {
      const planeGeometry = new THREE.PlaneGeometry(320, 320);
      const plane = new THREE.Mesh(
        planeGeometry,
        new THREE.MeshBasicMaterial({
          color: 0x4c9aff,
          transparent: true,
          opacity: 0.05,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      this.positionOnPlane(plane, s.sketchPlane, 0);
      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(planeGeometry),
        new THREE.LineBasicMaterial({ color: 0x3f6f9e, transparent: true, opacity: 0.7 }),
      );
      this.positionOnPlane(border, s.sketchPlane, 0);
      this.planeGroup.add(plane, border);
    }

    this.applyStates();
  }

  private positionOnPlane(object: THREE.Object3D, plane: PlaneId, w: number) {
    if (plane === 'XZ') object.rotation.x = -Math.PI / 2;
    if (plane === 'YZ') object.rotation.y = Math.PI / 2;
    object.position.copy(sketchPointToLocal(plane, 0, 0, w));
  }

  private applyStates() {
    for (const [id, mesh] of this.bodyMeshes) {
      if (id === this.state.selectedBodyId) mesh.material = this.matSelected;
      else if (id === this.state.hoverBodyId) mesh.material = this.matHover;
      else mesh.material = this.state.displayMode === 'wireframe' ? this.matWire : this.matBody;
    }
  }

  setSketchInteraction(active: boolean) {
    this.controls.enableRotate = !active;
  }

  setSelection(selectedBodyId: string | null, hoverBodyId: string | null) {
    this.state = { ...this.state, selectedBodyId, hoverBodyId };
    this.applyStates();
  }

  private rayFor(clientX: number, clientY: number): THREE.Raycaster {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    return raycaster;
  }

  pick(clientX: number, clientY: number): PickResult | null {
    const raycaster = this.rayFor(clientX, clientY);
    const meshes = [...this.bodyMeshes.values()].filter((mesh) => mesh.visible);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const mesh = hit.object as THREE.Mesh;
    const bodyId = String(mesh.userData.bodyId);
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute('position');
    const index = (hit.faceIndex ?? 0) * 3;
    if (index + 2 >= position.count) return null;

    const a = new THREE.Vector3().fromBufferAttribute(position, index);
    const b = new THREE.Vector3().fromBufferAttribute(position, index + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, index + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const area = normal.length() / 2;
    normal.normalize();

    const point = this.world.worldToLocal(hit.point.clone());
    return {
      bodyId,
      face: { area, normal: [normal.x, normal.y, normal.z], point: [point.x, point.y, point.z] },
    };
  }

  /** Convert a screen position into sketch-plane coordinates (mm). */
  sketchPointAt(clientX: number, clientY: number, plane: PlaneId): Vec2 | null {
    const raycaster = this.rayFor(clientX, clientY);
    this.world.updateMatrixWorld();
    const normal = planeNormalLocal(plane).applyQuaternion(this.world.quaternion).normalize();
    const origin = this.world.localToWorld(sketchPointToLocal(plane, 0, 0, 0));
    const plane3 = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane3, hit)) return null;
    const local = this.world.worldToLocal(hit);
    return localToSketch(plane, local);
  }

  private bounds(): { center: THREE.Vector3; radius: number } {
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    if (box.isEmpty()) {
      return { center: new THREE.Vector3(0, 0, 0), radius: 70 };
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    return { center, radius: Math.max(size.length() / 2, 20) };
  }

  private viewDistance(radius: number, padding = 1.7): number {
    return (radius / Math.tan((this.camera.fov * Math.PI) / 360)) * padding;
  }

  frame() {
    const { center, radius } = this.bounds();
    const distance = this.viewDistance(radius);
    const direction = this.camera.position.clone().sub(this.controls.target);
    if (direction.lengthSq() < 1e-6) direction.set(1, 0.85, 1);
    direction.normalize();
    this.camera.up.set(0, 1, 0);
    this.camera.near = Math.max(0.1, distance / 200);
    this.camera.far = distance * 40;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.controls.update();
  }

  setView(view: ViewName) {
    const { center, radius } = this.bounds();
    const distance = this.viewDistance(radius);
    this.camera.up.set(0, 1, 0);
    if (view === 'front') {
      this.camera.position.set(center.x, center.y, center.z + distance);
    } else if (view === 'top') {
      this.camera.up.set(0, 0, -1);
      this.camera.position.set(center.x, center.y + distance, center.z + 0.01);
    } else if (view === 'right') {
      this.camera.position.set(center.x + distance, center.y, center.z);
    } else {
      this.camera.position.set(
        center.x + distance * 0.72,
        center.y + distance * 0.62,
        center.z + distance * 0.72,
      );
    }
    this.controls.target.copy(center);
    this.controls.update();
  }

  zoom(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  dispose() {
    this.disposed = true;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    this.clearGroup(this.modelGroup);
    this.clearGroup(this.sketchGroup);
    this.clearGroup(this.draftGroup);
    this.clearGroup(this.planeGroup);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.host) {
      this.host.removeChild(this.renderer.domElement);
    }
  }
}
