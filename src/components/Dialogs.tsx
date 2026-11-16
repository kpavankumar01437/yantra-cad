import { Copy, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { renameSelection } from '../services/actions';
import { commitDesign } from '../services/document';
import { deleteVersion, formatWhen, listVersions, saveVersion, type VersionEntry } from '../services/versions';
import { useDesignStore } from '../stores/designStore';
import { useUiStore } from '../stores/uiStore';

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={onClose}>
      <div className="w-[460px] border border-ink-600 bg-ink-900 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="text-xs font-semibold text-slate-100">{title}</div>
            {subtitle ? <div className="text-3xs text-slate-500">{subtitle}</div> : null}
          </div>
          <button className="icon-btn-sm ml-auto" onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ShareDialog() {
  const close = useUiStore((state) => state.setDialog);
  const notify = useUiStore((state) => state.notify);
  const [copied, setCopied] = useState(false);
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;

  return (
    <Modal
      title="Share design"
      subtitle="Anyone with the link opens the current saved version"
      onClose={() => close(null)}
    >
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <input className="input num flex-1 text-2xs" readOnly value={link} aria-label="Share link" />
          <button
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                notify('Link copied', 'ok');
              } catch {
                notify('Clipboard is blocked in this browser', 'error');
              }
            }}
          >
            <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-2xs text-slate-500">
          This build stores the document in this browser. A hosted, multi-user share link arrives with the cloud
          service; no geometry leaves your machine today.
        </p>
        <div className="rounded border border-line bg-ink-850 p-2 text-2xs text-slate-500">
          <div className="mb-1 text-slate-400">Permissions</div>
          <div className="flex items-center justify-between py-0.5">
            <span>Design engineer (you)</span>
            <span className="text-ok">Can edit</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span>Reviewer link</span>
            <span className="text-slate-500">View only — not enabled in preview</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function VersionsDialog() {
  const close = useUiStore((state) => state.setDialog);
  const notify = useUiStore((state) => state.notify);
  const [versions, setVersions] = useState<VersionEntry[]>(() => listVersions());

  return (
    <Modal title="Version history" subtitle="Snapshots saved in this browser" onClose={() => close(null)}>
      <div className="max-h-[320px] overflow-auto">
        {versions.length === 0 ? (
          <div className="p-4 text-2xs text-slate-500">
            No versions yet. Press <span className="kbd">Ctrl</span> <span className="kbd">S</span> or the save button in
            the top bar.
          </div>
        ) : (
          versions.map((version) => (
            <div key={version.id} className="flex items-center gap-2 border-b border-line/60 px-3 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-slate-200">{version.name}</div>
                <div className="num text-3xs text-slate-500">
                  {formatWhen(version.savedAt)} · {version.design.timeline.length} features · {version.design.name}
                </div>
              </div>
              <button
                className="btn h-6 px-2 text-3xs"
                onClick={() => {
                  commitDesign(version.design);
                  notify(`Restored ${version.name}`, 'ok');
                  close(null);
                }}
              >
                Restore
              </button>
              <button
                className="icon-btn text-slate-500 hover:text-red-300"
                title="Delete version"
                onClick={() => setVersions(deleteVersion(version.id))}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-2">
        <span className="text-3xs text-slate-600">Keeps the last 10 snapshots</span>
        <button
          className="btn"
          onClick={() => {
            setVersions(saveVersion(useDesignStore.getState().design));
            notify('Version saved', 'ok');
          }}
        >
          Save current state
        </button>
      </div>
    </Modal>
  );
}

function RenameDialog({ target, value }: { target: { kind: string; id: string }; value: string }) {
  const close = useUiStore((state) => state.setDialog);
  const [name, setName] = useState(value);

  return (
    <Modal title="Rename" onClose={() => close(null)}>
      <form
        className="p-3"
        onSubmit={(event) => {
          event.preventDefault();
          renameSelection(target as never, name);
          close(null);
        }}
      >
        <label className="label" htmlFor="rename-value">
          Name
        </label>
        <input id="rename-value" className="input" autoFocus value={name} onChange={(event) => setName(event.target.value)} onFocus={(event) => event.target.select()} />
        <div className="mt-3 flex justify-end gap-1.5">
          <button type="button" className="btn" onClick={() => close(null)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Rename
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Dialogs() {
  const dialog = useUiStore((state) => state.dialog);
  if (!dialog) return null;
  if (dialog.kind === 'share') return <ShareDialog />;
  if (dialog.kind === 'versions') return <VersionsDialog />;
  return <RenameDialog target={dialog.target} value={dialog.value} />;
}
