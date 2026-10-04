import type { Player } from '@okiya/game';
import type { Expression, Reaction } from './reactions';

// The two fixed avatars (PRD U1, §5.8), drawn in code: Player 1 a round face under a knitted cap,
// Player 2 a face in an eared hood. Colours are solid theme tokens; colour is never the only difference.
// The shading is extra paths at partial opacity over the solid fills, lit from the top left (no defs).

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
    case 'thinking':
      return (
        <>
          <path d="M23 29.5q3-1.6 6-.6M35 27.8q3.5-2.4 7-.4" {...ink} />
          <circle cx="27.2" cy="33.8" r="2" fill="var(--face-ink)" />
          <circle cx="39.2" cy="33.8" r="2" fill="var(--face-ink)" />
          <path d="M29.5 43.2h5.5" {...ink} />
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
      <path d="M46.6 29.7A15.5 15.5 0 0 1 26.7 49.6 17.5 17.5 0 0 0 46.6 29.7z" fill="var(--shade)" opacity="0.16" data-shading="shade" />
      <path d="M40 52q11 3 15 12H45q-1-7-5-12z" fill="var(--shade)" opacity="0.2" data-shading="shade" />
      <path d="M19.5 26q2.5-7.5 10-9.5" fill="none" stroke="var(--shine)" strokeWidth="2.4" strokeLinecap="round" opacity="0.4" data-shading="shine" />
      <circle cx="30.6" cy="12.6" r="1.4" fill="var(--shine)" opacity="0.5" data-shading="shine" />
      <ellipse cx="25" cy="38" rx="3.6" ry="2.4" fill="var(--shine)" opacity="0.28" data-shading="shine" />
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
      <path d="M44.2 32.9A13 12 0 0 1 27.6 48.3 15 14 0 0 0 44.2 32.9z" fill="var(--shade)" opacity="0.16" data-shading="shade" />
      <path d="M41 51q11 3 15 13H45q-1-8-4-13z" fill="var(--shade)" opacity="0.2" data-shading="shade" />
      <path d="M15.5 34q.5-12 12-16.5" fill="none" stroke="var(--shine)" strokeWidth="2.4" strokeLinecap="round" opacity="0.4" data-shading="shine" />
      <ellipse cx="25.5" cy="39.5" rx="3.4" ry="2.2" fill="var(--shine)" opacity="0.28" data-shading="shine" />
    </>
  );
}

export interface AvatarProps {
  readonly player: Player;
  readonly expression: Expression;
  /** The one-shot motion for the last event (PRD U9), or none. */
  readonly reaction?: Reaction | null;
  /** Counts the events: the moving group is keyed by it, so a second wince in a row plays again. */
  readonly reactionKey?: number;
  readonly testId?: string;
}

/**
 * A seat's avatar with its resting face and, on top, a one-shot motion (PRD U9): a CSS animation under
 * 400 ms started by the keyed group and its `data-motion`, never looping and off under reduced motion
 * (PRD U8). Only a seat with a reaction moves; a new face shows at once. Decorative: the seat says it in words.
 */
export function Avatar({ player, expression, reaction = null, reactionKey = 0, testId = `avatar-${player}` }: AvatarProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`avatar avatar-p${player === 'A' ? 1 : 2}`}
      data-testid={testId}
      data-avatar={player === 'A' ? 'cap' : 'hood'}
      data-expression={expression}
      data-reaction={reaction ?? undefined}
      data-reaction-key={reactionKey}
      aria-hidden="true"
      focusable="false"
    >
      <g key={reactionKey} className="avatar-motion" data-motion={reaction ?? undefined}>
        {player === 'A' ? <CapFigure /> : <HoodFigure />}
        <g key={expression} className="face" data-face={expression}>
          <Face expression={expression} />
        </g>
      </g>
    </svg>
  );
}
