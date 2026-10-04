import { useRef, type KeyboardEvent } from 'react';

/**
 * A switch of a few options (PRD S1): a radio group with one Tab stop, where the arrow keys move and
 * select, as a radio group does.
 */
export function RadioSwitch<T extends string>({
  label,
  testId,
  options,
  value,
  afterKey,
  onChange,
}: {
  label: string;
  testId: string;
  options: readonly { readonly id: T; readonly label: string }[];
  value: T;
  afterKey: (current: T, key: string) => T | null;
  onChange: (value: T) => void;
}) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = afterKey(value, event.key);
    if (!next) return;
    event.preventDefault();
    onChange(next);
    buttons.current.get(next)?.focus();
  }
  return (
    <div className="radio-switch" role="radiogroup" aria-label={label} data-testid={testId} data-value={value} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(({ id, label: text }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={id === value}
          tabIndex={id === value ? 0 : -1}
          data-option={id}
          ref={(element) => {
            if (element) buttons.current.set(id, element);
            else buttons.current.delete(id);
          }}
          onClick={() => onChange(id)}
          onKeyDown={onKeyDown}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

