import { ChevronRight, Eye, EyeOff, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { measureDimension, sketchDof } from '../model/sketch';
import {
  addParameter,
  deleteSelection,
  deleteSketchEntity,
  removeConstraint,
  setBodyMaterial,
  setComponentMaterial,
  setComponentTransform,
  setDimensionExpression,
  setFeatureExpression,
  setParameterExpression,
  toggleBodyVisibility,
  toggleComponentVisibility,
  toggleFeatureSuppressed,
} from '../services/actions';
import { startCommand } from '../services/commands';
import { useBodyMetrics, useRegenerated } from '../services/geometry';
import { useDesignStore } from '../stores/designStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';
import type { Body, Component, Design, Feature, Joint, Parameter, Selection, Sketch } from '../types';

/* ------------------------------- primitives ------------------------------- */

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-b border-line/70 px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="label">{title}</span>
        {action}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-2xs">
      <span className="text-slate-500">{k}</span>
      <span className={`text-right text-slate-300 ${mono ? 'num' : ''}`}>{v}</span>
    </div>
  );
}

/** Expression-aware number field: commits on Enter or blur. */
function ExprField({
  value,
  unit,
  onCommit,
  label,
}: {
  value: string;
  unit?: string;
  onCommit: (next: string) => string | null;
  label: string;
}) {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const commit = () => {
    setEditing(false);
    if (text === value) {
      setError(null);
      return;
    }
    const message = onCommit(text);
    setError(message);
    if (message) setText(value);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="w-[104px] flex-none truncate text-2xs text-slate-500" title={label}>
          {label}
        </span>
        <div className={`flex flex-1 items-center rounded border bg-ink-900 ${error ? 'border-danger/70' : editing ? 'border-accent/70' : 'border-line'}`}>
          <input
            className="num w-full border-0 bg-transparent px-1.5 py-0.5 text-right text-2xs text-slate-200 outline-none"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
                (event.target as HTMLInputElement).blur();
              }
              if (event.key === 'Escape') {
                setText(value);
                setEditing(false);
                (event.target as HTMLInputElement).blur();
              }
            }}
          />
          {unit ? <span className="pr-1.5 text-3xs text-slate-600">{unit}</span> : null}
        </div>
      </div>
      {error ? <div className="mt-0.5 pl-[110px] text-3xs text-red-300">{error}</div> : null}
    </div>
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1 pt-0.5">{children}</div>;
}

