import { phoneToast, type QueuedToast } from './toasts';

/**
 * Short notices outside the board (PRD U3): on wide screens in a fixed slot under the board, sized for a
 * take and a refusal together; on a phone one at a time in its one-line short form, in the gap under the
 * board, a refusal outranking a take. They never cover a tile, the board never moves when one comes or
 * goes, and they never take a tap or focus. A refusal is read out here, in full; the bot's take is read
 * out by the turn announcement, so its toast is not read twice.
 */
export function Toasts({ toasts }: { toasts: readonly { toast: QueuedToast; leaving: boolean }[] }) {
  const phone = phoneToast(toasts);
  return (
    <div className="toasts" role="status" aria-live="polite" data-testid="toasts">
      {toasts.map(({ toast, leaving }) => (
        <p
          key={toast.id}
          className={`toast ${toast.tone}${leaving ? ' leaving' : ''}`}
          data-testid="toast"
          data-kind={toast.kind}
          data-tone={toast.tone}
          data-short={toast.short}
          data-phone={toast.id === phone}
          aria-hidden={toast.kind === 'take' || undefined}
        >
          <span className="toast-text">{toast.text}</span>
        </p>
      ))}
    </div>
  );
}
