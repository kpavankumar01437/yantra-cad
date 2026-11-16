import * as THREE from 'three';
import earcut from 'earcut';
import type { PlaneId, Vec2, Vec3 } from '../types';

/** Renderable description of one solid, produced by feature regeneration. */
export type SolidSpec = {
  plane: PlaneId;
  /** Outer closed profile, sketch-local millimetres. */
  polygon: Vec2[];
  /** Inner closed profiles (holes), sketch-local millimetres. */
  holes?: Vec2[][];
  z0: number;
  z1: number;
  /** Wall thickness for a shelled body (open top). */
  shell?: number;
  transform: Vec3;
};

const EPS = 1e-9;

export function rectPolygon(a: Vec2, b: Vec2): Vec2[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

export function circlePolygon(c: Vec2, r: number, segments = 64): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    out.push({ x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r });
  }
  return out;
}

export function polygonArea(poly: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function ensureCCW(poly: Vec2[]): Vec2[] {
  return polygonArea(poly) < 0 ? [...poly].reverse() : poly;
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i];
    const b = poly[j];
    const intersects = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || EPS) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Triangulate polygon with optional holes. Returns triangles referencing `vertices`. */
export function triangulate2D(
  polygon: Vec2[],
  holes: Vec2[][] = [],
): { indices: number[]; vertices: Vec2[] } {
  const vertices: Vec2[] = [...polygon];
  const holeIndices: number[] = [];
  for (const hole of holes) {
    holeIndices.push(vertices.length);
    vertices.push(...hole);
  }
  const flat: number[] = [];
  for (const v of vertices) flat.push(v.x, v.y);
  const indices = (earcut(flat, holeIndices.length ? holeIndices : undefined, 2) as number[]) ?? [];
  return { indices, vertices };
}

function inwardNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function lineIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-7) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  return { x: p1.x + d1x * t, y: p1.y + d1y * t };
}

/** Offset a CCW polygon inward by `d` millimetres (miter joins). */
export function offsetPolygon(poly: Vec2[], d: number): Vec2[] {
  const n = poly.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = poly[(i - 1 + n) % n];
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    const n1 = inwardNormal(prev, cur);
    const n2 = inwardNormal(cur, next);
    const hit = lineIntersect(
      { x: prev.x + n1.x * d, y: prev.y + n1.y * d },
      { x: cur.x + n1.x * d, y: cur.y + n1.y * d },
      { x: cur.x + n2.x * d, y: cur.y + n2.y * d },
      { x: next.x + n2.x * d, y: next.y + n2.y * d },
    );
    out.push(hit ?? { x: cur.x + n2.x * d, y: cur.y + n2.y * d });
  }
  return out;
}

/** Round every convex corner of a CCW polygon (profile fillet). */
export function roundPolygon(poly: Vec2[], radius: number): { poly: Vec2[]; clamped: boolean } {
  if (radius <= 0.01) return { poly, clamped: false };
  const n = poly.length;
  let r = radius;
  let clamped = false;

  for (let i = 0; i < n; i += 1) {
    const prev = poly[(i - 1 + n) % n];
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    const v1 = { x: prev.x - cur.x, y: prev.y - cur.y };
    const v2 = { x: next.x - cur.x, y: next.y - cur.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (l1 * l2)));
    const theta = Math.acos(cos);
    if (theta < 1e-3 || Math.PI - theta < 1e-3) continue;
    const maxR = Math.tan(theta / 2) * Math.min(l1, l2) * 0.5;
    if (maxR < r) {
      r = Math.max(0.01, maxR);
      clamped = true;
    }
  }

  const out: Vec2[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = poly[(i - 1 + n) % n];
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    const v1 = { x: prev.x - cur.x, y: prev.y - cur.y };
    const v2 = { x: next.x - cur.x, y: next.y - cur.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const u1 = { x: v1.x / l1, y: v1.y / l1 };
    const u2 = { x: v2.x / l2, y: v2.y / l2 };
    const cos = Math.min(1, Math.max(-1, u1.x * u2.x + u1.y * u2.y));
    const theta = Math.acos(cos);
    if (theta < 1e-3 || Math.PI - theta < 1e-3) {
      out.push(cur);
      continue;
    }
    const tangent = r / Math.tan(theta / 2);
    const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bisLen = Math.hypot(bis.x, bis.y) || 1;
    const centerDist = r / Math.sin(theta / 2);
    const center = {
      x: cur.x + (bis.x / bisLen) * centerDist,
      y: cur.y + (bis.y / bisLen) * centerDist,
    };
    const t1 = { x: cur.x + u1.x * tangent, y: cur.y + u1.y * tangent };
    const t2 = { x: cur.x + u2.x * tangent, y: cur.y + u2.y * tangent };
    const a1 = Math.atan2(t1.y - center.y, t1.x - center.x);
    let sweep = Math.atan2(t2.y - center.y, t2.x - center.x) - a1;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    while (sweep < -Math.PI) sweep += Math.PI * 2;
    const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
    for (let s = 0; s <= steps; s += 1) {
      const ang = a1 + (sweep * s) / steps;
      out.push({ x: center.x + Math.cos(ang) * r, y: center.y + Math.sin(ang) * r });
    }
  }
  return { poly: out, clamped };
}

export function sketchPointToLocal(plane: PlaneId, u: number, v: number, w: number): THREE.Vector3 {
  if (plane === 'XZ') return new THREE.Vector3(u, w, -v);
  if (plane === 'YZ') return new THREE.Vector3(w, v, -u);
  return new THREE.Vector3(u, v, w);
}

