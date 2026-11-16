import { useEffect, useRef } from 'react';
import { deleteSelection, toggleBodyVisibility, toggleComponentVisibility, toggleFeatureSuppressed } from '../services/actions';
import { redo, startCommand, undo } from '../services/commands';
import { useDesignStore } from '../stores/designStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';

type Item = { label: string; run: () => void; danger?: boolean; hint?: string; divider?: boolean };

/** Right-click menu shared by the canvas, browser and timeline. */
export function ContextMenu() {
  const menu = useUiStore((state) => state.contextMenu);
  const close = useUiStore((state) => state.closeContextMenu);
  const setDialog = useUiStore((state) => state.setDialog);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu, close]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, close]);

  if (!menu) return null;
  const design = useDesignStore.getState().design;
  const target = menu.target;
  const items: Item[] = [];

  const rename = (kind: 'body' | 'feature' | 'sketch' | 'component' | 'parameter', id: string, value: string) =>
    setDialog({ kind: 'rename', target: { kind, id }, value });

  if (target?.kind === 'body') {
    const body = design.bodies.find((b) => b.id === target.id);
    if (body) {
      items.push(
        { label: body.visible ? 'Hide body' : 'Show body', run: () => toggleBodyVisibility(body.id) },
        { label: 'Rename body', run: () => rename('body', body.id, body.name), hint: 'F2' },
        { label: 'Edit material in Properties', run: () => useSelectionStore.getState().select({ kind: 'body', id: body.id }), divider: true },
        { label: 'Delete body', run: () => deleteSelection([{ kind: 'body', id: body.id }]), danger: true },
      );
    }
  } else if (target?.kind === 'feature') {
    const feature = design.features.find((f) => f.id === target.id);
    if (feature) {
      items.push(
        { label: 'Edit feature', run: () => startCommand(feature.kind, feature.id) },
        { label: 'Rename feature', run: () => rename('feature', feature.id, feature.name) },
        { label: feature.suppressed ? 'Unsuppress' : 'Suppress', run: () => toggleFeatureSuppressed(feature.id) },
        { label: 'Delete feature', run: () => deleteSelection([{ kind: 'feature', id: feature.id }]), danger: true, divider: true },
      );
    }
  } else if (target?.kind === 'sketch') {
    const sketch = design.sketches.find((s) => s.id === target.id);
    if (sketch) {
      items.push(
        { label: 'Edit sketch', run: () => useUiStore.getState().startSketchSession(sketch.id) },
        { label: 'Extrude sketch', run: () => startCommand('extrude') },
        { label: 'Rename sketch', run: () => rename('sketch', sketch.id, sketch.name) },
        { label: 'Delete sketch', run: () => deleteSelection([{ kind: 'sketch', id: sketch.id }]), danger: true, divider: true },
      );
    }
  } else if (target?.kind === 'component') {
    const component = design.components.find((c) => c.id === target.id);
    if (component) {
      items.push(
        { label: component.visible ? 'Hide component' : 'Show component', run: () => toggleComponentVisibility(component.id) },
        { label: 'Rename component', run: () => rename('component', component.id, component.name) },
        ...(component.parentId === null
          ? []
          : [{ label: 'Delete component', run: () => deleteSelection([{ kind: 'component', id: component.id }]), danger: true, divider: true }]),
      );
    }
  } else if (target?.kind === 'parameter') {
    const parameter = design.parameters.find((p) => p.id === target.id);
    if (parameter) {
      items.push(
        { label: 'Rename parameter', run: () => rename('parameter', parameter.id, parameter.name) },
        { label: 'Delete parameter', run: () => deleteSelection([{ kind: 'parameter', id: parameter.id }]), danger: true },
      );
    }
  } else if (target?.kind === 'timeline') {
    items.push(
      { label: 'Roll back to here', run: () => useUiStore.getState().notify('Use the timeline markers to roll back', 'info') },
      { label: 'Undo', run: undo },
      { label: 'Redo', run: redo },
    );
  } else {
    items.push(
      { label: 'New sketch', run: () => startCommand('newSketch') },
      { label: 'Extrude', run: () => startCommand('extrude') },
      { label: 'Fit to view', run: () => window.dispatchEvent(new CustomEvent('yantra:fit')) },
      { label: 'Clear selection', run: () => useSelectionStore.getState().clear(), divider: true },
    );
  }

  const style = {
    left: Math.min(menu.x, window.innerWidth - 220),
    top: Math.min(menu.y, window.innerHeight - 40 - items.length * 26),
  };

  return (
    <div ref={ref} className="menu fixed z-50 w-[208px] py-1" style={style} onContextMenu={(event) => event.preventDefault()}>
      {items.map((item, index) => (
        <div key={`${item.label}_${index}`}>
          {item.divider ? <div className="my-1 h-px bg-line" /> : null}
          <button
            className={`flex w-full items-center justify-between px-2.5 py-[5px] text-left text-xs hover:bg-ink-750 ${
              item.danger ? 'text-red-300' : 'text-slate-300'
            }`}
            onClick={() => {
              item.run();
              close();
            }}
          >
            <span>{item.label}</span>
            {item.hint ? <span className="text-3xs text-slate-600">{item.hint}</span> : null}
          </button>
        </div>
      ))}
    </div>
  );
}
