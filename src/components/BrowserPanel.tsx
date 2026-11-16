import {
  Box,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Component,
  Eye,
  EyeOff,
  Layers,
  Link2,
  PenTool,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { deleteSelection, toggleBodyVisibility, toggleComponentVisibility } from '../services/actions';
import { useRegenerated } from '../services/geometry';
import { useDesignStore } from '../stores/designStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore, type ContextTarget } from '../stores/uiStore';
import type { Design, Selection, TimelineEntry } from '../types';

type RowProps = {
  depth: number;
  icon: ReactNode;
  label: string;
  selection: Selection;
  muted?: boolean;
  status?: 'ok' | 'warning' | 'error' | 'suppressed';
  statusText?: string;
  trailing?: ReactNode;
  onDoubleClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
};

function Row({ depth, icon, label, selection, muted, status, statusText, trailing, onDoubleClick, onContextMenu }: RowProps) {
  const selectionState = useSelectionStore((s) => s.selection);
  const hovered = useSelectionStore((s) => s.hovered);
  const select = useSelectionStore((s) => s.select);
  const active = selectionState.some(
    (item) =>
      (item.kind === selection.kind && item.id === selection.id) ||
      (selection.kind === 'body' && item.bodyId === selection.id),
  );
  const isHovered = hovered ? hovered.kind === selection.kind || hovered.id === selection.id : false;

  return (
    <div
      className={`group flex h-[22px] cursor-default items-center gap-1.5 rounded-sm pr-1 ${
        active ? 'row-active' : isHovered ? 'bg-ink-800' : ''
      } hover:bg-ink-800`}
      style={{ paddingLeft: 6 + depth * 12 }}
      onClick={(event) => {
        if (event.shiftKey) select(selection, 'remove');
        else if (event.ctrlKey || event.metaKey) select(selection, 'add');
        else select(selection);
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      title={statusText ?? label}
    >
      <span className={`grid h-3.5 w-3.5 flex-none place-items-center ${active ? 'text-accent' : 'text-slate-500'}`}>{icon}</span>
      <span className={`flex-1 truncate text-xs ${muted ? 'italic text-slate-600' : 'text-slate-300'}`}>{label}</span>
      {status && status !== 'ok' ? (
        <span
          className={`h-1.5 w-1.5 flex-none rounded-full ${
            status === 'error' ? 'bg-danger' : status === 'warning' ? 'bg-warn' : 'bg-slate-600'
          }`}
        />
      ) : null}
      {trailing}
    </div>
  );
}

function Section({ label, count, children, defaultOpen = true, icon }: { label: string; count?: number; children: ReactNode; defaultOpen?: boolean; icon?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        className="mt-1.5 flex h-6 w-full items-center gap-1.5 px-1.5 text-3xs uppercase tracking-[0.08em] text-slate-500 hover:text-slate-300"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {icon}
        <span>{label}</span>
        {count !== undefined ? <span className="ml-auto text-slate-600">{count}</span> : null}
      </button>
      {open ? <div className="pb-1">{children}</div> : null}
    </div>
  );
}

function entryComponentId(design: Design, entry: TimelineEntry): string | undefined {
  if (entry.type === 'sketch') return design.sketches.find((s) => s.id === entry.refId)?.componentId;
  return design.features.find((f) => f.id === entry.refId)?.componentId;
}

export function BrowserPanel() {
  const design = useDesignStore((state) => state.design);
  const regen = useRegenerated();
  const setDialog = useUiStore((state) => state.setDialog);
  const openMenu = useUiStore((state) => state.openContextMenu);
  const toggleBrowser = useUiStore((state) => state.toggleBrowser);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ c_root: true, c_plate: true, c_boss: true, c_wall: true });

  const toggle = (key: string) => setExpanded((current) => ({ ...current, [key]: !(current[key] ?? true) }));
  const isOpen = (key: string, fallback = true) => expanded[key] ?? fallback;
  const componentName = (id: string) => design.components.find((c) => c.id === id)?.name ?? '—';
  const root = design.components.find((c) => c.parentId === null);

  const menu = (event: React.MouseEvent, target: ContextTarget) => {
    event.preventDefault();
    event.stopPropagation();
    openMenu(event.clientX, event.clientY, target);
  };

  const renderEntries = (componentId: string, depth: number) =>
    design.timeline
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entryComponentId(design, entry) === componentId)
      .map(({ entry, index }) => {
        const suppressed = index >= design.rollback;
        if (entry.type === 'sketch') {
          const sketch = design.sketches.find((s) => s.id === entry.refId);
          if (!sketch) return null;
          return (
            <Row
              key={entry.id}
              depth={depth}
              icon={<PenTool size={12} />}
              label={sketch.name}
              selection={{ kind: 'sketch', id: sketch.id }}
              muted={suppressed}
              onDoubleClick={() => setDialog({ kind: 'rename', target: { kind: 'sketch', id: sketch.id }, value: sketch.name })}
              onContextMenu={(event) => menu(event, { kind: 'sketch', id: sketch.id })}
            />
          );
        }
        const feature = design.features.find((f) => f.id === entry.refId);
        if (!feature) return null;
        const status = regen.status[feature.id];
        return (
          <Row
            key={entry.id}
            depth={depth}
            icon={<Settings2 size={12} />}
            label={feature.name}
            selection={{ kind: 'feature', id: feature.id }}
            muted={suppressed || feature.suppressed}
            status={status?.status === 'error' ? 'error' : status?.status === 'warning' ? 'warning' : 'ok'}
            statusText={status?.message}
            onDoubleClick={() => setDialog({ kind: 'rename', target: { kind: 'feature', id: feature.id }, value: feature.name })}
            onContextMenu={(event) => menu(event, { kind: 'feature', id: feature.id })}
          />
        );
      });

  const renderComponent = (componentId: string, depth: number): ReactNode => {
    const component = design.components.find((c) => c.id === componentId);
    if (!component) return null;
    const open = isOpen(component.id);
    const bodies = design.bodies.filter((b) => b.componentId === componentId);
    const children = design.components.filter((c) => c.parentId === componentId);

    return (
      <div key={component.id}>
        <div className="flex items-center" style={{ paddingLeft: 2 + depth * 12 }}>
          <button className="icon-btn-sm flex-none" onClick={() => toggle(component.id)} aria-label="Expand component">
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          <div className="min-w-0 flex-1">
            <Row
              depth={0}
              icon={<Component size={12} />}
              label={component.name}
              selection={{ kind: 'component', id: component.id }}
              onDoubleClick={() => setDialog({ kind: 'rename', target: { kind: 'component', id: component.id }, value: component.name })}
              onContextMenu={(event) => menu(event, { kind: 'component', id: component.id })}
              trailing={
                <button
                  className="invisible text-slate-500 hover:text-slate-200 group-hover:visible"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleComponentVisibility(component.id);
                  }}
                  title={component.visible ? 'Hide component' : 'Show component'}
                >
                  {component.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
              }
            />
          </div>
        </div>
        {open ? (
          <>
            {bodies.map((body) => {
              const feature = design.features.find((f) => f.id === body.featureId);
              const status = feature ? regen.status[feature.id] : undefined;
              return (
                <Row
                  key={body.id}
                  depth={depth + 1}
                  icon={<Box size={12} />}
                  label={body.name}
                  selection={{ kind: 'body', id: body.id }}
                  status={status?.status === 'error' ? 'error' : status?.status === 'warning' ? 'warning' : 'ok'}
                  statusText={status?.message}
                  onDoubleClick={() => setDialog({ kind: 'rename', target: { kind: 'body', id: body.id }, value: body.name })}
                  onContextMenu={(event) => menu(event, { kind: 'body', id: body.id })}
                  trailing={
                    <button
                      className="invisible text-slate-500 hover:text-slate-200 group-hover:visible"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleBodyVisibility(body.id);
                      }}
                      title={body.visible ? 'Hide body' : 'Show body'}
                    >
                      {body.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                  }
                />
              );
            })}
            {renderEntries(componentId, depth + 1)}
            {children.map((child) => renderComponent(child.id, depth + 1))}
          </>
        ) : null}
      </div>
    );
  };

  const matches = query.trim()
    ? [
        ...design.bodies.map((b) => ({ label: `${componentName(b.componentId)} / ${b.name}`, selection: { kind: 'body' as const, id: b.id } })),
        ...design.sketches.map((s) => ({ label: s.name, selection: { kind: 'sketch' as const, id: s.id } })),
        ...design.features.map((f) => ({ label: `${f.name} · ${f.kind}`, selection: { kind: 'feature' as const, id: f.id } })),
        ...design.parameters.map((p) => ({ label: p.name, selection: { kind: 'parameter' as const, id: p.id } })),
      ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <aside className="panel w-[300px] flex-none border-r border-line max-[900px]:hidden">
      <div className="panel-head">
        <span className="panel-title">Browser</span>
        <span className="ml-auto text-3xs text-slate-600">{design.bodies.length} bodies</span>
        <button className="icon-btn-sm" title="Hide browser" onClick={toggleBrowser}>
          <X size={12} />
        </button>
      </div>

      <div className="border-b border-line p-1.5">
        <label className="flex items-center gap-1.5 rounded border border-line bg-ink-900 px-1.5">
          <Search size={11} className="text-slate-600" />
          <input
            className="w-full border-0 bg-transparent py-1 text-xs outline-none"
            placeholder="Search the design"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1">
        {query.trim() ? (
          matches.length ? (
            matches.map((match) => (
              <Row
                key={`${match.selection.kind}_${match.selection.id}`}
                depth={0}
                icon={<Box size={12} />}
                label={match.label}
                selection={match.selection}
              />
            ))
          ) : (
            <div className="p-2 text-2xs text-slate-600">No matches</div>
          )
        ) : (
          <>
            <Row depth={0} icon={<Layers size={13} />} label={`Design: ${design.name}`} selection={{ kind: 'component', id: root?.id ?? '' }} />

            <Section label="Origin" icon={<CircleDot size={11} />} defaultOpen={false}>
              {(['XY', 'XZ', 'YZ'] as const).map((plane) => (
                <Row key={plane} depth={1} icon={<CircleDot size={11} />} label={`${plane} Plane`} selection={{ kind: 'plane', id: plane }} />
              ))}
              {['X Axis', 'Y Axis', 'Z Axis'].map((axis) => (
                <Row
                  key={axis}
                  depth={1}
                  icon={<span className="block h-1.5 w-1.5 rounded-full bg-ink-600" />}
                  label={axis}
                  selection={{ kind: 'plane', id: axis }}
                  muted
                />
              ))}
            </Section>

            <Section label="Components" count={design.components.length - 1} icon={<Component size={11} />}>
              {root ? renderComponent(root.id, 0) : null}
            </Section>

            <Section label="Joints" count={design.joints.length} icon={<Link2 size={11} />} defaultOpen={false}>
              {design.joints.map((joint) => (
                <Row
                  key={joint.id}
                  depth={1}
                  icon={<Link2 size={11} />}
                  label={`${joint.name} · ${joint.type}`}
                  selection={{ kind: 'joint', id: joint.id }}
                />
              ))}
            </Section>

            <Section label="Parameters" count={design.parameters.length} icon={<Settings2 size={11} />}>
              {design.parameters.map((parameter) => (
                <Row
                  key={parameter.id}
                  depth={1}
                  icon={<Settings2 size={11} />}
                  label={`${parameter.name} = ${(regen.paramValues[parameter.name] ?? 0).toFixed(2)} mm`}
                  selection={{ kind: 'parameter', id: parameter.id }}
                  status={regen.paramErrors[parameter.id] ? 'error' : 'ok'}
                  statusText={regen.paramErrors[parameter.id]}
                  onDoubleClick={() => setDialog({ kind: 'rename', target: { kind: 'parameter', id: parameter.id }, value: parameter.name })}
                  onContextMenu={(event) => menu(event, { kind: 'parameter', id: parameter.id })}
                />
              ))}
            </Section>

            {design.rollback < design.timeline.length ? (
              <div className="mx-1 mt-2 rounded border border-line bg-ink-850 p-1.5 text-2xs text-slate-500">
                Rolled back: {design.rollback} of {design.timeline.length} timeline entries are active.
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-none items-center gap-1 border-t border-line px-2 py-1 text-3xs text-slate-600">
        <button
          className="hover:text-slate-300"
          onClick={() => {
            if (useSelectionStore.getState().selection.length) deleteSelection(useSelectionStore.getState().selection);
          }}
          title="Delete selection (Del)"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9" />
          </svg>
        </button>
        <span>Right-click for rename, suppress, delete</span>
      </div>
    </aside>
  );
}
