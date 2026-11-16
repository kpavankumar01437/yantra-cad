import { useDesign } from '../store/designStore';

type LayerInfo = { title: string; subtitle: string; capabilities: string[]; note: string };

const LAYERS: Record<string, LayerInfo> = {
  render: {
    title: 'Render workspace',
    subtitle: 'Materials, environment and output',
    capabilities: [
      'Apply appearances and materials to bodies and components',
      'Set up studio or outdoor lighting environments',
      'Produce still images and turntable animations',
    ],
    note: 'In Fusion this workspace shares the CAD geometry and adds a ray-traced output pipeline.',
  },
  simulation: {
    title: 'Simulation workspace',
    subtitle: 'CAE — validate physical behaviour',
    capabilities: [
      'Assign materials and define study types (static stress, modal, thermal)',
      'Apply loads, constraints and contacts to the CAD model',
      'Mesh the model, solve, and inspect results such as stress and displacement',
    ],
    note: 'Simulation consumes the same parametric model and needs a solver engine behind the UI.',
  },
  manufacture: {
    title: 'Manufacture workspace',
    subtitle: 'CAM — prepare the design for machining',
    capabilities: [
      'Create a setup from the CAD body and choose a machine and stock',
      'Generate 2D, 3D and drilling toolpaths with tool libraries',
      'Simulate toolpaths and post-process to G-code',
    ],
    note: 'CAM workflows depend on precise B-rep geometry, which this preview does not provide.',
  },
  drawing: {
    title: 'Drawing workspace',
    subtitle: '2D documentation derived from the model',
    capabilities: [
      'Place base, projected, section and detail views of the model',
      'Add dimensions, notes, tolerances and title blocks',
      'Update views when the 3D model changes — the model stays the source of truth',
    ],
    note: 'Drawings are associative views of the design, not a separate file format.',
  },
};

export function LayerPlaceholder() {
  const workspace = useDesign((s) => s.workspace);
  const setWorkspace = useDesign((s) => s.setWorkspace);
  const info = LAYERS[workspace] ?? LAYERS.render;

  return (
    <div className="placeholder">
      <div className="placeholder-card">
        <span className="placeholder-badge">Coming with its engine</span>
        <h2>{info.title}</h2>
        <p className="placeholder-sub">{info.subtitle}</p>
        <ul className="placeholder-list">
          {info.capabilities.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
        <p className="placeholder-note">{info.note}</p>
        <button className="btn primary" onClick={() => setWorkspace('design')}>
          Back to Design
        </button>
      </div>
    </div>
  );
}
