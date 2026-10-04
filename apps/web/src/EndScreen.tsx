import type { ReactNode } from 'react';
import type { GameState } from '@okiya/game';
import type { GameMode } from './mode';
import { scoreText, type Score } from './score';
import { resultDetail, resultSummary } from './text';

/**
 * The result card (PRD R4, P4, U10): who won and how (a line, a square, a blockade or the full-board
 * draw), naming the seat in a two-player game. It shows at once, beside the board on wide screens and
 * below it on a phone, never over a cell, while the board plays the end sequence. Its buttons come first
 * in a card of fixed height, so Play again and Home sit in the same places in every ending.
 */
export function EndScreen({ state, mode, children }: { state: GameState; mode: GameMode; children?: ReactNode }) {
  const { result } = state;
  if (!result) return null;
  return (
    <section aria-labelledby="result" data-testid="end-screen" className="end-screen" data-winner={result.kind === 'draw' ? 'draw' : result.winner} data-by={result.by}>
      {children && <div className="button-row end-buttons">{children}</div>}
      <h2 id="result" data-testid="result">
        {resultSummary(result, mode)}
      </h2>
      <p data-testid="result-detail">{resultDetail(state, mode)}</p>
    </section>
  );
}

/** The score of the sitting in one line (PRD P3, U2), between the nameplates, on its own plate. */
export function SittingScore({ score, mode }: { score: Score; mode: GameMode }) {
  return (
    <p className="sitting-score" data-testid="sitting-score" data-a={score.A} data-b={score.B} data-draws={score.draws}>
      <span className="visually-hidden">Score of this sitting: </span>
      {scoreText(score, mode)}
    </p>
  );
}
