import { Boxes } from 'lucide-react';
import { useUiStore } from '../stores/uiStore';

const COPY: Record<string, { title: string; body: string; planned: string[] }> = {
  render: {
    title: 'Render workspace',
    body: 'Physically based stills, material libraries and lighting studios for presentation.',
    planned: ['Material library', 'Studio lighting', 'Turntable capture'],
  },
  simulation: {
    title: 'Simulation workspace',
    body: 'Static stress, modal and thermal studies on the same bodies you model here.',
    planned: ['Study setup', 'Mesh controls', 'Results plots'],
  },
  manufacture: {
    title: 'Manufacture workspace',
    body: '2D and 3D CAM toolpaths, setups and post-processed NC output.',
    planned: ['Setup and stock', 'Toolpaths', 'NC posts'],
  },
  drawing: {
    title: 'Drawing workspace',
    body: 'Associative 2D drawing views, dimensions and title blocks.',
    planned: ['Base and projected views', 'Dimensions', 'Title block'],
  },
};

export function WorkspacePlaceholder() {
  const workspace = useUiStore((state) => state.workspace);
  const setWorkspace = useUiStore((state) => state.setWorkspace);
  const copy = COPY[workspace] ?? COPY.drawing;

  return (
    <div className="grid h-full place-items-center bg-ink-950">
      <div className="w-[420px] border border-line bg-ink-900 p-6">
        <Boxes size={22} className="text-accent" strokeWidth={1.5} />
        <h2 className="mt-3 text-[15px] font-semibold text-slate-100">{copy.title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{copy.body}</p>
        <div className="mt-4 border-t border-line pt-3">
          <div className="label">Planned for this workspace</div>
          <ul className="mt-1.5 space-y-1 text-xs text-slate-400">
            {copy.planned.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-ink-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-3xs text-slate-600">Coming soon · not part of this preview</span>
          <button className="btn btn-primary h-6" onClick={() => setWorkspace('design')}>
            Back to Design
          </button>
        </div>
      </div>
    </div>
  );
}
