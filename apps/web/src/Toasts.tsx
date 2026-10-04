import type { QueuedToast } from './toasts';

/**
 * Short notices in a fixed slot outside the board, sized for a take and a refusal together, so they
 * never cover a tile and the board never moves when one comes or goes (PRD U3). They never take a tap or focus. A refusal is read
 * out here; the bot's take is read out by the turn announcement, so its toast is not read twice.
 */
export function Toasts({ toasts }: { toasts: readonly { toast: QueuedToast; leaving: boolean }[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite" data-testid="toasts">
      {toasts.map(({ toast, leaving }) => (
        <p
          key={toast.id}
          className={`toast ${toast.tone}${leaving ? ' leaving' : ''}`}
          data-testid="toast"
          data-kind={toast.kind}
          data-tone={toast.tone}
          aria-hidden={toast.kind === 'take' || undefined}
        >
          {toast.text}
        </p>
      ))}
    </div>
  );
}
