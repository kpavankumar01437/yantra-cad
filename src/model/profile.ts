import { circlePolygon, pointInPolygon, polygonArea, rectPolygon } from '../geometry/solid';
import type { Sketch, Vec2 } from '../types';

/** Every closed loop in a sketch, as a polygon. */
export function closedLoops(sketch: Sketch): Vec2[][] {
  const loops: Vec2[][] = [];

  for (const entity of sketch.entities) {
    if (entity.kind === 'rect') {
      loops.push(rectPolygon(entity.a, entity.b));
    } else if (entity.kind === 'circle') {
      loops.push(circlePolygon(entity.c, entity.r));
    } else if (entity.kind === 'polyline' && entity.closed) {
      loops.push(entity.points.map((p) => ({ ...p })));
    }
  }

  // Chain loose line segments into closed loops.
  const lines = sketch.entities.filter((e) => e.kind === 'line');
  if (lines.length >= 3) {
    const remaining = lines.flatMap((line) => (line.kind === 'line' ? [[{ ...line.a }, { ...line.b }]] : []));
    while (remaining.length) {
      const chain = remaining.shift() as Vec2[];
      let extended = true;
      while (extended) {
        extended = false;
        const tail = chain[chain.length - 1];
        for (let i = 0; i < remaining.length; i += 1) {
          const [p, q] = remaining[i];
          const near = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y) < 0.05;
          if (near(tail, p)) {
            chain.push(q);
            remaining.splice(i, 1);
            extended = true;
            break;
          }
          if (near(tail, q)) {
            chain.push(p);
            remaining.splice(i, 1);
            extended = true;
            break;
          }
        }
      }
      if (chain.length >= 4) {
        const first = chain[0];
        const last = chain[chain.length - 1];
        if (Math.hypot(first.x - last.x, first.y - last.y) < 0.05) chain.pop();
      }
      if (chain.length >= 3 && Math.abs(polygonArea(chain)) > 0.05) loops.push(chain);
    }
  }

  return loops.filter((loop) => Math.abs(polygonArea(loop)) > 0.01);
}

export type Profile = { polygon: Vec2[]; holes: Vec2[][] };

/** Outer profile plus any loops nested inside it, ready for extrusion or cutting. */
export function profileOf(sketch: Sketch): { profile: Profile } | { error: string } {
  const loops = closedLoops(sketch);
  if (!loops.length) return { error: 'Sketch has no closed profile to use' };

  const sorted = [...loops].sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
  const outer = sorted[0];
  const holes = sorted
    .slice(1)
    .filter((loop) => pointInPolygon(loop[0], outer));

  return { profile: { polygon: outer, holes } };
}
