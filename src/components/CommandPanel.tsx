import { AlertTriangle, Check, X } from 'lucide-react';
import { useMemo } from 'react';
import { commandFields, COMMAND_LABELS, commitActiveCommand, previewCommand } from '../services/commands';
import { useCommandStore } from '../stores/commandStore';
import { useDesignStore } from '../stores/designStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';

export function CommandPanel() {
  const active = useCommandStore((state) => state.active);
  const errors = useCommandStore((state) => state.errors);
  const setInput = useCommandStore((state) => state.setInput);
  const cancel = useCommandStore((state) => state.cancel);
  const setErrors = useCommandStore((state) => state.setErrors);
  const design = useDesignStore((state) => state.design);
  const selection = useSelectionStore((state) => state.selection);
  const toggleProperties = useUiStore((state) => state.toggleProperties);

  const fields = useMemo(() => (active ? commandFields(design, active) : []), [design, active]);
  const preview = useMemo(() => (active ? previewCommand(design, active, selection) : null), [design, active, selection]);

  if (!active) return null;

  const hasBlockingError = Boolean(preview?.error);
  const editing = Boolean(active.editingFeatureId);

  const labelFor = (item: (typeof selection)[number]): string => {
    if (item.kind === 'body' || item.kind === 'face' || item.kind === 'edge') {
      const body = design.bodies.find((b) => b.id === (item.bodyId ?? item.id));
      const component = body ? design.components.find((c) => c.id === body.componentId) : undefined;
      if (body) return `${component?.name ?? 'Component'} / ${body.name}`;
    }
    if (item.kind === 'feature') return design.features.find((f) => f.id === item.id)?.name ?? item.id;
    if (item.kind === 'sketch') return design.sketches.find((s) => s.id === item.id)?.name ?? item.id;
    if (item.kind === 'component') return design.components.find((c) => c.id === item.id)?.name ?? item.id;
    if (item.kind === 'parameter') return design.parameters.find((p) => p.id === item.id)?.name ?? item.id;
    return item.label ?? item.id;
  };

  return (
    <aside className="panel w-[340px] flex-none border-l border-line max-[820px]:hidden">
      <div className="panel-head">
        <div className="min-w-0">
          <div className="panel-title flex items-center gap-1.5">
            {COMMAND_LABELS[active.id]}
            {editing ? <span className="badge border-accent/40 text-accent">edit</span> : null}
          </div>
          <div className="text-3xs text-slate-500">
            {editing ? 'Editing an existing timeline feature' : 'New feature · Step 2 of 2 · Parameters'}
          </div>
        </div>
        <button className="icon-btn-sm ml-auto" title="Cancel (Esc)" onClick={cancel}>
          <X size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-line p-2.5">
          <div className="label">Selection</div>
          <div className="mt-1 space-y-1">
            {selection.length === 0 ? (
              <div className="text-2xs text-slate-500">Nothing selected — pick geometry in the canvas or browser.</div>
            ) : (
              selection.slice(0, 3).map((item) => (
                <div key={`${item.kind}_${item.id}`} className="flex items-center justify-between gap-2 rounded border border-line bg-ink-850 px-1.5 py-1 text-2xs">
                  <span className="truncate text-slate-300">
                    <span className="text-slate-500">{item.kind}</span> · {labelFor(item)}
                  </span>
                  {item.face ? <span className="num text-slate-500">{item.face.area.toFixed(1)} mm²</span> : null}
                </div>
              ))
            )}
          </div>
          {active.id !== 'newSketch' ? (
            <p className="mt-1.5 text-3xs text-slate-600">Clicking geometry updates the command inputs below.</p>
          ) : null}
        </div>

        <div className="space-y-2.5 p-2.5">
          {fields.map((field, index) => {
            if (field.type === 'note') {
              return (
                <p key={`note_${index}`} className="rounded border border-line bg-ink-850 p-1.5 text-3xs leading-relaxed text-slate-500">
                  {field.text}
                </p>
              );
            }
            const value = active.inputs[field.key] ?? '';
            const error = errors[field.key];
            return (
              <div key={field.key}>
                <label className="label" htmlFor={`cmd_${field.key}`}>
                  {field.label}
                  {'unit' in field && field.unit ? <span className="ml-1 text-slate-600">({field.unit})</span> : null}
                  {error ? <span className="ml-1 text-red-300">· {error}</span> : null}
                </label>
                {field.type === 'select' ? (
                  <select
                    id={`cmd_${field.key}`}
                    className="input"
                    value={value}
                    onChange={(event) => setInput(field.key, event.target.value)}
                  >
                    {field.options.length === 0 ? <option value="">Nothing available</option> : null}
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`cmd_${field.key}`}
                    className={`input num ${error ? 'input-invalid' : ''}`}
                    value={value}
                    onChange={(event) => setInput(field.key, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitActiveCommand();
                      }
                      if (event.key === 'Escape') cancel();
                    }}
                  />
                )}
                {field.hint ? <div className="mt-0.5 text-3xs text-slate-600">{field.hint}</div> : null}
              </div>
            );
          })}

          <div
            className={`rounded border p-2 text-2xs ${
              preview?.error
                ? 'border-danger/50 bg-danger/10 text-red-200'
                : preview?.warning
                  ? 'border-warn/40 bg-warn/10 text-amber-200'
                  : 'border-ok/40 bg-ok/10 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-medium">
              {preview?.error ? <AlertTriangle size={11} /> : <Check size={11} />}
              {preview?.error ?? preview?.warning ?? 'Preview ready — the canvas shows the result'}
            </div>
            {errors._form ? <div className="mt-1 text-3xs">{errors._form}</div> : null}
          </div>

          <button
            className="w-full text-left text-3xs text-slate-600 hover:text-slate-400"
            onClick={() => setErrors({})}
          >
            Clear validation messages
          </button>
        </div>
      </div>

      <div className="flex flex-none items-center gap-1.5 border-t border-line p-2">
        <button
          className="btn h-7 flex-1 justify-center"
          onClick={() => {
            cancel();
            toggleProperties();
          }}
        >
          Cancel <span className="kbd">Esc</span>
        </button>
        <button
          className="btn btn-primary h-7 flex-1 justify-center"
          disabled={hasBlockingError}
          title={hasBlockingError ? preview?.error : 'Commit (Enter)'}
          onClick={commitActiveCommand}
        >
          OK <span className="kbd">Enter</span>
        </button>
      </div>
    </aside>
  );
}
