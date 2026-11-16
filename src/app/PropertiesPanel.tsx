import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { buildSolidGeometry, geometryVolume, type SolidSpec } from '../geometry/solid';
import { useDesign, useRegenerated } from '../store/designStore';
import type { Body, Component, Feature, Joint, Parameter, PlaneId, Sketch } from '../types';
import { CommitInput } from './CommitInput';
import { fmt, toNumber } from './format';
import { FeatureIcon, Icon, SketchIcon } from './icons';

function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="prop-section">
      <div className="prop-head">{title}</div>
      {children}
    </div>
  );
}

function Header({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="prop-header">
      <span className="prop-icon">{icon}</span>
      <div>
        <div className="prop-title">{title}</div>
        <div className="prop-sub">{subtitle}</div>
      </div>
    </div>
  );
}

function useMetrics(spec: SolidSpec | undefined) {
  return useMemo(() => {
    if (!spec) return null;
    const geometry = buildSolidGeometry(spec);
    const volume = geometryVolume(geometry);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const size = box ? box.getSize(new THREE.Vector3()) : new THREE.Vector3();
    const triangles = geometry.getAttribute('position').count / 3;
    geometry.dispose();
    return { volume, size, triangles };
  }, [spec]);
}

function BodyProperties({ body }: { body: Body }) {
  const doc = useDesign((s) => s.doc);
  const regen = useRegenerated();
  const pickedFace = useDesign((s) => s.pickedFace);
  const toggleBody = useDesign((s) => s.toggleBody);
  const solid = regen.bodies[body.id];
  const feature = doc.features.find((f) => f.id === body.featureId);
  const component = doc.components.find((c) => c.id === body.componentId);
  const metrics = useMetrics(solid?.spec);
  const status = feature ? regen.status[feature.id] : undefined;

  if (!solid) {
    return (
      <>
        <Header icon={<Icon.Body />} title={body.name} subtitle={`${component?.name ?? '—'} · not evaluated`} />
        <Section title="Status">
          <div className="callout error">
            <Icon.Warning /> {status?.message ?? 'This body could not be generated.'}
          </div>
        </Section>
      </>
    );
  }

  return (
    <>
      <Header icon={<Icon.Body />} title={body.name} subtitle={`${component?.name ?? '—'} · ${feature?.name ?? '—'}`} />

      <Section title="Geometry">
        <KV label="Profile plane">{solid.spec.plane}</KV>
        <KV label="Height">
          {fmt(Math.abs(solid.spec.z1 - solid.spec.z0))} mm
        </KV>
        <KV label="Volume">{fmt(metrics?.volume, 1)} mm³</KV>
        <KV label="Bounding box">
          {metrics
            ? `${fmt(metrics.size.x)} × ${fmt(metrics.size.y)} × ${fmt(metrics.size.z)} mm`
            : '—'}
        </KV>
        <KV label="Triangles">{metrics ? fmt(metrics.triangles, 0) : '—'}</KV>
        <KV label="Shell">
          {solid.spec.shell ? `${fmt(solid.spec.shell)} mm wall` : 'solid'}
        </KV>
      </Section>

      {pickedFace ? (
        <Section title="Picked face">
          <KV label="Area">{fmt(pickedFace.area, 1)} mm²</KV>
          <KV label="Normal">
            {pickedFace.normal.map((value) => fmt(value, 2)).join(', ')}
          </KV>
          <KV label="At">
            {pickedFace.point.map((value) => fmt(value, 1)).join(', ')}
          </KV>
        </Section>
      ) : null}

      <Section title="Display">
        <div className="kv">
          <span className="kv-label">Visibility</span>
          <button className="chip-toggle" onClick={() => toggleBody(body.id)}>
            <Icon.Eye off={!body.visible} /> {body.visible ? 'Shown' : 'Hidden'}
          </button>
        </div>
        <div className="kv">
          <span className="kv-label">Appearance</span>
          <span className="appearance">
            <span className="swatch" /> Steel · satin
          </span>
        </div>
      </Section>

      {status && status.status !== 'ok' ? (
        <Section title="Feature status">
          <div className={`callout ${status.status}`}>
            <Icon.Warning /> {status.message}
          </div>
        </Section>
      ) : null}
    </>
  );
}

