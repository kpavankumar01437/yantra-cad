import { useEffect, useRef, useState } from 'react';

type CommitInputProps = {
  value: string;
  onCommit: (value: string) => void;
  unit?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * Text field that only writes to the document on blur / Enter, so typing does not
 * create a history entry per keystroke. Escape reverts.
 */
export function CommitInput({ value, onCommit, unit, placeholder, className, ariaLabel }: CommitInputProps) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (draft !== value) onCommit(draft);
  };

  return (
    <span className={`input-wrap ${className ?? ''}`}>
      <input
        className="field"
        value={draft}
        aria-label={ariaLabel}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            cancelled.current = true;
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
      />
      {unit ? <span className="unit">{unit}</span> : null}
    </span>
  );
}
