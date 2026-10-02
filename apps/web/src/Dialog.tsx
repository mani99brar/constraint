import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { FOCUSABLE_SELECTOR, restoreFocus, wrapFocus } from './focus';

export interface DialogProps {
  readonly titleId: string;
  readonly className: string;
  readonly testId: string;
  readonly onClose: () => void;
  /** The element that opened the dialog; focus returns to it on close. */
  readonly returnFocusTo: HTMLElement | null;
  /** The element focused on open. */
  readonly initialFocus: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
}

/**
 * A modal dialog (PRD U4, U7): focus moves in on open and stays inside, Escape or a tap on the
 * backdrop closes it, and focus returns to the button that opened it.
 */
export function Dialog({ titleId, className, testId, onClose, returnFocusTo, initialFocus, children }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initialFocus.current?.focus();
    return () => {
      restoreFocus(returnFocusTo);
    };
  }, [returnFocusTo, initialFocus]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const focusables = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    const next = wrapFocus(focusables, document.activeElement as HTMLElement | null, event.shiftKey);
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`dialog ${className}`} data-testid={testId}>
        {children}
      </div>
    </div>
  );
}
