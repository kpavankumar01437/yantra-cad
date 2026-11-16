import { AlertTriangle } from 'lucide-react';
import { useRegenerated } from '../services/geometry';
import { useDesignStore } from '../stores/designStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';
import type { Selection } from '../types';

function describe(selection: Selection[], design: ReturnType<typeof useDesignStore.getState>['design']): string {
  const first = selection[0];
  if (!first) return 'Nothing selected';
  const suffix = selection.length > 1 ? ` +${selection.length - 1}` : '';

  if (first.kind === 'body' || first.kind === 'face' || first.kind === 'edge') {
    const body = design.bodies.find((b) => b.id === (first.bodyId ?? first.id));
    const component = body ? design.components.find((c) => c.id === body.componentId) : undefined;
    const label = body ? `${component?.name ?? ''} / ${body.name}` : 'Body';
    if (first.kind === 'face' && first.face) return `Face · ${label} · ${first.face.area.toFixed(1)} mm²${suffix}`;
    if (first.kind === 'edge' && first.edge) return `Edge · ${label} · ${first.edge.length.toFixed(2)} mm${suffix}`;
    return `Body · ${label}${suffix}`;
  }
  if (first.kind === 'sketch') {
    const sketch = design.sketches.find((s) => s.id === first.id);
    return sketch ? `Sketch · ${sketch.name} · ${sketch.entities.length} entities${suffix}` : 'Sketch';
  }
  if (first.kind === 'feature') {
    const feature = design.features.find((f) => f.id === first.id);
    return feature ? `Feature · ${feature.name} (${feature.kind})${suffix}` : 'Feature';
  }
  if (first.kind === 'parameter') {
    const parameter = design.parameters.find((p) => p.id === first.id);
    return parameter ? `Parameter · ${parameter.name}${suffix}` : 'Parameter';
  }
  return `${first.kind}${suffix}`;
}

export function StatusBar() {
  const design = useDesignStore((state) => state.design);
  const selection = useSelectionStore((state) => state.selection);
  const hovered = useSelectionStore((state) => state.hovered);
  const units = useUiStore((state) => state.units);
  const snapToGrid = useUiStore((state) => state.snapToGrid);
  const gridSize = useUiStore((state) => state.gridSize);
  const toggleSnap = useUiStore((state) => state.toggleSnap);
  const toggleBrowser = useUiStore((state) => state.toggleBrowser);
  const toggleProperties = useUiStore((state) => state.toggleProperties);
  const regen = useRegenerated();

  const errors = Object.values(regen.status).filter((s) => s.status === 'error').length;
  const warnings = Object.values(regen.status).filter((s) => s.status === 'warning').length;

  return (
    <footer className="flex items-center gap-3 border-t border-line bg-ink-850 px-3 text-2xs text-slate-500">
      <button className="text-3xs hover:text-slate-200" onClick={toggleBrowser} title="Toggle the browser panel">
        Browser
      </button>
      <button className="text-3xs hover:text-slate-200" onClick={toggleProperties} title="Toggle the properties panel">
        Properties
      </button>
      <span className="h-3 w-px bg-line" />
      <span className="truncate text-slate-300">{describe(selection, design)}</span>
      <span className="h-3 w-px bg-line" />
      <span className="truncate">
        {hovered?.face
          ? `Hover · ${hovered.face.area.toFixed(1)} mm² · n ${hovered.face.normal.x.toFixed(2)}, ${hovered.face.normal.y.toFixed(2)}, ${hovered.face.normal.z.toFixed(2)}`
          : 'Hover geometry to preview the selection'}
      </span>
      <span className="ml-auto flex items-center gap-3">
        <span className="num">{units}</span>
        <span>Grid {gridSize} mm</span>
        <button className={snapToGrid ? 'text-accent' : ''} onClick={toggleSnap} title="Toggle grid snapping">
          {snapToGrid ? 'Snap on' : 'Snap off'}
        </button>
        {errors ? (
          <span className="flex items-center gap-1 text-red-300">
            <AlertTriangle size={11} /> {errors} error{errors > 1 ? 's' : ''}
          </span>
        ) : warnings ? (
          <span className="flex items-center gap-1 text-warn">
            <AlertTriangle size={11} /> {warnings} warning{warnings > 1 ? 's' : ''}
          </span>
        ) : (
          <span>Model up to date</span>
        )}
        <span className="rounded-full border border-line px-2 text-slate-600">Mock kernel</span>
      </span>
    </footer>
  );
}