function SketchProperties({ sketch }: { sketch: Sketch }) {
  const doc = useDesign((s) => s.doc);
  const regen = useRegenerated();
  const setRectSize = useDesign((s) => s.setRectSize);
  const setCircleRadius = useDesign((s) => s.setCircleRadius);
  const deleteSketchEntity = useDesign((s) => s.deleteSketchEntity);
  const startCommand = useDesign((s) => s.startCommand);
  const component = doc.components.find((c) => c.id === sketch.componentId);
  const consumers = doc.features.filter((f) => f.kind === 'extrude' && f.sketchId === sketch.id);

  return (
    <>
      <Header icon={<SketchIcon />} title={sketch.name} subtitle={`${component?.name ?? '—'} · ${sketch.plane} plane`} />
      <Section title="Sketch">
        <KV label="Plane">{sketch.plane}</KV>
        <KV label="Entities">{sketch.entities.length}</KV>
        <KV label="Used by">{consumers.length ? consumers.map((f) => f.name).join(', ') : 'nothing yet'}</KV>
      </Section>

      <Section title="Entities">
        {sketch.entities.length === 0 ? (
          <div className="muted-note">
            Empty sketch. Enter the Sketch workspace to draw a rectangle, circle or line.
          </div>
        ) : null}
        {sketch.entities.map((entity) => {
          if (entity.kind === 'rect') {
            const width = Math.abs(entity.b.x - entity.a.x);
            const height = Math.abs(entity.b.y - entity.a.y);
            return (
              <div className="entity-card" key={entity.id}>
                <div className="entity-head">
                  <span className="entity-kind">Rectangle</span>
                  <button
                    className="icon-btn tiny"
                    title="Delete entity"
                    onClick={() => deleteSketchEntity(sketch.id, entity.id)}
                  >
                    ×
                  </button>
                </div>
                <div className="entity-fields">
                  <span className="mini-label">W</span>
                  <CommitInput
                    value={String(Number(width.toFixed(2)))}
                    unit="mm"
                    onCommit={(value) => setRectSize(sketch.id, entity.id, toNumber(value, width), height)}
                  />
                  <span className="mini-label">H</span>
                  <CommitInput
                    value={String(Number(height.toFixed(2)))}
                    unit="mm"
                    onCommit={(value) => setRectSize(sketch.id, entity.id, width, toNumber(value, height))}
                  />
                </div>
              </div>
            );
          }
          if (entity.kind === 'circle') {
            const diameter = entity.r * 2;
            return (
              <div className="entity-card" key={entity.id}>
                <div className="entity-head">
                  <span className="entity-kind">Circle</span>
                  <button
                    className="icon-btn tiny"
                    title="Delete entity"
                    onClick={() => deleteSketchEntity(sketch.id, entity.id)}
                  >
                    ×
                  </button>
                </div>
                <div className="entity-fields">
                  <span className="mini-label">Ø</span>
                  <CommitInput
                    value={String(Number(diameter.toFixed(2)))}
                    unit="mm"
                    onCommit={(value) => setCircleRadius(sketch.id, entity.id, toNumber(value, diameter) / 2)}
                  />
                </div>
              </div>
            );
          }
          const length = Math.hypot(entity.b.x - entity.a.x, entity.b.y - entity.a.y);
          return (
            <div className="entity-card" key={entity.id}>
              <div className="entity-head">
                <span className="entity-kind">Line</span>
                <button
                  className="icon-btn tiny"
                  title="Delete entity"
                  onClick={() => deleteSketchEntity(sketch.id, entity.id)}
                >
                  ×
                </button>
              </div>
              <div className="entity-fields">
                <span className="mini-label">L</span>
                <span className="read-value">{fmt(length)} mm</span>
              </div>
            </div>
          );
        })}
      </Section>

      <Section title="Actions">
        <button className="btn wide" onClick={() => startCommand('extrude')}>
          <FeatureIcon kind="extrude" /> Extrude this profile
        </button>
        <div className="muted-note" style={{ marginTop: 8 }}>
          Editing a dimension above regenerates every feature that uses this sketch — the timeline below shows
          {regen.bodyOrder.length ? ` ${regen.bodyOrder.length} body(ies)` : ' no bodies'} in the current state.
        </div>
      </Section>
    </>
  );
}

