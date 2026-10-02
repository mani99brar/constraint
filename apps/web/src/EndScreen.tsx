import type { ReactNode } from 'react';
import type { GameState, Player } from '@okiya/game';
import { outcomeOf } from './results';
import { resultDetail, resultSummary } from './text';

/**
 * The end of the game (PRD R4): who won and how (a line, a square, a blockade or the full-board
 * draw), beside the board, which keeps the winning shape marked.
 */
export function EndScreen({ state, human, children }: { state: GameState; human: Player; children?: ReactNode }) {
  const { result } = state;
  if (!result) return null;
  return (
    <section aria-labelledby="result" data-testid="end-screen" className="end-screen" data-outcome={outcomeOf(result, human)} data-by={result.by}>
      <h2 id="result" data-testid="result">
        {resultSummary(result, human)}
      </h2>
      <p data-testid="result-detail">{resultDetail(state, human)}</p>
      {children && <div className="button-row">{children}</div>}
    </section>
  );
}
