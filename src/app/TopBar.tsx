import { useDesign } from '../store/designStore';
import { CommitInput } from './CommitInput';
import { BrandMark, Icon } from './icons';

export function TopBar() {
  const name = useDesign((s) => s.doc.name);
  const saved = useDesign((s) => s.saved);
  const canUndo = useDesign((s) => s.past.length > 0);
  const canRedo = useDesign((s) => s.future.length > 0);
  const undo = useDesign((s) => s.undo);
  const redo = useDesign((s) => s.redo);
  const renameDoc = useDesign((s) => s.renameDoc);

  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <div className="brand-text">
          <strong>YantraLab</strong>
          <span>CAD · Cloud product development</span>
        </div>
      </div>

      <div className="doc-title">
        <Icon.Layers size={14} />
        <CommitInput value={name} onCommit={renameDoc} ariaLabel="Design name" className="doc-name" />
        <span className={`save-state ${saved ? 'is-saved' : ''}`}>
          <span className="save-dot" />
          {saved ? 'All changes saved' : 'Unsaved changes'}
        </span>
      </div>

      <div className="topbar-actions">
        <button className="icon-btn" onClick={undo} title="Undo (Ctrl+Z)" aria-disabled={!canUndo} disabled={!canUndo}>
          <Icon.Undo />
        </button>
        <button className="icon-btn" onClick={redo} title="Redo (Ctrl+Y)" aria-disabled={!canRedo} disabled={!canRedo}>
          <Icon.Redo />
        </button>
        <span className="topbar-divider" />
        <div className="avatar" title="Signed in as design lead">KP</div>
      </div>
    </header>
  );
}
