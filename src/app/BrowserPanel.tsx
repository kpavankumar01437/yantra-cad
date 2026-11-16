import { useState, type ReactNode } from 'react';
import { useDesign, useRegenerated } from '../store/designStore';
import type { Doc, PlaneId, SelectionKind, TimelineEntry } from '../types';
import { fmt } from './format';
import { ChevronIcon, EyeIcon, FeatureIcon, Icon, SketchIcon } from './icons';

type RowProps = {
  depth: number;
  icon: ReactNode;
  label: string;
  active?: boolean;
  suppressed?: boolean;
  status?: 'ok' | 'warning' | 'error';
  statusText?: string;
  onSelect?: () => void;
  onDoubleClick?: () => void;
  onToggleVisible?: () => void;
  visible?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  title?: string;
};

function Row({
  depth,
  icon,
  label,
  active,
  suppressed,
  status,
  statusText,
  onSelect,
  onDoubleClick,
  onToggleVisible,
  visible = true,
  expandable,
  expanded,
  onToggleExpand,
  title,
}: RowProps) {
  return (
    <div
      className={`tree-row ${active ? 'active' : ''} ${suppressed ? 'suppressed' : ''}`}
      style={{ paddingLeft: 4 + depth * 13 }}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      title={title ?? (suppressed ? `${label} — rolled back` : label)}
    >
      {expandable ? (
        <button
          className="tree-caret"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand?.();
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronIcon open={expanded} />
        </button>
      ) : (
        <span className="tree-caret-spacer" />
      )}
      <span className="tree-icon">{icon}</span>
      <span className="tree-label">{label}</span>
      {status && status !== 'ok' ? <span className={`dot ${status}`} title={statusText ?? status} /> : null}
      {onToggleVisible ? (
        <button
          className="tree-eye"
          onClick={(event) => {
            event.stopPropagation();
            onToggleVisible();
          }}
          aria-label={visible ? 'Hide' : 'Show'}
          title={visible ? 'Hide' : 'Show'}
        >
          <EyeIcon off={!visible} />
        </button>
      ) : null}
    </div>
  );
}

function SectionHeader({
  label,
  icon,
  open,
  onToggle,
  count,
}: {
  label: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  count?: number;
}) {
  return (
    <button className="section-head" onClick={onToggle}>
      <ChevronIcon open={open} />
      <span className="tree-icon">{icon}</span>
      <span>{label}</span>
      {count !== undefined ? <span className="section-count">{count}</span> : null}
    </button>
  );
}

function entryComponentId(doc: Doc, entry: TimelineEntry): string | undefined {
  if (entry.type === 'sketch') return doc.sketches.find((s) => s.id === entry.refId)?.componentId;
  return doc.features.find((f) => f.id === entry.refId)?.componentId;
}