function FeatureProperties({ feature }: { feature: Feature }) {
  const doc = useDesign((s) => s.doc);
  const regen = useRegenerated();
  const startCommand = useDesign((s) => s.startCommand);
  const select = useDesign((s) => s.select);
  const deleteSelection = useDesign((s) => s.deleteSelection);
  const status = regen.status[feature.id];
  const component = doc.components.find((c) => c.id === feature.componentId);
  const body = doc.bodies.find((b) => b.id === feature.bodyId);

  return (
    <>
      <Header
        icon={<FeatureIcon kind={feature.kind} />}
        title={feature.name}
        subtitle={`${component?.name ?? '—'} · ${feature.kind}${body ? ` · ${body.name}` : ''}`}
      />
      <Section title="Parameters">
        {feature.kind === 'extrude' ? (
          <>
            <KV label="Profile">{doc.sketches.find((s) => s.id === feature.sketchId)?.name ?? '—'}</KV>
            <KV label="Distance">
              <span className="expr">{feature.distance}</span> = {fmt(regen.paramValues[feature.distance] ?? Number(feature.distance))} mm
            </KV>
          </>
        ) : null}
        {feature.kind === 'fillet' ? (
          <KV label="Radius">
            <span className="expr">{feature.radius}</span> = {fmt(regen.paramValues[feature.radius] ?? Number(feature.radius))} mm
          </KV>
        ) : null}
        {feature.kind === 'shell' ? (
          <KV label="Thickness">
            <span className="expr">{feature.thickness}</span> = {fmt(regen.paramValues[feature.thickness] ?? Number(feature.thickness))} mm
          </KV>
        ) : null}
        {feature.kind === 'move' ? (
          <>
            <KV label="ΔX">
              {feature.offset.x} → {fmt(regen.paramValues[feature.offset.x] ?? Number(feature.offset.x))} mm
            </KV>
            <KV label="ΔY">
              {feature.offset.y} → {fmt(regen.paramValues[feature.offset.y] ?? Number(feature.offset.y))} mm
            </KV>
            <KV label="ΔZ">
              {feature.offset.z} → {fmt(regen.paramValues[feature.offset.z] ?? Number(feature.offset.z))} mm
            </KV>
          </>
        ) : null}
      </Section>

      <Section title="Status">
        {status && status.status !== 'ok' ? (
          <div className={`callout ${status.status}`}>
            <Icon.Warning /> {status.message}
          </div>
        ) : (
          <div className="callout ok">
            <Icon.Check /> Feature rebuilt successfully
          </div>
        )}
      </Section>

      <Section title="Actions">
        <button className="btn wide" onClick={() => startCommand(feature.kind, feature.id)}>
          Edit feature (opens command panel)
        </button>
        <button
          className="btn wide danger"
          onClick={() => {
            select({ kind: 'feature', id: feature.id });
            deleteSelection();
          }}
        >
          Delete feature and dependents
        </button>
      </Section>
    </>
  );
}

