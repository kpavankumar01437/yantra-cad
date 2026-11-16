import { COMMAND_LABEL, commandFields, commandPreview } from '../model/commands';
import { useDesign } from '../store/designStore';
import { Icon } from './icons';

export function CommandPanel() {
  const cmd = useDesign((s) => s.cmd);
  const doc = useDesign((s) => s.doc);
  const selection = useDesign((s) => s.selection);
  const setCommandInput = useDesign((s) => s.setCommandInput);
  const commitCommand = useDesign((s) => s.commitCommand);
  const cancelCommand = useDesign((s) => s.cancelCommand);
  const cmdError = useDesign((s) => s.cmdError);

  if (!cmd) return null;

  const fields = commandFields(doc, cmd);
  const preview = commandPreview(doc, cmd, selection);
  const error = cmdError ?? preview.error;
  const title = cmd.editingFeatureId ? `Edit ${COMMAND_LABEL[cmd.id]}` : COMMAND_LABEL[cmd.id];

  return (
    <aside className="panel properties command-panel">
      <div className="panel-head">
        <span className={`panel-title ${cmd.editingFeatureId ? 'is-edit' : 'is-create'}`}>
          {cmd.editingFeatureId ? 'Editing feature' : 'Command'}
        </span>
        <span className="panel-count">{cmd.id}</span>
      </div>

      <div className="command-header">
        <h3>{title}</h3>
        <p>
          {cmd.id === 'newSketch'
            ? 'Choose a construction plane. The sketch opens immediately in the Sketch workspace.'
            : cmd.id === 'extrude'
              ? 'Select a closed profile, set the distance and check the preview.'
              : cmd.id === 'fillet'
                ? 'Select a body and set the corner radius.'
                : cmd.id === 'shell'
                  ? 'Select a body and set the wall thickness.'
                  : 'Select a body and offset it in X, Y and Z.'}
        </p>
      </div>

      <div className="command-fields">
        {fields.map((field) => {
          if (field.type === 'note') {
            return (
              <p className="command-note" key={field.key}>
                {field.text}
              </p>
            );
          }
          if (field.type === 'select') {
            return (
              <label className="field-group" key={field.key}>
                <span className="field-label">{field.label}</span>
                <select
                  className="field"
                  value={cmd.inputs[field.key] ?? ''}
                  onChange={(event) => setCommandInput(field.key, event.target.value)}
                >
                  {field.options.length === 0 ? <option value="">Nothing available</option> : null}
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {field.hint ? <span className="field-hint">{field.hint}</span> : null}
              </label>
            );
          }
          return (
            <label className="field-group" key={field.key}>
              <span className="field-label">{field.label}</span>
              <span className="input-wrap">
                <input
                  className="field"
                  value={cmd.inputs[field.key] ?? ''}
                  spellCheck={false}
                  onChange={(event) => setCommandInput(field.key, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitCommand();
                    if (event.key === 'Escape') cancelCommand();
                  }}
                />
                {field.unit ? <span className="unit">{field.unit}</span> : null}
              </span>
              {field.hint ? <span className="field-hint">{field.hint}</span> : null}
            </label>
          );
        })}
      </div>

      {error ? (
        <div className="callout error command-error">
          <Icon.Warning /> {error}
        </div>
      ) : (
        <div className="callout ok command-error">
          <Icon.Check /> {cmd.id === 'newSketch' ? 'Ready to create the sketch' : 'Preview is up to date'}
        </div>
      )}

      <div className="command-footer">
        <button className="btn" onClick={cancelCommand}>
          Cancel <kbd>Esc</kbd>
        </button>
        <button className="btn primary" onClick={commitCommand}>
          OK <kbd>Enter</kbd>
        </button>
      </div>
    </aside>
  );
}
