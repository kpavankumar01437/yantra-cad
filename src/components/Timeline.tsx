import { AlertTriangle, SkipForward } from 'lucide-react';
import { setRollback } from '../services/actions';
import { startCommand } from '../services/commands';
import { useRegenerated } from '../services/geometry';
import { useDesignStore } from '../stores/designStore';
import { selectionMatches, useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';
import type { FeatureStatus } from '../types';

export function Timeline() {
  const design = useDesignStore((state) => state.design);
  const regen = useRegenerated();
  const selection = useSelectionStore((state) => state.selection);
  const select = useSelectionStore((state) => state.select);
  const openMenu = useUiStore((state) => state.openContextMenu);
  const showToast = useUiStore((state) => state.notify);

  const active = selection[0];
  const errors = Object.values(regen.status).filter((s) => s.status === 'error').length;
  const rolledBack = design.rollback < design.timeline.length;

  const statusOf = (featureId: string): FeatureStatus | undefined => regen.status[featureId];

  return (
    <section className="flex h-[122px] flex-none flex-col border-t border-line bg-ink-900">
      <div className="flex items-center gap-2 px-2.5 py-1">
        <span className="panel-title">Timeline</span>
        <span className="text-3xs text-slate-600">
          {Math.min(design.rollback, design.timeline.length)} / {design.timeline.length} active
        </span>
        {errors ? (
          <span className="flex items-center gap-1 text-3xs text-red-300" title={`${errors} failed feature(s)`}>
            <AlertTriangle size={10} /> {errors}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {rolledBack ? (
            <>
              <span className="text-3xs text-warn">Rolled back</span>
              <button
                className="btn h-5 px-2 text-3xs"
                onClick={() => {
                  setRollback(design.timeline.length);
                  showToast('Rolled to the end', 'ok');
                }}
              >
                <SkipForward size={10} /> Roll to end
              </button>
            </>
          ) : (
            <span className="text-3xs text-slate-600">Double-click a feature to edit · right-click for options</span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-start gap-0 overflow-x-auto px-2.5 pb-2">
        {design.timeline.map((entry, index) => {
          const sketch = entry.type === 'sketch' ? design.sketches.find((s) => s.id === entry.refId) : undefined;
          const feature = entry.type === 'feature' ? design.features.find((f) => f.id === entry.refId) : undefined;
          const name = sketch?.name ?? feature?.name ?? 'missing';
          const suppressed = index >= design.rollback || Boolean(feature?.suppressed);
          const status = feature ? statusOf(feature.id) : undefined;
          const isActive = active ? selectionMatches(active, { kind: entry.type === 'sketch' ? 'sketch' : 'feature', id: entry.refId }) : false;

          return (
            <div key={entry.id} className="flex flex-none items-center">
              <button
                className="group h-6 w-3"
                title={`Roll back to before ${name}`}
                onClick={() => setRollback(index)}
                aria-label={`Roll back to before ${name}`}
              >
                <span className="mx-auto block h-5 w-px bg-line group-hover:w-0.5 group-hover:bg-accent" />
              </button>
              <button
                className={`flex h-6 items-center gap-1.5 whitespace-nowrap rounded border px-2 text-[11px] ${
                  isActive
                    ? 'border-accent/80 bg-accent-soft text-white'
                    : suppressed
                      ? 'border-dashed border-line bg-ink-850 text-slate-600'
                      : 'border-line bg-ink-800 text-slate-300 hover:border-ink-500 hover:text-white'
                }`}
                onClick={() =>
                  select({ kind: entry.type === 'sketch' ? 'sketch' : 'feature', id: entry.refId })
                }
                onDoubleClick={() => {
                  if (feature) startCommand(feature.kind, feature.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openMenu(event.clientX, event.clientY, {
                    kind: 'timeline',
                    index,
                  });
                  select({ kind: entry.type === 'sketch' ? 'sketch' : 'feature', id: entry.refId });
                }}
                title={`${name}${suppressed ? ' — suppressed' : ''}`}
              >
                <span className={isActive ? 'text-accent' : 'text-slate-500'}>
                  {entry.type === 'sketch' ? (
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M2.5 12.5l7-7 2 2-7 7H2.5v-2z" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                      <path d="M2 12.5l4-2 4 2 4-2v2.5l-4 2-4-2-4 2v-2.5z" />
                      <path d="M2 4l4-2 4 2 4-2" />
                    </svg>
                  )}
                </span>
                {name}
                {status && status.status !== 'ok' ? (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      status.status === 'error' ? 'bg-danger' : status.status === 'warning' ? 'bg-warn' : 'bg-slate-600'
                    }`}
                    title={status.message}
                  />
                ) : null}
              </button>
            </div>
          );
        })}

        <div className="flex flex-none items-center">
          <button
            className="group h-6 w-3"
            title="Roll to the end"
            onClick={() => {
              setRollback(design.timeline.length);
              showToast('Rolled to the end', 'ok');
            }}
          >
            <span className="mx-auto block h-5 w-px bg-line group-hover:w-0.5 group-hover:bg-accent" />
          </button>
          <span className="pl-1 text-3xs text-slate-600">end</span>
        </div>
      </div>
    </section>
  );
}
