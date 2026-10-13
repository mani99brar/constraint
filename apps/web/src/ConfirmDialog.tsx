import { useRef } from 'react';
import { Dialog } from './Dialog';

export interface ConfirmDialogProps {
  readonly title: string;
  /** One or two sentences: what the action replaces or loses. */
  readonly text: string;
  /** The action, named for what it does ("Start new game", "Reset results"). */
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  /** Cancel, Escape or a tap outside: nothing changes. */
  readonly onCancel: () => void;
  readonly returnFocusTo: HTMLElement | null;
  readonly testId: string;
}

/**
 * Asks once before an action that loses something kept: Cancel, focused first, changes nothing; the
 * action button does what it says.
 */
export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onCancel, returnFocusTo, testId }: ConfirmDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = `${testId}-title`;
  return (
    <Dialog titleId={titleId} className="confirm-dialog" testId={testId} onClose={onCancel} returnFocusTo={returnFocusTo} initialFocus={cancel}>
      <header className="dialog-head">
        <h2 id={titleId}>{title}</h2>
      </header>
      <p className="confirm-text" data-testid={`${testId}-text`}>
        {text}
      </p>
      <div className="confirm-actions">
        <button ref={cancel} type="button" data-testid={`${testId}-cancel`} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary" data-testid={`${testId}-confirm`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