function ParameterProperties({ parameter }: { parameter: Parameter }) {
  const regen = useRegenerated();
  const setParameter = useDesign((s) => s.setParameter);
  const doc = useDesign((s) => s.doc);
  const users = doc.features.filter((feature) => {
    if (feature.kind === 'extrude') return feature.distance.includes(parameter.name);
    if (feature.kind === 'fillet') return feature.radius.includes(parameter.name);
    if (feature.kind === 'shell') return feature.thickness.includes(parameter.name);
    return (
      feature.offset.x.includes(parameter.name) ||
      feature.offset.y.includes(parameter.name) ||
      feature.offset.z.includes(parameter.name)
    );
  });

  return (
    <>
      <Header icon={<Icon.Parameter />} title={parameter.name} subtitle="User parameter · millimetres" />
      <Section title="Definition">
        <KV label="Expression">
          <CommitInput value={parameter.expression} onCommit={(value) => setParameter(parameter.id, value)} />
        </KV>
        <KV label="Value">
          {fmt(regen.paramValues[parameter.name])} mm
        </KV>
        {regen.paramErrors[parameter.id] ? (
          <div className="callout error">
            <Icon.Warning /> {regen.paramErrors[parameter.id]}
          </div>
        ) : null}
      </Section>
      <Section title="Used by">
        {users.length ? users.map((feature) => <div key={feature.id} className="kv"><span className="kv-label">{feature.name}</span><span className="kv-value">{feature.kind}</span></div>) : <div className="muted-note">Nothing references this parameter yet.</div>}
      </Section>
      <Section title="Try it">
        <div className="muted-note">
          Change the expression and watch the timeline rebuild: bodies regenerate from the feature history, not
          from stored meshes.
        </div>
      </Section>
    </>
  );
}

function ComponentProperties({ component }: { component: Component }) {
  const doc = useDesign((s) => s.doc);
  const toggleComponent = useDesign((s) => s.toggleComponent);
  const bodies = doc.bodies.filter((b) => b.componentId === component.id);
  const sketches = doc.sketches.filter((s) => s.componentId === component.id);
  const children = doc.components.filter((c) => c.parentId === component.id);

  return (
    <>
      <Header icon={<Icon.Layers />} title={component.name} subtitle="Component · design hierarchy" />
      <Section title="Contents">
        <KV label="Bodies">{bodies.length}</KV>
        <KV label="Sketches">{sketches.length}</KV>
        <KV label="Child components">{children.length}</KV>
        <KV label="Parent">
          {component.parentId ? doc.components.find((c) => c.id === component.parentId)?.name ?? '—' : 'top level'}
        </KV>
      </Section>
      <Section title="Display">
        <div className="kv">
          <span className="kv-label">Visibility</span>
          <button className="chip-toggle" onClick={() => toggleComponent(component.id)}>
            <Icon.Eye off={!component.visible} /> {component.visible ? 'Shown' : 'Hidden'}
          </button>
        </div>
      </Section>
      <Section title="Bodies">
        {bodies.length ? (
          bodies.map((body) => (
            <KV key={body.id} label={body.name}>
              {body.visible ? 'shown' : 'hidden'}
            </KV>
          ))
        ) : (
          <div className="muted-note">No bodies in this component.</div>
        )}
      </Section>
    </>
  );
}

const JOINT_DOF: Record<Joint['type'], string> = {
  rigid: '0 degrees of freedom — parts are locked together',
  revolute: '1 rotational DOF (hinge)',
  slider: '1 translational DOF',
  cylindrical: '1 translation + 1 rotation on the same axis',
  planar: '2 translations + 1 rotation about the normal',
  ball: '3 rotational DOF (pitch, yaw, roll)',
};

function JointProperties({ joint }: { joint: Joint }) {
  const doc = useDesign((s) => s.doc);
  return (
    <>
      <Header icon={<Icon.Joint />} title={joint.name} subtitle="Assembly joint · kinematic behaviour" />
      <Section title="Definition">
        <KV label="Type">{joint.type}</KV>
        <KV label="Motion">{JOINT_DOF[joint.type]}</KV>
        <KV label="Component A">{doc.components.find((c) => c.id === joint.a)?.name ?? '—'}</KV>
        <KV label="Component B">{doc.components.find((c) => c.id === joint.b)?.name ?? '—'}</KV>
      </Section>
      <Section title="Note">
        <div className="muted-note">
          Joints describe allowed relative motion. Driving them, motion studies and collision checks arrive with
          the assembly engine.
        </div>
      </Section>
    </>
  );
}

