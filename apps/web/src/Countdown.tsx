import { useEffect } from 'react';
import { countdownWords } from './countdown';

/**
 * The countdown over the board before a new game (3, 2, 1): each number pops in briefly, under reduced
 * motion it simply changes. A tap anywhere, or Enter, Space or Escape, starts the game at once.
 */
export function Countdown({ count, onSkip }: { count: number; onSkip: () => void }) {
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Escape') return;
      event.preventDefault();
      onSkip();
    };
    window.addEventListener('keydown', keys, true);
    return () => window.removeEventListener('keydown', keys, true);
  }, [onSkip]);

  return (
    <div className="countdown" data-testid="countdown" data-count={count} role="status" aria-live="polite" onPointerDown={onSkip}>
      <span key={count} className="countdown-number" aria-hidden="true">
        {count}
      </span>
      <span className="visually-hidden">{countdownWords(count)}</span>
      <span className="countdown-hint" aria-hidden="true">
        Tap to start now
      </span>
    </div>
  );
}
