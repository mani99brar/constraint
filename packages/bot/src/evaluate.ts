import { adjacentCells, listLegalActions, opponentOf, SQUARES, tileMatches, type CellId, type MatchResult, type MatchState, type PlayerId } from '@okiya/rules';

/** Score of a won position; wins found sooner score higher, losses found later score higher. */
export const WIN_SCORE = 1_000_000;

/** Square progress by fighters inside one square, open (no enemy inside) or blocked. */
const OPEN_SQUARE = [0, 2, 6, 15, 15];
const BLOCKED_SQUARE = [0, 1, 2, 3, 3];
/** An open three-fighter square whose hole the side to move can enter by walking or deploying. */
const ENTERABLE_HOLE = 40;
const DEPLOYED = 1;
const CHARGED = 0.5;
const RECHARGE_LEFT = 0.25;
const MOBILITY = 0.05;

/** The score of an ended match for `me`, `ply` plies below the root. */
export function terminalScore(result: MatchResult, me: PlayerId, ply: number): number {
  if (result.kind === 'draw') return 0;
  return result.winner === me ? WIN_SCORE - ply : -WIN_SCORE + ply;
}

/**
 * The best square a side is building, and whether it can close an open three-fighter square
 * on this turn by walking its fourth fighter or deploying it into the hole (paper test 01 F1:
 * displacement modes are found by the search, which lists ability actions too).
 */
function squareProgress(state: MatchState, side: PlayerId, toMove: boolean): number {
  const own = new Set<CellId>();
  const enemy = new Set<CellId>();
  let reserve = 0;
  for (const fighter of state.fighters) {
    if (fighter.owner === side) {
      if (fighter.cell) own.add(fighter.cell);
      else reserve += 1;
    } else if (fighter.cell) {
      enemy.add(fighter.cell);
    }
  }
  let best = 0;
  for (const square of SQUARES) {
    const mine = square.filter((cell) => own.has(cell)).length;
    const blocked = square.some((cell) => enemy.has(cell));
    let value = (blocked ? BLOCKED_SQUARE : OPEN_SQUARE)[mine]!;
    if (toMove && !blocked && mine === 3 && state.constraint) {
      const hole = square.find((cell) => !own.has(cell))!;
      if (tileMatches(state.board[hole], state.constraint)) {
        const walker = adjacentCells(hole).some((cell) => own.has(cell) && !square.includes(cell));
        if (walker || reserve > 0) value += ENTERABLE_HOLE;
      }
    }
    best = Math.max(best, value);
  }
  return best;
}

function sideScore(state: MatchState, side: PlayerId): number {
  let score = squareProgress(state, side, state.activePlayer === side);
  for (const fighter of state.fighters) {
    if (fighter.owner !== side || !fighter.cell) continue;
    score += DEPLOYED;
    if (fighter.charge === 1) score += CHARGED;
  }
  return score + RECHARGE_LEFT * state.recharges[side];
}

/**
 * Static evaluation of a running match for `me`: square progress against the opponent's
 * (an enemy fighter inside a square blocks it, `paper-test-01.md` F2), deployed and charged
 * fighters, recharges left, and the side to move's number of legal actions.
 */
export function evaluate(state: MatchState, me: PlayerId): number {
  const mobility = MOBILITY * listLegalActions(state).length;
  const sign = state.activePlayer === me ? 1 : -1;
  return sideScore(state, me) - sideScore(state, opponentOf(me)) + sign * mobility;
}
