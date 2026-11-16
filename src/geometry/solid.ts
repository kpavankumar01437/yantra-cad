import * as THREE from 'three';
import type { PlaneId, Sketch, Vec2 } from '../types';

/** A resolved, renderable description of one solid body.
 *  Produced by the regeneration pipeline from the feature history.
 */
export type SolidSpec = {
  plane: PlaneId;
  /** Closed profile in sketch-local millimetres (CCW). */
  polygon: Vec2[];
  z0: number;
  z1: number;
  /** Wall thickness for a shelled body (open top). */
  shell?: number;
  transform: { x: number; y: number; z: number };
};

export type SketchLines = { lines: [Vec2, Vec2][]; circles: { c: Vec2; r: number }[] };

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

export function sketchToLines(sketch: Sketch): SketchLines {
  const lines: [Vec2, Vec2][] = [];
  const circles: { c: Vec2; r: number }[] = [];
  for (const entity of sketch.entities) {
    if (entity.kind === 'rect') {
      const p = rectPolygon(entity.a, entity.b);
      for (let i = 0; i < p.length; i += 1) lines.push([p[i], p[(i + 1) % p.length]]);
    } else if (entity.kind === 'circle') {
      circles.push({ c: entity.c, r: entity.r });
    } else {
      lines.push([entity.a, entity.b]);
    }
  }
  return { lines, circles };
}

/** First closed profile found in a sketch, if any. */
export function profileOf(sketch: Sketch): { polygon: Vec2[] } | { error: string } {
  const rect = sketch.entities.find((e) => e.kind === 'rect');
  if (rect && rect.kind === 'rect') {
    const poly = rectPolygon(rect.a, rect.b);
    if (Math.abs(polygonArea(poly)) < 0.01) return { error: 'Profile has no area' };
    return { polygon: poly };
  }
  const circle = sketch.entities.find((e) => e.kind === 'circle');
  if (circle && circle.kind === 'circle') {
    if (circle.r < 0.05) return { error: 'Circle radius is too small' };
    return { polygon: circlePolygon(circle.c, circle.r) };
  }
  const lines = sketch.entities.filter((e) => e.kind === 'line');
  if (lines.length >= 3) {
    const poly = lines.map((l) => (l.kind === 'line' ? l.a : { x: 0, y: 0 }));
    if (Math.abs(polygonArea(poly)) > 0.01) return { polygon: poly };
  }
  return { error: 'Sketch has no closed profile to extrude' };
}

function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const hasNeg = d1 < -EPS || d2 < -EPS || d3 < -EPS;
  const hasPos = d1 > EPS || d2 > EPS || d3 > EPS;
  return !(hasNeg && hasPos);
}

/** Ear-clipping triangulation of a simple CCW polygon. Returns index triples. */
export function triangulate2D(poly: Vec2[]): number[] {
  const n = poly.length;
  if (n < 3) return [];
  const idx: number[] = [];
  for (let i = 0; i < n; i += 1) idx.push(i);
  const out: number[] = [];
  let guard = 0;

  while (idx.length > 3 && guard < 4000) {
    guard += 1;
    let clipped = false;
    for (let i = 0; i < idx.length; i += 1) {
      const i0 = idx[(i - 1 + idx.length) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      const a = poly[i0];
      const b = poly[i1];
      const c = poly[i2];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross <= EPS) continue;
      let contains = false;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (pointInTriangle(poly[j], a, b, c)) {
          contains = true;
          break;
        }
      }
      if (contains) continue;
      out.push(i0, i1, i2);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
  return out;
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

/** Round every convex corner of a CCW polygon with radius `r` (profile fillet). */
export function roundPolygon(poly: Vec2[], radius: number): { poly: Vec2[]; clamped: boolean } {
  if (radius <= 0.01) return { poly, clamped: false };
  const n = poly.length;
  let r = radius;
  let clamped = false;

  // Clamp so neighbouring corners cannot consume the same edge.
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

/** Build renderable geometry for a solid spec (all units mm, model axes: Z up). */
export function buildSolidGeometry(spec: SolidSpec): THREE.BufferGeometry {
  const poly = ensureCCW(spec.polygon);
  const zLow = Math.min(spec.z0, spec.z1);
  const zHigh = Math.max(spec.z0, spec.z1);
  const positions: number[] = [];

  const push = (x: number, y: number, z: number) => positions.push(x, y, z);
  const pushTri = (a: Vec2, b: Vec2, c: Vec2, z: number) => {
    push(a.x, a.y, z);
    push(b.x, b.y, z);
    push(c.x, c.y, z);
  };

  const tri = triangulate2D(poly);
  const shell = spec.shell && spec.shell > 0 ? spec.shell : 0;

  // Bottom cap (outward normal -Z).
  for (let i = 0; i < tri.length; i += 3) {
    push(poly[tri[i]].x, poly[tri[i]].y, zLow);
    push(poly[tri[i + 2]].x, poly[tri[i + 2]].y, zLow);
    push(poly[tri[i + 1]].x, poly[tri[i + 1]].y, zLow);
  }

  const wall = (loop: Vec2[], z0: number, z1: number, inward: boolean) => {
    for (let i = 0; i < loop.length; i += 1) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      if (inward) {
        push(b.x, b.y, z0);
        push(a.x, a.y, z0);
        push(a.x, a.y, z1);
        push(b.x, b.y, z0);
        push(a.x, a.y, z1);
        push(b.x, b.y, z1);
      } else {
        push(a.x, a.y, z0);
        push(b.x, b.y, z0);
        push(b.x, b.y, z1);
        push(a.x, a.y, z0);
        push(b.x, b.y, z1);
        push(a.x, a.y, z1);
      }
    }
  };

  wall(poly, zLow, zHigh, false);

  if (shell > 0) {
    const inner = offsetPolygon(poly, shell);
    const innerTri = triangulate2D(inner);
    const floor = zLow + shell;

    // Inner floor, facing +Z.
    for (let i = 0; i < innerTri.length; i += 3) {
      pushTri(inner[innerTri[i]], inner[innerTri[i + 1]], inner[innerTri[i + 2]], floor);
    }
    // Inner walls seen from inside the cavity.
    wall(inner, floor, zHigh, true);
    // Top rim between outer and inner loops.
    for (let i = 0; i < poly.length; i += 1) {
      const o0 = poly[i];
      const o1 = poly[(i + 1) % poly.length];
      const i0 = inner[i];
      const i1 = inner[(i + 1) % poly.length];
      pushTri(o0, o1, i1, zHigh);
      pushTri(o0, i1, i0, zHigh);
    }
  } else {
    // Solid top cap (+Z).
    for (let i = 0; i < tri.length; i += 3) {
      pushTri(poly[tri[i]], poly[tri[i + 1]], poly[tri[i + 2]], zHigh);
    }
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

/** Area of the triangle behind a raycast face index (mm²). */
export function faceArea(geometry: THREE.BufferGeometry, faceIndex: number): number {
  const pos = geometry.getAttribute('position');
  const i = faceIndex * 3;
  if (i + 2 >= pos.count) return 0;
  const a = new THREE.Vector3().fromBufferAttribute(pos, i);
  const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
  const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
  return b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
}
