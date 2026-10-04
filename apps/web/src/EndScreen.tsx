import type { ReactNode } from 'react';
import type { GameState } from '@okiya/game';
import type { GameMode } from './mode';
import { scoreText, type Score } from './score';
import { resultDetail, resultSummary } from './text';

/**
 * The end of the game (PRD R4, P4): who won and how (a line, a square, a blockade or the full-board
 * draw), naming the seat in a two-player game, It sits under the board,
 * which keeps the winning shape marked, while the seats show the winner's and the loser's faces.
 */
export function EndScreen({ state, mode, children }: { state: GameState; mode: GameMode; children?: ReactNode }) {
  const { result } = state;
  if (!result) return null;
  return (
    <section aria-labelledby="result" data-testid="end-screen" className="end-screen" data-winner={result.kind === 'draw' ? 'draw' : result.winner} data-by={result.by}>
      <h2 id="result" data-testid="result">
        {resultSummary(result, mode)}
      </h2>
      <p data-testid="result-detail">{resultDetail(state, mode)}</p>
      {children && <div className="button-row">{children}</div>}
    </section>
  );
}

/** The score of the sitting in one line (PRD P3), under the board. */
export function SittingScore({ score, mode }: { score: Score; mode: GameMode }) {
  return (
    <p className="sitting-score" data-testid="sitting-score" data-a={score.A} data-b={score.B} data-draws={score.draws}>
      <span className="visually-hidden">Score of this sitting: </span>
      {scoreText(score, mode)}
    </p>
  );
}