export function BrowserPanel() {
  const doc = useDesign((s) => s.doc);
  const regen = useRegenerated();
  const selection = useDesign((s) => s.selection);
  const select = useDesign((s) => s.select);
  const toggleBody = useDesign((s) => s.toggleBody);
  const toggleComponent = useDesign((s) => s.toggleComponent);
  const startCommand = useDesign((s) => s.startCommand);

  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    origin: false,
    joints: false,
    params: true,
    c_root: true,
    c_plate: true,
    c_boss: true,
  });

  const toggle = (key: string) => setOpen((current) => ({ ...current, [key]: !current[key] }));
  const isSelected = (kind: SelectionKind, id: string) =>
    selection.some((item) => item.kind === kind && item.id === id);

  const componentName = (id: string) => doc.components.find((c) => c.id === id)?.name ?? '—';
  const root = doc.components.find((c) => c.parentId === null) ?? doc.components[0];
  const errorCount = Object.values(regen.status).filter((s) => s.status === 'error').length;
  const activeCount = Math.min(doc.rollback, doc.timeline.length);

  const renderComponent = (componentId: string, depth: number): ReactNode => {
    const component = doc.components.find((c) => c.id === componentId);
    if (!component) return null;
    const key = `comp_${component.id}`;
    const expanded = open[component.id] ?? depth < 1;
    const children = doc.components.filter((c) => c.parentId === componentId);
    const bodies = doc.bodies.filter((b) => b.componentId === componentId);
    const entries = doc.timeline
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entryComponentId(doc, entry) === componentId);

    return (
      <div key={key}>
        <Row
          depth={depth}
          icon={<Icon.Layers />}
          label={component.name}
          active={isSelected('component', component.id)}
          onSelect={() => select({ kind: 'component', id: component.id })}
          onToggleVisible={() => toggleComponent(component.id)}
          visible={component.visible}
          expandable
          expanded={expanded}
          onToggleExpand={() => toggle(component.id)}
        />
        {expanded ? (
          <>
            {bodies.map((body) => {
              const feature = doc.features.find((f) => f.id === body.featureId);
              const status = feature ? regen.status[feature.id] : undefined;
              return (
                <Row
                  key={body.id}
                  depth={depth + 1}
                  icon={<Icon.Body />}
                  label={body.name}
                  active={isSelected('body', body.id)}
                  onSelect={() => select({ kind: 'body', id: body.id })}
                  onToggleVisible={() => toggleBody(body.id)}
                  visible={body.visible}
                  status={status?.status}
                  statusText={status?.message}
                />
              );
            })}
            {entries.map(({ entry, index }) => {
              const suppressed = index >= doc.rollback;
              if (entry.type === 'sketch') {
                const sketch = doc.sketches.find((s) => s.id === entry.refId);
                if (!sketch) return null;
                return (
                  <Row
                    key={entry.id}
                    depth={depth + 1}
                    icon={<SketchIcon />}
                    label={sketch.name}
                    active={isSelected('sketch', sketch.id)}
                    suppressed={suppressed}
                    onSelect={() => select({ kind: 'sketch', id: sketch.id })}
                  />
                );
              }
              const feature = doc.features.find((f) => f.id === entry.refId);
              if (!feature) return null;
              const status = regen.status[feature.id];
              return (
                <Row
                  key={entry.id}
                  depth={depth + 1}
                  icon={<FeatureIcon kind={feature.kind} />}
                  label={feature.name}
                  active={isSelected('feature', feature.id)}
                  suppressed={suppressed}
                  status={status?.status}
                  statusText={status?.message}
                  onSelect={() => select({ kind: 'feature', id: feature.id })}
                  onDoubleClick={() => startCommand(feature.kind, feature.id)}
                />
              );
            })}
            {children.map((child) => renderComponent(child.id, depth + 1))}
          </>
        ) : null}
      </div>
    );
  };

  const matches = query.trim()
    ? [
        ...doc.components
          .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
          .map((c) => ({ kind: 'component' as SelectionKind, id: c.id, label: c.name })),
        ...doc.bodies
          .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
          .map((b) => ({
            kind: 'body' as SelectionKind,
            id: b.id,
            label: `${b.name} · ${componentName(b.componentId)}`,
          })),
        ...doc.sketches
          .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
          .map((s) => ({ kind: 'sketch' as SelectionKind, id: s.id, label: `${s.name} · ${s.plane}` })),
        ...doc.features
          .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
          .map((f) => ({ kind: 'feature' as SelectionKind, id: f.id, label: f.name })),
        ...doc.parameters
          .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
          .map((p) => ({ kind: 'parameter' as SelectionKind, id: p.id, label: p.name })),
      ]
    : [];

  return (
    <aside className={`panel browser ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="panel-head">
        <button
          className="icon-btn tiny"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Expand the Browser' : 'Collapse the Browser'}
        >
          <ChevronIcon open={!collapsed} />
        </button>
        <span className="panel-title">Browser</span>
        {errorCount > 0 ? (
          <span className="panel-badge error" title={`${errorCount} feature error(s)`}>
            {errorCount}
          </span>
        ) : null}
        <span className="panel-count">{doc.bodies.length} bodies</span>
      </div>

      {collapsed ? null : (
        <>
          <div className="panel-search">
            <input
              className="field"
              placeholder="Search components, sketches, features"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="tree">
            {query.trim() ? (
              matches.length ? (
                matches.map((match) => (
                  <Row
                    key={`${match.kind}_${match.id}`}
                    depth={0}
                    icon={
                      match.kind === 'body' ? (
                        <Icon.Body />
                      ) : match.kind === 'sketch' ? (
                        <SketchIcon />
                      ) : match.kind === 'parameter' ? (
                        <Icon.Parameter />
                      ) : (
                        <Icon.Layers />
                      )
                    }
                    label={match.label}
                    active={isSelected(match.kind, match.id)}
                    onSelect={() => select({ kind: match.kind, id: match.id })}
                  />
                ))
              ) : (
                <div className="tree-empty">No matches</div>
              )
            ) : (
              <>
                <Row depth={0} icon={<Icon.Cube />} label={`Design: ${doc.name}`} title="Document root" />

                <SectionHeader
                  label="Origin"
                  icon={<Icon.Plane />}
                  open={open.origin ?? false}
                  onToggle={() => toggle('origin')}
                />
                {open.origin ? (
                  <>
                    {(['XY', 'XZ', 'YZ'] as PlaneId[]).map((plane) => (
                      <Row
                        key={plane}
                        depth={1}
                        icon={<Icon.Plane />}
                        label={`${plane} Plane`}
                        active={isSelected('plane', plane)}
                        onSelect={() => select({ kind: 'plane', id: plane })}
                      />
                    ))}
                    {['X Axis', 'Y Axis', 'Z Axis'].map((axis) => (
                      <Row key={axis} depth={1} icon={<span className="axis-dot" />} label={axis} title="Reference axis" />
                    ))}
                  </>
                ) : null}

                <SectionHeader
                  label="Components"
                  icon={<Icon.Layers />}
                  open={open.c_root ?? true}
                  onToggle={() => toggle('c_root')}
                  count={doc.components.length}
                />
                {open.c_root !== false && root ? renderComponent(root.id, 0) : null}

                <SectionHeader
                  label="Joints"
                  icon={<Icon.Joint />}
                  open={open.joints ?? false}
                  onToggle={() => toggle('joints')}
                  count={doc.joints.length}
                />
                {open.joints
                  ? doc.joints.map((joint) => (
                      <Row
                        key={joint.id}
                        depth={1}
                        icon={<Icon.Joint />}
                        label={joint.name}
                        active={isSelected('joint', joint.id)}
                        onSelect={() => select({ kind: 'joint', id: joint.id })}
                        title={`${joint.type} joint`}
                      />
                    ))
                  : null}

                <SectionHeader
                  label="Parameters"
                  icon={<Icon.Parameter />}
                  open={open.params ?? true}
                  onToggle={() => toggle('params')}
                  count={doc.parameters.length}
                />
                {open.params
                  ? doc.parameters.map((parameter) => (
                      <Row
                        key={parameter.id}
                        depth={1}
                        icon={<Icon.Parameter />}
                        label={`${parameter.name} = ${fmt(regen.paramValues[parameter.name])} mm`}
                        active={isSelected('parameter', parameter.id)}
                        onSelect={() => select({ kind: 'parameter', id: parameter.id })}
                        status={regen.paramErrors[parameter.id] ? 'error' : undefined}
                        statusText={regen.paramErrors[parameter.id]}
                      />
                    ))
                  : null}

                {activeCount < doc.timeline.length ? (
                  <div className="tree-note">
                    Rolled back: {activeCount} of {doc.timeline.length} timeline entries are active.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