export function localToSketch(plane: PlaneId, p: THREE.Vector3): Vec2 {
  if (plane === 'XZ') return { x: p.x, y: -p.z };
  if (plane === 'YZ') return { x: -p.z, y: p.y };
  return { x: p.x, y: p.y };
}

export function planeNormalLocal(plane: PlaneId): THREE.Vector3 {
  if (plane === 'XZ') return new THREE.Vector3(0, 1, 0);
  if (plane === 'YZ') return new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3(0, 0, 1);
}

/** Build renderable geometry for a solid spec (model space, Z up). */
export function buildSolidGeometry(spec: SolidSpec): THREE.BufferGeometry {
  const poly = ensureCCW(spec.polygon);
  const holes = (spec.holes ?? []).filter((h) => h.length >= 3).map((h) => ensureCCW(h));
  const zLow = Math.min(spec.z0, spec.z1);
  const zHigh = Math.max(spec.z0, spec.z1);
  const { indices, vertices } = triangulate2D(poly, holes);
  const positions: number[] = [];

  const push = (v: Vec2, z: number) => positions.push(v.x, v.y, z);
  const pushTri = (a: Vec2, b: Vec2, c: Vec2, z: number) => {
    push(a, z);
    push(b, z);
    push(c, z);
  };

  const emitCap = (z: number, down: boolean) => {
    for (let i = 0; i < indices.length; i += 3) {
      const a = vertices[indices[i]];
      const b = vertices[indices[i + 1]];
      const c = vertices[indices[i + 2]];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const ccw = cross >= 0;
      if (down) {
        if (ccw) pushTri(a, c, b, z);
        else pushTri(a, b, c, z);
      } else if (ccw) {
        pushTri(a, b, c, z);
      } else {
        pushTri(a, c, b, z);
      }
    }
  };

  const wall = (loop: Vec2[], z0: number, z1: number, inward: boolean) => {
    for (let i = 0; i < loop.length; i += 1) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      if (inward) {
        push(b, z0);
        push(a, z0);
        push(a, z1);
        push(b, z0);
        push(a, z1);
        push(b, z1);
      } else {
        push(a, z0);
        push(b, z0);
        push(b, z1);
        push(a, z0);
        push(b, z1);
        push(a, z1);
      }
    }
  };

  const shell = spec.shell && spec.shell > 0 && holes.length === 0 ? spec.shell : 0;

  emitCap(zLow, true);
  wall(poly, zLow, zHigh, false);
  for (const hole of holes) wall(hole, zLow, zHigh, true);

  if (shell > 0) {
    const inner = offsetPolygon(poly, shell);
    const innerTri = triangulate2D(inner);
    const floor = zLow + shell;
    for (let i = 0; i < innerTri.indices.length; i += 3) {
      const a = innerTri.vertices[innerTri.indices[i]];
      const b = innerTri.vertices[innerTri.indices[i + 1]];
      const c = innerTri.vertices[innerTri.indices[i + 2]];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross >= 0) pushTri(a, b, c, floor);
      else pushTri(a, c, b, floor);
    }
    wall(inner, floor, zHigh, true);
    for (let i = 0; i < poly.length; i += 1) {
      const o0 = poly[i];
      const o1 = poly[(i + 1) % poly.length];
      const i0 = inner[i];
      const i1 = inner[(i + 1) % poly.length];
      pushTri(o0, o1, i1, zHigh);
      pushTri(o0, i1, i0, zHigh);
    }
  } else {
    emitCap(zHigh, false);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (spec.plane === 'XZ') geometry.rotateX(-Math.PI / 2);
  if (spec.plane === 'YZ') geometry.rotateY(Math.PI / 2);
  geometry.translate(spec.transform.x, spec.transform.y, spec.transform.z);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Signed volume of a closed, non-indexed triangulated surface (mm³). */
export function geometryVolume(geometry: THREE.BufferGeometry): number {
  const pos = geometry.getAttribute('position');
  let total = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    total += a.dot(b.clone().cross(c)) / 6;
  }
  return Math.abs(total);
}

/**
 * Area of the planar region behind a raycast triangle index (mm²).
 * The mesh is tessellated, so a CAD face is the set of coplanar triangles sharing a plane.
 */
export function faceArea(geometry: THREE.BufferGeometry, faceIndex: number): number {
  const pos = geometry.getAttribute('position');
  const count = pos.count;
  const i = faceIndex * 3;
  if (i + 2 >= count) return 0;

  const a = new THREE.Vector3().fromBufferAttribute(pos, i);
  const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
  const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
  const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  const length = normal.length();
  if (length < 1e-9) return 0;
  normal.divideScalar(length);
  const planeOffset = normal.dot(a);

  let area = 0;
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const cross = new THREE.Vector3();
  for (let t = 0; t + 2 < count; t += 3) {
    p0.fromBufferAttribute(pos, t);
    p1.fromBufferAttribute(pos, t + 1);
    p2.fromBufferAttribute(pos, t + 2);
    cross.subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));
    const triLength = cross.length();
    if (triLength < 1e-9) continue;
    if (cross.divideScalar(triLength).dot(normal) <= 1 - 1e-4) continue;
    if (Math.abs(p0.dot(normal) - planeOffset) > 1e-3) continue;
    area += triLength / 2;
  }
  return area;
}
