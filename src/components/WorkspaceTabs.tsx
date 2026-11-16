import { useDesignStore } from '../stores/designStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore, type Workspace } from '../stores/uiStore';

const WORKSPACES: { id: Workspace; label: string; ready: boolean }[] = [
  { id: 'design', label: 'Design', ready: true },
  { id: 'sketch', label: 'Sketch', ready: true },
  { id: 'render', label: 'Render', ready: false },
  { id: 'simulation', label: 'Simulation', ready: false },
  { id: 'manufacture', label: 'Manufacture', ready: false },
  { id: 'drawing', label: 'Drawing', ready: false },
];

export function WorkspaceTabs() {
  const workspace = useUiStore((state) => state.workspace);
  const setWorkspace = useUiStore((state) => state.setWorkspace);
  const session = useUiStore((state) => state.sketchSession);
  const design = useDesignStore((state) => state.design);
  const notify = useUiStore((state) => state.notify);

  const openSketch = () => {
    const sketch = design.sketches[design.sketches.length - 1];
    if (!sketch) {
      notify('Create a sketch first', 'error');
      return;
    }
    useSelectionStore.getState().select({ kind: 'sketch', id: sketch.id });
    useUiStore.getState().startSketchSession(sketch.id);
  };

  return (
    <nav className="flex items-stretch gap-0.5 border-b border-line bg-ink-900 px-2">
      {WORKSPACES.map((item) => {
        const blocked = item.id === 'sketch' && !session;
        return (
          <button
            key={item.id}
            className={`relative flex items-center gap-1.5 border-b-2 px-3 text-xs transition-colors ${
              workspace === item.id
                ? 'border-accent text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
            onClick={() => {
              if (item.id === 'sketch' && !session) {
                openSketch();
                return;
              }
              setWorkspace(item.id);
            }}
            title={blocked ? 'Opens the most recent sketch' : item.label}
          >
            {item.label}
            {!item.ready ? <span className="badge border-line text-slate-500">soon</span> : null}
          </button>
        );
      })}
      <span className="ml-auto flex items-center pr-1 text-3xs text-slate-600">
        Workspaces change the available commands
      </span>
    </nav>
  );
}
