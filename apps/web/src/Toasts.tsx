import type { QueuedToast } from './toasts';

/** Short notices over the top of the board (PRD U3); they never take a tap or focus. */
export function Toasts({ toasts }: { toasts: readonly { toast: QueuedToast; leaving: boolean }[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite" data-testid="toasts">
      {toasts.map(({ toast, leaving }) => (
        <p key={toast.id} className={`toast ${toast.tone}${leaving ? ' leaving' : ''}`} data-testid="toast" data-kind={toast.kind} data-tone={toast.tone}>
          {toast.text}
        </p>
      ))}
    </div>
  );
}