function SmallButton({ children, onClick, danger, disabled }: { children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      className={`btn h-6 px-2 text-3xs ${danger ? 'hover:border-danger/60 hover:text-red-300' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (next: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-2xs">
      <span className="text-slate-500">{label}</span>
      <select className="input h-6 w-[150px] py-0 text-2xs" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/* --------------------------------- panels --------------------------------- */

function BodyDetails({ body, design, selection }: { body: Body; design: Design; selection: Selection[] }) {
  const regen = useRegenerated();
  const metrics = useBodyMetrics(regen.bodies[body.id]?.spec);
  const component = design.components.find((c) => c.id === body.componentId);
  const feature = design.features.find((f) => f.id === body.featureId);
  const rotated = selection[0]?.kind === 'face' || selection[0]?.kind === 'edge';

  return (
    <>
      <Section
        title="Body"
        action={
          <button className="icon-btn-sm" title={body.visible ? 'Hide body' : 'Show body'} onClick={() => toggleBodyVisibility(body.id)}>
            {body.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        }
      >
        <KV k="Name" v={body.name} mono={false} />
        <KV k="Component" v={component?.name ?? '—'} mono={false} />
        <KV k="Parent feature" v={feature?.name ?? '—'} mono={false} />
        <KV k="Visibility" v={body.visible ? 'Visible' : 'Hidden'} mono={false} />
        <KV k="Geometry" v={metrics ? `${metrics.triangles} triangles` : 'No solid'} />
      </Section>

      <Section title="Physical properties">
        <KV k="Volume" v={metrics ? `${metrics.volume.toFixed(1)} mm³` : '—'} />
        <KV k="Surface area" v={metrics ? `${metrics.area.toFixed(1)} mm²` : '—'} />
        <KV k="Bounding box" v={metrics ? metrics.size.map((n) => n.toFixed(1)).join(' × ') + ' mm' : '—'} />
        <KV k="Kernel" v="Mock prismatic solid" mono={false} />
      </Section>

      <Section title="Appearance">
        <SelectField
          label="Material"
          value={body.material}
          options={['Steel satin', 'Aluminium', 'Default']}
          onChange={(value) => setBodyMaterial(body.id, value)}
        />
        {component ? <KV k="Inherited from" v={component.name} mono={false} /> : null}
      </Section>

      {rotated ? (
        <Section title="Sub-selection">
          <p className="text-2xs text-slate-500">Face and edge picks are shown above. Select the body entry to see solid metrics.</p>
        </Section>
      ) : null}

      <Section title="Actions">
        <ActionRow>
          <SmallButton onClick={() => startCommand('fillet')}>Fillet</SmallButton>
          <SmallButton onClick={() => startCommand('shell')}>Shell</SmallButton>
          <SmallButton onClick={() => startCommand('move')}>Move</SmallButton>
          <SmallButton danger onClick={() => deleteSelection([{ kind: 'body', id: body.id }])}>
            Delete
          </SmallButton>
        </ActionRow>
      </Section>
    </>
  );
}

function SketchDetails({ sketch }: { sketch: Sketch }) {
  const design = useDesignStore((state) => state.design);
  const regen = useRegenerated();
  const startSession = useUiStore((state) => state.startSketchSession);
  const setDialog = useUiStore((state) => state.setDialog);
  const dof = sketchDof(sketch);
  const component = design.components.find((c) => c.id === sketch.componentId);
  const usedBy = design.features.filter((f) => f.kind === 'extrude' && f.sketchId === sketch.id);

  return (
    <>
      <Section
        title="Sketch"
        action={
          <button
            className="icon-btn-sm"
            title="Rename sketch"
            onClick={() => setDialog({ kind: 'rename', target: { kind: 'sketch', id: sketch.id }, value: sketch.name })}
          >
            <ChevronRight size={12} />
          </button>
        }
      >
        <KV k="Name" v={sketch.name} mono={false} />
        <KV k="Plane" v={`${sketch.plane} plane`} />
        <KV k="Component" v={component?.name ?? '—'} mono={false} />
        <KV k="Entities" v={sketch.entities.length} />
        <KV k="Dimensions" v={sketch.dimensions.length} />
        <KV k="Constraints" v={sketch.constraints.length} />
      </Section>

      <Section title="Constraint state">
        <div
          className={`rounded border px-2 py-1.5 text-2xs ${
            dof.fullyConstrained
              ? 'border-ok/40 bg-ok/10 text-emerald-200'
              : dof.overConstrained
                ? 'border-danger/40 bg-danger/10 text-red-200'
                : 'border-warn/40 bg-warn/10 text-amber-200'
          }`}
        >
          {dof.fullyConstrained
            ? 'Fully constrained'
            : dof.overConstrained
              ? 'Over-constrained — remove a constraint or dimension'
              : `${dof.dof} degree${dof.dof === 1 ? '' : 's'} of freedom`}
          <div className="mt-0.5 text-3xs opacity-70">
            {dof.equations} equations / {dof.variables} variables
          </div>
        </div>
        <ActionRow>
          <SmallButton onClick={() => startSession(sketch.id)}>Edit sketch</SmallButton>
          <SmallButton onClick={() => startCommand('extrude')}>Extrude</SmallButton>
          <SmallButton danger onClick={() => deleteSelection([{ kind: 'sketch', id: sketch.id }])}>
            Delete
          </SmallButton>
        </ActionRow>
      </Section>

      <Section title={`Entities (${sketch.entities.length})`}>
        {sketch.entities.length === 0 ? (
          <p className="text-2xs text-slate-500">Empty sketch — open the Sketch workspace and draw a closed profile.</p>
        ) : (
          sketch.entities.map((entity) => (
            <div key={entity.id} className="flex items-center gap-1.5 text-2xs">
              <button
                className="flex flex-1 items-center justify-between gap-2 rounded border border-transparent px-1 py-0.5 text-left hover:border-line hover:bg-ink-800"
                onClick={() => useSelectionStore.getState().select({ kind: 'sketchEntity', id: entity.id, subId: sketch.id, label: entity.kind })}
              >
                <span className="truncate text-slate-300">{entity.kind}</span>
                <span className="num text-3xs text-slate-600">
                  {entity.kind === 'circle'
                    ? `r ${entity.r.toFixed(1)}`
                    : entity.kind === 'rect'
                      ? `${Math.abs(entity.b.x - entity.a.x).toFixed(1)}×${Math.abs(entity.b.y - entity.a.y).toFixed(1)}`
                      : entity.kind === 'line'
                        ? `${Math.hypot(entity.b.x - entity.a.x, entity.b.y - entity.a.y).toFixed(1)}`
                        : `${entity.points.length} pts`}
                </span>
              </button>
              <button className="text-slate-600 hover:text-red-300" title="Delete entity" onClick={() => deleteSketchEntity(sketch.id, entity.id)}>
                <X size={11} />
              </button>
            </div>
          ))
        )}
      </Section>

      <Section title={`Dimensions (${sketch.dimensions.length})`}>
        {sketch.dimensions.length === 0 ? (
          <p className="text-2xs text-slate-500">No dimensions yet.</p>
        ) : (
          sketch.dimensions.map((dimension) => (
            <ExprField
              key={dimension.id}
              label={dimension.type}
              unit="mm"
              value={dimension.expression}
              onCommit={(next) => setDimensionExpression(sketch.id, dimension.id, next)}
            />
          ))
        )}
        {sketch.dimensions.length ? (
          <p className="pt-0.5 text-3xs text-slate-600">
            Measured: {sketch.dimensions.map((d) => `${d.type} ${measureDimension(sketch, d).toFixed(2)}`).join(' · ')} mm
          </p>
        ) : null}
      </Section>

      <Section title={`Constraints (${sketch.constraints.length})`}>
        {sketch.constraints.length === 0 ? (
          <p className="text-2xs text-slate-500">Horizontal, vertical, coincident, parallel and perpendicular constraints appear here.</p>
        ) : (
          sketch.constraints.map((constraint) => (
            <div key={constraint.id} className="flex items-center justify-between gap-2 rounded border border-line bg-ink-850 px-1.5 py-0.5 text-2xs">
              <span className="capitalize text-slate-300">{constraint.type}</span>
              <button className="text-slate-600 hover:text-red-300" title="Remove constraint" onClick={() => removeConstraint(sketch.id, constraint.id)}>
                <X size={11} />
              </button>
            </div>
          ))
        )}
      </Section>

      <Section title="Used by">
        {usedBy.length ? (
          usedBy.map((feature) => (
            <button
              key={feature.id}
              className="flex w-full items-center justify-between text-2xs text-slate-300 hover:text-white"
              onClick={() => useSelectionStore.getState().select({ kind: 'feature', id: feature.id })}
            >
              <span>{feature.name}</span>
              <span className="num text-3xs text-slate-600">{regen.status[feature.id]?.status ?? 'ok'}</span>
            </button>
          ))
        ) : (
          <p className="text-2xs text-slate-500">Not consumed by a feature yet.</p>
        )}
      </Section>
    </>
  );
}

function FeatureDetails({ feature }: { feature: Feature }) {
  const design = useDesignStore((state) => state.design);
  const regen = useRegenerated();
  const status = regen.status[feature.id];
  const sketch = feature.kind === 'extrude' ? design.sketches.find((s) => s.id === feature.sketchId) : undefined;
  const body = design.bodies.find((b) => b.id === (feature.kind === 'extrude' ? feature.bodyId : feature.bodyId));

  return (
    <>
      <Section
        title="Feature"
        action={<span className={`badge ${feature.suppressed ? 'border-line text-slate-500' : 'border-accent/40 text-accent'}`}>{feature.kind}</span>}
      >
        <KV k="Name" v={feature.name} mono={false} />
        <KV k="Status" v={feature.suppressed ? 'Suppressed' : (status?.status ?? 'ok')} mono={false} />
        {status?.message ? <p className="text-3xs text-slate-500">{status.message}</p> : null}
        <KV k="Body" v={body?.name ?? '—'} mono={false} />
        {sketch ? <KV k="Parent sketch" v={sketch.name} mono={false} /> : null}
        {feature.kind === 'extrude' ? <KV k="Operation" v={feature.operation === 'cut' ? 'Cut' : 'New body'} mono={false} /> : null}
      </Section>

      <Section title="Parameters">
        {feature.kind === 'extrude' ? (
          <ExprField label="Distance" unit="mm" value={feature.distance} onCommit={(next) => {
            setFeatureExpression(feature.id, 'distance', next);
            return null;
          }} />
        ) : null}
        {feature.kind === 'fillet' ? (
          <ExprField label="Radius" unit="mm" value={feature.radius} onCommit={(next) => {
            setFeatureExpression(feature.id, 'radius', next);
            return null;
          }} />
        ) : null}
        {feature.kind === 'shell' ? (
          <ExprField label="Thickness" unit="mm" value={feature.thickness} onCommit={(next) => {
            setFeatureExpression(feature.id, 'thickness', next);
            return null;
          }} />
        ) : null}
        {feature.kind === 'move' ? (
          <>
            <ExprField label="X offset" unit="mm" value={feature.offset.x} onCommit={(next) => {
              setFeatureExpression(feature.id, 'x', next);
              return null;
            }} />
            <ExprField label="Y offset" unit="mm" value={feature.offset.y} onCommit={(next) => {
              setFeatureExpression(feature.id, 'y', next);
              return null;
            }} />
            <ExprField label="Z offset" unit="mm" value={feature.offset.z} onCommit={(next) => {
              setFeatureExpression(feature.id, 'z', next);
              return null;
            }} />
          </>
        ) : null}
        <p className="text-3xs text-slate-600">Expressions may reference parameters, e.g. plate_thickness * 2.</p>
      </Section>

      <Section title="Actions">
        <ActionRow>
          <SmallButton onClick={() => startCommand(feature.kind, feature.id)}>Edit feature</SmallButton>
          <SmallButton onClick={() => toggleFeatureSuppressed(feature.id)}>{feature.suppressed ? 'Unsuppress' : 'Suppress'}</SmallButton>
          <SmallButton danger onClick={() => deleteSelection([{ kind: 'feature', id: feature.id }])}>
            Delete
          </SmallButton>
        </ActionRow>
      </Section>
    </>
  );
}

function ComponentDetails({ component, design }: { component: Component; design: Design }) {
  const bodies = design.bodies.filter((b) => b.componentId === component.id);
  const sketches = design.sketches.filter((s) => s.componentId === component.id);

  return (
    <>
      <Section
        title="Component"
        action={
          <button className="icon-btn-sm" title={component.visible ? 'Hide' : 'Show'} onClick={() => toggleComponentVisibility(component.id)}>
            {component.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        }
      >
        <KV k="Name" v={component.name} mono={false} />
        <KV k="Role" v={component.parentId === null ? 'Top-level assembly' : 'Child component'} mono={false} />
        <KV k="Bodies" v={bodies.length} />
        <KV k="Sketches" v={sketches.length} />
        <KV k="Visibility" v={component.visible ? 'Visible' : 'Hidden'} mono={false} />
      </Section>

      <Section title="Transform (mm)">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <ExprField
            key={axis}
            label={axis.toUpperCase()}
            unit="mm"
            value={String(component.transform[axis])}
            onCommit={(next) => {
              const value = Number(next);
              if (!Number.isFinite(value)) return 'Enter a number';
              setComponentTransform(component.id, { [axis]: value });
              return null;
            }}
          />
        ))}
      </Section>

      <Section title="Appearance">
        <SelectField
          label="Material"
          value={component.material}
          options={['Default', 'Steel satin', 'Aluminium']}
          onChange={(value) => setComponentMaterial(component.id, value)}
        />
      </Section>

      <Section title="Contents">
        {bodies.length === 0 && sketches.length === 0 ? (
          <p className="text-2xs text-slate-500">No bodies or sketches in this component.</p>
        ) : (
          <>
            {bodies.map((body) => (
              <button
                key={body.id}
                className="flex w-full items-center justify-between text-2xs text-slate-300 hover:text-white"
                onClick={() => useSelectionStore.getState().select({ kind: 'body', id: body.id })}
              >
                <span>{body.name}</span>
                <span className="text-3xs text-slate-600">body</span>
              </button>
            ))}
            {sketches.map((sketch) => (
              <button
                key={sketch.id}
                className="flex w-full items-center justify-between text-2xs text-slate-300 hover:text-white"
                onClick={() => useSelectionStore.getState().select({ kind: 'sketch', id: sketch.id })}
              >
                <span>{sketch.name}</span>
                <span className="text-3xs text-slate-600">{sketch.plane}</span>
              </button>
            ))}
          </>
        )}
      </Section>
    </>
  );
}

function ParameterDetails({ parameter }: { parameter: Parameter }) {
  const design = useDesignStore((state) => state.design);
  const regen = useRegenerated();
  const usedBy = design.features.filter((feature) => {
    const exprs =
      feature.kind === 'extrude'
        ? [feature.distance]
        : feature.kind === 'fillet'
          ? [feature.radius]
          : feature.kind === 'shell'
            ? [feature.thickness]
            : [feature.offset.x, feature.offset.y, feature.offset.z];
    return exprs.some((expr) => expr.includes(parameter.name));
  });

  return (
    <>
      <Section title="Parameter">
        <KV k="Name" v={parameter.name} />
        <KV k="Unit" v={parameter.unit || 'unitless'} mono={false} />
        <KV k="Computed" v={`${(regen.paramValues[parameter.name] ?? 0).toFixed(3)} mm`} />
        {regen.paramErrors[parameter.id] ? (
          <p className="text-3xs text-red-300">{regen.paramErrors[parameter.id]}</p>
        ) : null}
      </Section>
      <Section title="Expression">
        <ExprField
          label="Value"
          unit="mm"
          value={parameter.expression}
          onCommit={(next) => {
            if (!next.trim()) return 'Expression cannot be empty';
            setParameterExpression(parameter.id, next);
            return null;
          }}
        />
        <p className="text-3xs text-slate-600">Numbers and arithmetic between parameters are supported.</p>
      </Section>
      <Section title="Used by">
        {usedBy.length ? (
          usedBy.map((feature) => (
            <button
              key={feature.id}
              className="flex w-full items-center justify-between text-2xs text-slate-300 hover:text-white"
              onClick={() => useSelectionStore.getState().select({ kind: 'feature', id: feature.id })}
            >
              <span>{feature.name}</span>
              <span className="text-3xs text-slate-600">{feature.kind}</span>
            </button>
          ))
        ) : (
          <p className="text-2xs text-slate-500">No feature references this parameter.</p>
        )}
      </Section>
      <Section title="Actions">
        <ActionRow>
          <SmallButton onClick={addParameter}>New parameter</SmallButton>
          <SmallButton danger onClick={() => deleteSelection([{ kind: 'parameter', id: parameter.id }])}>
            Delete
          </SmallButton>
        </ActionRow>
      </Section>
    </>
  );
}

function JointDetails({ joint }: { joint: Joint }) {
  const design = useDesignStore((state) => state.design);
  const name = (id: string) => design.components.find((c) => c.id === id)?.name ?? '—';

  return (
    <Section title="Joint">
      <KV k="Name" v={joint.name} mono={false} />
      <KV k="Type" v={joint.type} mono={false} />
      <KV k="Component A" v={name(joint.a)} mono={false} />
      <KV k="Component B" v={name(joint.b)} mono={false} />
      <KV k="Motion limits" v={joint.limits ? `${joint.limits.min}° – ${joint.limits.max}°` : 'Locked (rigid)'} />
      <p className="pt-1 text-3xs text-slate-600">Joints are authored by the assembly engine and are read-only in this preview.</p>
    </Section>
  );
}

/* --------------------------------- shell ---------------------------------- */

export function PropertiesPanel() {
  const selection = useSelectionStore((state) => state.selection);
  const design = useDesignStore((state) => state.design);
  const toggleProperties = useUiStore((state) => state.toggleProperties);
  const regen = useRegenerated();

  const first = selection[0];
  const body = first && (first.kind === 'body' || first.kind === 'face' || first.kind === 'edge')
    ? design.bodies.find((b) => b.id === (first.bodyId ?? first.id))
    : undefined;
  const feature = first?.kind === 'feature' ? design.features.find((f) => f.id === first.id) : undefined;
  const sketch = first?.kind === 'sketch' ? design.sketches.find((s) => s.id === first.id) : undefined;
  const component = first?.kind === 'component' ? design.components.find((c) => c.id === first.id) : undefined;
  const parameter = first?.kind === 'parameter' ? design.parameters.find((p) => p.id === first.id) : undefined;
  const joint = first?.kind === 'joint' ? design.joints.find((j) => j.id === first.id) : undefined;

  let title = 'Properties';
  let subtitle = 'Nothing selected';
  if (first) {
    subtitle = first.kind === 'face' ? 'Face' : first.kind === 'edge' ? 'Edge' : first.kind;
    if (body) title = `${design.components.find((c) => c.id === body.componentId)?.name ?? 'Component'} / ${body.name}`;
    if (feature) title = feature.name;
    if (sketch) title = sketch.name;
    if (component) title = component.name;
    if (parameter) title = parameter.name;
    if (joint) title = joint.name;
    if (first.kind === 'plane') title = `${first.id}`;
  }

  return (
    <aside className="panel w-[340px] flex-none border-l border-line max-[820px]:hidden">
      <div className="panel-head">
        <div className="min-w-0">
          <div className="panel-title truncate">{title}</div>
          <div className="truncate text-3xs capitalize text-slate-500">
            {subtitle}
            {selection.length > 1 ? ` · ${selection.length} selected` : ''}
          </div>
        </div>
        <button className="icon-btn-sm ml-auto" title="Hide properties" onClick={toggleProperties}>
          <X size={12} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!first ? (
          <>
            <Section title="Selection">
              <p className="text-2xs leading-relaxed text-slate-500">
                Pick a body, face or edge in the canvas, or an item in the Browser. The panel follows the selection.
              </p>
            </Section>
            <Section title="Design summary">
              <KV k="Design" v={design.name} mono={false} />
              <KV k="Units" v={design.units} />
              <KV k="Components" v={design.components.length} />
              <KV k="Bodies" v={design.bodies.length} />
              <KV k="Sketches" v={design.sketches.length} />
              <KV k="Features" v={design.features.length} />
              <KV k="Parameters" v={design.parameters.length} />
              <KV k="Timeline" v={`${design.rollback} / ${design.timeline.length}`} />
              <KV k="Solid volume" v={`${Object.values(regen.bodies).reduce((total, solid) => total + 1, 0)} solids`} />
            </Section>
            <Section title="Tip">
              <p className="text-2xs leading-relaxed text-slate-500">
                Start a sketch on an origin plane, draw a closed profile, then extrude it. Every commit lands on the
                timeline and can be undone.
              </p>
            </Section>
          </>
        ) : first.kind === 'face' && first.face && body ? (
          <>
            <Section title="Face">
              <KV k="Type" v="Planar" mono={false} />
              <KV k="Area" v={`${first.face.area.toFixed(2)} mm²`} />
              <KV k="Normal" v={`${first.face.normal.x.toFixed(2)}, ${first.face.normal.y.toFixed(2)}, ${first.face.normal.z.toFixed(2)}`} />
              <KV k="Centroid" v={`${first.face.point.x.toFixed(2)}, ${first.face.point.y.toFixed(2)}, ${first.face.point.z.toFixed(2)}`} />
              <KV k="Body" v={body.name} mono={false} />
            </Section>
            <Section title="Selection">
              <KV k="Internal id" v={first.id} />
              <p className="text-3xs text-slate-600">Show all edges to pick individual edges from the display menu.</p>
            </Section>
            <BodyDetails body={body} design={design} selection={selection} />
          </>
        ) : first.kind === 'edge' && first.edge && body ? (
          <>
            <Section title="Edge">
              <KV k="Curve" v="Line segment" mono={false} />
              <KV k="Length" v={`${first.edge.length.toFixed(2)} mm`} />
              <KV k="Start" v={`${first.edge.start.x.toFixed(2)}, ${first.edge.start.y.toFixed(2)}, ${first.edge.start.z.toFixed(2)}`} />
              <KV k="End" v={`${first.edge.end.x.toFixed(2)}, ${first.edge.end.y.toFixed(2)}, ${first.edge.end.z.toFixed(2)}`} />
              <KV k="Body" v={body.name} mono={false} />
            </Section>
            <BodyDetails body={body} design={design} selection={selection} />
          </>
        ) : body ? (
          <BodyDetails body={body} design={design} selection={selection} />
        ) : feature ? (
          <FeatureDetails feature={feature} />
        ) : sketch ? (
          <SketchDetails sketch={sketch} />
        ) : component ? (
          <ComponentDetails component={component} design={design} />
        ) : parameter ? (
          <ParameterDetails parameter={parameter} />
        ) : joint ? (
          <JointDetails joint={joint} />
        ) : first.kind === 'plane' ? (
          <Section title="Origin plane">
            <KV k="Plane" v={first.id} />
            <KV k="Normal" v={first.id === 'XY' ? '0, 0, 1' : first.id === 'XZ' ? '0, -1, 0' : '1, 0, 0'} />
            <p className="pt-1 text-2xs text-slate-500">Origin planes are reference geometry and cannot be deleted.</p>
            <ActionRow>
              <SmallButton
                onClick={() => {
                  useSelectionStore.getState().select({ kind: 'plane', id: first.id });
                  startCommand('newSketch');
                }}
              >
                Sketch on {first.id}
              </SmallButton>
            </ActionRow>
          </Section>
        ) : (
          <Section title="Selection">
            <p className="text-2xs leading-relaxed text-slate-500">
              This object is no longer part of the design. It was removed by an undo, a rollback or a delete.
            </p>
            <ActionRow>
              <SmallButton onClick={() => useSelectionStore.getState().clear()}>Clear selection</SmallButton>
            </ActionRow>
          </Section>
        )}
      </div>

      <div className="flex flex-none items-center justify-between border-t border-line px-2.5 py-1 text-3xs text-slate-600">
        <span>{selection.length ? `${selection.length} selected` : 'No selection'}</span>
        <button className="flex items-center gap-1 hover:text-red-300" onClick={() => deleteSelection(selection)} disabled={!selection.length}>
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </aside>
  );
}
