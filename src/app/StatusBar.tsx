import { useDesign, useRegenerated } from '../store/designStore';
import { fmt } from './format';
import { Icon } from './icons';

export function StatusBar() {
  const doc = useDesign((s) => s.doc);
  const selection = useDesign((s) => s.selection);
  const hoverFace = useDesign((s) => s.hoverFace);
  const hoverBodyId = useDesign((s) => s.hoverBodyId);
  const displayMode = useDesign((s) => s.displayMode);
  const regen = useRegenerated();

  const target = selection[0];
  let summary = 'Nothing selected';

  if (target?.kind === 'body') {
    const body = doc.bodies.find((b) => b.id === target.id);
    const component = body ? doc.components.find((c) => c.id === body.componentId) : undefined;
    summary = body ? `Body · ${component?.name ?? ''} / ${body.name}` : 'Body';
  } else if (target?.kind === 'sketch') {
    const sketch = doc.sketches.find((s) => s.id === target.id);
    summary = sketch ? `Sketch · ${sketch.name} · ${sketch.plane} plane · ${sketch.entities.length} entities` : 'Sketch';
  } else if (target?.kind === 'feature') {
    const feature = doc.features.find((f) => f.id === target.id);
    summary = feature ? `Feature · ${feature.name} (${feature.kind})` : 'Feature';
  } else if (target?.kind === 'parameter') {
    const parameter = doc.parameters.find((p) => p.id === target.id);
    summary = parameter ? `Parameter · ${parameter.name} = ${fmt(regen.paramValues[parameter.name])} mm` : 'Parameter';
  } else if (target) {
    summary = `${target.kind} · ${target.id}`;
  }

  const errorCount = Object.values(regen.status).filter((s) => s.status === 'error').length;
  const hoveredBody = hoverBodyId ? doc.bodies.find((b) => b.id === hoverBodyId) : undefined;

  return (
    <footer className="statusbar">
      <span className="status-item strong">{summary}</span>
      <span className="status-sep" />
      <span className="status-item">
        {hoverFace
          ? `Face · ${fmt(hoverFace.area, 1)} mm² · n ${hoverFace.normal.map((v) => fmt(v, 1)).join(', ')}`
          : hoveredBody
            ? `Hover · ${hoveredBody.name}`
            : 'Hover a face to inspect it'}
      </span>
      <span className="status-spacer" />
      <span className="status-item">{doc.units}</span>
      <span className="status-item">Grid 5 mm</span>
      <span className="status-item">
        {displayMode === 'shadedEdges' ? 'Shaded + edges' : displayMode === 'shaded' ? 'Shaded' : 'Wireframe'}
      </span>
      <span className={`status-item ${errorCount ? 'has-error' : ''}`}>
        {errorCount ? (
          <>
            <Icon.Warning size={11} /> {errorCount} feature error{errorCount > 1 ? 's' : ''}
          </>
        ) : (
          'Model up to date'
        )}
      </span>
      <span className="status-item kernel" title="Geometry is generated in the browser from the feature history">
        Browser-side kernel
      </span>
    </footer>
  );
}
