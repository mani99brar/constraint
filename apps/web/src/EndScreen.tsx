import type { ReactNode } from 'react';
import type { PlayerId, PlayerView } from '@okiya/rules';
import { objectiveSummary } from './howto';
import { describeResult, describeTrap, fighterName } from './text';

/** The end screen (PRD R6): the result, then both objectives, both rosters and every trap. */
export function EndScreen({ view, human, children }: { view: PlayerView; human: PlayerId; children?: ReactNode }) {
  if (!view.result || !view.reveal) return null;
  const { reveal } = view;
  const bot: PlayerId = human === 'A' ? 'B' : 'A';
  return (
    <section aria-label="Match over" data-testid="end-screen" className="end-screen">
      <h2 data-testid="result">{describeResult(view.result, human)}</h2>
      <p data-testid="objectives">
        Objectives: you {reveal.objectives[human]}, bot {reveal.objectives[bot]}
      </p>
      <p className="muted">{objectiveSummary(reveal.objectives[human])}</p>
      <p data-testid="roster-human">Your roster: {reveal.rosters[human].map(fighterName).join(', ')}</p>
      <p data-testid="roster-bot">Bot roster: {reveal.rosters[bot].map(fighterName).join(', ')}</p>
      <h3>Every trap</h3>
      <ul data-testid="traps">
        {reveal.trapHistory.map((trap) => (
          <li key={trap.id} data-owner={trap.owner} data-cell={trap.cell} data-fate={trap.fate.kind}>
            {describeTrap(trap, human)}
          </li>
        ))}
      </ul>
      {children && <div className="button-row">{children}</div>}
    </section>
  );
}
