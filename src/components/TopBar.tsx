import { Boxes, History, Redo2, Save, Share2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { redo, undo } from '../services/commands';
import { saveVersion } from '../services/versions';
import { useDesignStore } from '../stores/designStore';
import { useHistoryStore } from '../stores/historyStore';
import { useUiStore } from '../stores/uiStore';

export function TopBar() {
  const design = useDesignStore((state) => state.design);
  const dirty = useDesignStore((state) => state.dirty);
  const lastSavedAt = useDesignStore((state) => state.lastSavedAt);
  const canUndo = useHistoryStore((state) => state.past.length > 0);
  const canRedo = useHistoryStore((state) => state.future.length > 0);
  const setDialog = useUiStore((state) => state.setDialog);
  const notify = useUiStore((state) => state.notify);

  const [name, setName] = useState(design.name);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === design.name) {
      setName(design.name);
      return;
    }
    useDesignStore.getState().setDesign({ ...design, name: trimmed, updatedAt: Date.now() });
  };

  return (
    <header className="flex items-center gap-4 border-b border-line bg-ink-900 px-3">
      <div className="flex items-center gap-2 pr-4">
        <Boxes size={19} className="text-accent" strokeWidth={1.6} />
        <div className="leading-none">
          <div className="text-[13px] font-semibold tracking-tight text-slate-100">Yantra CAD</div>
          <div className="mt-0.5 text-3xs text-slate-500">Mechanical design workspace</div>
        </div>
      </div>

      <span className="h-5 w-px bg-line" />

      <input
        className="w-[220px] border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-medium text-slate-100 hover:border-line"
        value={name}
        aria-label="Design name"
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setName(design.name);
            event.currentTarget.blur();
          }
        }}
      />

      <div className="flex items-center gap-1.5 text-2xs text-slate-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dirty ? 'bg-warn' : 'bg-ok'}`} />
        {dirty ? 'Unsaved changes' : lastSavedAt ? 'All changes saved' : 'Saved locally'}
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={15} />
        </button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={15} />
        </button>
        <button
          className="icon-btn"
          title="Save version (Ctrl+S)"
          onClick={() => {
            useDesignStore.getState().saveNow();
            saveVersion(useDesignStore.getState().design);
            notify('Version saved', 'ok');
          }}
        >
          <Save size={15} />
        </button>
        <span className="mx-1.5 h-4 w-px bg-line" />
        <button className="icon-btn" title="Share" onClick={() => setDialog({ kind: 'share' })}>
          <Share2 size={15} />
        </button>
        <button className="icon-btn" title="Version history" onClick={() => setDialog({ kind: 'versions' })}>
          <History size={15} />
        </button>
        <div
          className="ml-2 grid h-6 w-6 place-items-center rounded-full border border-ink-600 bg-ink-750 text-3xs font-semibold text-slate-300"
          title="Signed in as design engineer"
        >
          DE
        </div>
      </div>
    </header>
  );
}
