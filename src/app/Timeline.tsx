import { useDesign, useRegenerated } from '../store/designStore';
import { FeatureIcon, Icon, SketchIcon } from './icons';

export function Timeline() {
  const doc = useDesign((s) => s.doc);
  const regen = useRegenerated();
  const select = useDesign((s) => s.select);
  const startCommand = useDesign((s) => s.startCommand);
  const rollbackTo = useDesign((s) => s.rollbackTo);
  const rollbackEnd = useDesign((s) => s.rollbackEnd);
  const selection = useDesign((s) => s.selection);

  const activeCount = Math.min(doc.rollback, doc.timeline.length);
  const rolledBack = activeCount < doc.timeline.length;
  const errorCount = Object.values(regen.status).filter((s) => s.status === 'error').length;

  return (
    <section className="timeline">
      <div className="timeline-head">
        <span className="panel-title">Timeline</span>
        <span className="timeline-count">
          {activeCount} / {doc.timeline.length} active
        </span>
        {errorCount > 0 ? (
          <span className="timeline-error" title={`${errorCount} feature error(s)`}>
            <Icon.Warning size={11} /> {errorCount}
          </span>
        ) : null}
        <span className="timeline-spacer" />
        {rolledBack ? (
          <button className="btn tiny" onClick={rollbackEnd}>
            Roll to end
          </button>
        ) : (
          <span className="timeline-hint">Double-click a feature to edit · click a roll marker to roll back</span>
        )}
      </div>

      <div className="timeline-track">
        {doc.timeline.map((entry, index) => {
          const sketch = entry.type === 'sketch' ? doc.sketches.find((s) => s.id === entry.refId) : undefined;
          const feature = entry.type === 'feature' ? doc.features.find((f) => f.id === entry.refId) : undefined;
          const name = sketch?.name ?? feature?.name ?? 'missing';
          const suppressed = index >= doc.rollback;
          const status = feature ? regen.status[feature.id] : undefined;
          const active = selection.some((item) => item.id === entry.refId);

          return (
            <div className={`tchip-wrap ${suppressed ? 'suppressed' : ''}`} key={entry.id}>
              <button
                className="tchip-roll"
                title={`Roll back to before ${name}`}
                onClick={() => rollbackTo(index)}
                aria-label={`Roll back to before ${name}`}
              />
              <button
                className={`tchip ${active ? 'active' : ''}`}
                onClick={() =>
                  select({ kind: entry.type === 'sketch' ? 'sketch' : 'feature', id: entry.refId })
                }
                onDoubleClick={() => {
                  if (feature) startCommand(feature.kind, feature.id);
                }}
                title={`${name}${suppressed ? ' — rolled back' : ''}`}
              >
                <span className="tchip-icon">
                  {sketch ? <SketchIcon size={12} /> : feature ? <FeatureIcon kind={feature.kind} size={12} /> : null}
                </span>
                <span className="tchip-label">{name}</span>
                {status && status.status !== 'ok' ? <span className={`dot ${status.status}`} /> : null}
              </button>
            </div>
          );
        })}

        <div className="tchip-wrap end">
          <button className="tchip-roll" title="Roll to the end" onClick={rollbackEnd} aria-label="Roll to the end" />
          <span className="timeline-end-label">end</span>
        </div>
      </div>
    </section>
  );
}