function PlaneProperties({ plane }: { plane: PlaneId }) {
  const startSketchOnPlane = useDesign((s) => s.startSketchOnPlane);
  const select = useDesign((s) => s.select);
  const description =
    plane === 'XY'
      ? 'Origin plane facing up — the default for prismatic parts'
      : plane === 'XZ'
        ? 'Origin plane facing the front'
        : 'Origin plane facing the right';

  return (
    <>
      <Header icon={<Icon.Plane />} title={`${plane} Plane`} subtitle={description} />
      <Section title="Model origin">
        <KV label="Normal">
          {plane === 'XY' ? '0, 0, 1' : plane === 'XZ' ? '0, 1, 0' : '1, 0, 0'}
        </KV>
        <KV label="Type">Construction plane</KV>
      </Section>
      <Section title="Actions">
        <button
          className="btn wide primary"
          onClick={() => {
            startSketchOnPlane(plane);
            select(null);
          }}
        >
          <SketchIcon /> Create sketch on {plane}
        </button>
      </Section>
    </>
  );
}

function EmptyProperties() {
  const doc = useDesign((s) => s.doc);
  const regen = useRegenerated();
  return (
    <>
      <Header icon={<Icon.Cube />} title="Nothing selected" subtitle="Select a body, sketch or feature" />
      <Section title="Design summary">
        <KV label="Units">{doc.units}</KV>
        <KV label="Components">{doc.components.length}</KV>
        <KV label="Bodies">{regen.bodyOrder.length} of {doc.bodies.length}</KV>
        <KV label="Sketches">{doc.sketches.length}</KV>
        <KV label="Features">{doc.features.length}</KV>
        <KV label="Parameters">{doc.parameters.length}</KV>
      </Section>
      <Section title="How this workspace works">
        <ul className="tip-list">
          <li>Click a body in the canvas or the Browser — both read the same selection state.</li>
          <li>Start a command from the ribbon; the right panel becomes its input dialog.</li>
          <li>Every commit lands on the timeline and can be undone with Ctrl+Z.</li>
          <li>Select a parameter to drive several features at once.</li>
        </ul>
      </Section>
    </>
  );
}

export function PropertiesPanel() {
  const doc = useDesign((s) => s.doc);
  const selection = useDesign((s) => s.selection);
  const target = selection[0];

  const body = target?.kind === 'body' ? doc.bodies.find((b) => b.id === target.id) : undefined;
  const sketch = target?.kind === 'sketch' ? doc.sketches.find((s) => s.id === target.id) : undefined;
  const feature = target?.kind === 'feature' ? doc.features.find((f) => f.id === target.id) : undefined;
  const parameter = target?.kind === 'parameter' ? doc.parameters.find((p) => p.id === target.id) : undefined;
  const component = target?.kind === 'component' ? doc.components.find((c) => c.id === target.id) : undefined;
  const joint = target?.kind === 'joint' ? doc.joints.find((j) => j.id === target.id) : undefined;

  return (
    <aside className="panel properties">
      <div className="panel-head">
        <span className="panel-title">Properties</span>
        <span className="panel-count">
          {target ? `${target.kind}` : 'no selection'}
          {selection.length > 1 ? ` +${selection.length - 1}` : ''}
        </span>
      </div>
      <div className="prop-body">
        {body ? <BodyProperties body={body} /> : null}
        {sketch ? <SketchProperties sketch={sketch} /> : null}
        {feature ? <FeatureProperties feature={feature} /> : null}
        {parameter ? <ParameterProperties parameter={parameter} /> : null}
        {component ? <ComponentProperties component={component} /> : null}
        {joint ? <JointProperties joint={joint} /> : null}
        {target?.kind === 'plane' ? <PlaneProperties plane={target.id as PlaneId} /> : null}
        {!target ? <EmptyProperties /> : null}
      </div>
    </aside>
  );
}
