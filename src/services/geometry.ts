import { useMemo } from 'react';
import * as THREE from 'three';
import { buildSolidGeometry, geometryVolume, type SolidSpec } from '../geometry/solid';
import { regenerate, type Regenerated } from '../model/regenerate';
import { useDesignStore } from '../stores/designStore';

/** Derived geometry for the current document. Never stored. */
export function useRegenerated(): Regenerated {
  const design = useDesignStore((state) => state.design);
  return useMemo(() => regenerate(design), [design]);
}

export type BodyMetrics = {
  volume: number;
  size: [number, number, number];
  triangles: number;
  area: number;
};

export function useBodyMetrics(spec: SolidSpec | undefined): BodyMetrics | null {
  return useMemo(() => {
    if (!spec) return null;
    const geometry = buildSolidGeometry(spec);
    const volume = geometryVolume(geometry);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const size = box ? box.getSize(new THREE.Vector3()) : new THREE.Vector3();
    const position = geometry.getAttribute('position');
    let area = 0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      area += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    }
    const triangles = position.count / 3;
    geometry.dispose();
    return { volume, size: [size.x, size.y, size.z] as [number, number, number], triangles, area };
  }, [spec]);
}
