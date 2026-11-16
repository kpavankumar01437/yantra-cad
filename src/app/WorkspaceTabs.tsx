import { useDesign, type Workspace } from '../store/designStore';

const WORKSPACES: { id: Workspace; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'sketch', label: 'Sketch' },
  { id: 'render', label: 'Render' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'manufacture', label: 'Manufacture' },
  { id: 'drawing', label: 'Drawing' },
];

export function WorkspaceTabs() {
  const workspace = useDesign((s) => s.workspace);
  const setWorkspace = useDesign((s) => s.setWorkspace);

  return (
    <nav className="workspace-tabs" aria-label="Workspaces">
      {WORKSPACES.map((item) => (
        <button
          key={item.id}
          className={`workspace-tab ${workspace === item.id ? 'active' : ''}`}
          onClick={() => setWorkspace(item.id)}
        >
          {item.label}
          {item.id !== 'design' && item.id !== 'sketch' ? <span className="tab-badge">soon</span> : null}
        </button>
      ))}
      <span className="tabs-spacer" />
      <span className="tabs-hint">Workspaces change the available commands</span>
    </nav>
  );
}
