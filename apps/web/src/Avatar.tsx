import type { Player } from '@okiya/game';
import type { Expression } from './seats';

// The two fixed avatars (PRD U1, §5.8), drawn in code: Player 1 a round face under a knitted cap,
// Player 2 a face in an eared hood. Colours are theme tokens; colour is never the only difference.

const ink = { fill: 'none', stroke: 'var(--face-ink)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** The eyes, brows and mouth of one expression, drawn on a face centred at (32, 36). */
function Face({ expression }: { expression: Expression }) {
  switch (expression) {
    case 'idle':
      return (
        <>
          <circle cx="26" cy="35" r="1.9" fill="var(--face-ink)" />
          <circle cx="38" cy="35" r="1.9" fill="var(--face-ink)" />
          <path d="M28 42q4 2 8 0" {...ink} />
        </>
      );
    case 'to-move':
      return (
        <>
          <path d="M22.5 29.5q3.5-2.5 7 0M34.5 29.5q3.5-2.5 7 0" {...ink} />
          <circle cx="26" cy="35" r="2.6" fill="var(--face-ink)" />
          <circle cx="38" cy="35" r="2.6" fill="var(--face-ink)" />
          <circle cx="26.9" cy="34.1" r="0.9" fill="var(--face)" />
          <circle cx="38.9" cy="34.1" r="0.9" fill="var(--face)" />
          <ellipse cx="32" cy="42.5" rx="2.4" ry="1.8" fill="var(--face-ink)" />
        </>
      );
    case 'won':
      return (
        <>
          <path d="M23 36q3-3.6 6 0M35 36q3-3.6 6 0" {...ink} />
          <circle cx="22.5" cy="40" r="2.6" fill="var(--cheek)" />
          <circle cx="41.5" cy="40" r="2.6" fill="var(--cheek)" />
          <path d="M26 40.5h12q-1.4 6.5-6 6.5t-6-6.5z" fill="var(--face-ink)" />
        </>
      );
    case 'lost':
      return (
        <>
          <path d="M23 30.5l6 2M41 30.5l-6 2" {...ink} />
          <circle cx="26" cy="36" r="1.7" fill="var(--face-ink)" />
          <circle cx="38" cy="36" r="1.7" fill="var(--face-ink)" />
          <path d="M27.5 44q4.5-3.5 9 0" {...ink} />
          <path d="M45.5 27q2.4 3.2 0 5.2-2.4-2 0-5.2z" fill="var(--tear)" />
        </>
      );
  }
}

/** Player 1: a round face under a knitted cap with a pompom. */
function CapFigure() {
  return (
    <>
      <path d="M8 64q1-15 24-15t24 15z" fill="var(--p1)" />
      <circle cx="32" cy="35" r="15.5" fill="var(--face)" stroke="var(--face-ink)" strokeWidth="1.5" />
      <path d="M15.5 31a16.5 15 0 0 1 33 0z" fill="var(--p1)" />
      <rect x="14" y="27.5" width="36" height="5.5" rx="2.75" fill="var(--p1-rim)" />
      <circle cx="32" cy="14" r="4.2" fill="var(--p1-rim)" />
    </>
  );
}

/** Player 2: a face in a hood with two pointed ears. */
function HoodFigure() {
  return (
    <>
      <path d="M8 64q2-13 10-15h28q8 2 10 15z" fill="var(--p2)" />
      <path d="M17 24 15 8l11 9zM47 24l2-16-11 9z" fill="var(--p2-rim)" />
      <path d="M12.5 41q-1-24 19.5-26 20.5 2 19.5 26-3 10-19.5 10T12.5 41z" fill="var(--p2)" />
      <ellipse cx="32" cy="37" rx="13" ry="12" fill="var(--face)" stroke="var(--face-ink)" strokeWidth="1.5" />
    </>
  );
}

/**
 * A seat's avatar with one of its four expressions. No idle animation loops; a new expression fades in
 * under 400 ms (PRD U8), keyed so it plays once per change. Decorative: the seat says it in words.
 */
export function Avatar({ player, expression }: { player: Player; expression: Expression }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`avatar avatar-p${player === 'A' ? 1 : 2}`}
      data-testid={`avatar-${player}`}
      data-avatar={player === 'A' ? 'cap' : 'hood'}
      data-expression={expression}
      aria-hidden="true"
      focusable="false"
    >
      {player === 'A' ? <CapFigure /> : <HoodFigure />}
      <g key={expression} className="face" data-face={expression}>
        <Face expression={expression} />
      </g>
    </svg>
  );
}
