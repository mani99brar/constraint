import { useState } from 'react';
import { ALL_CELLS, isEdgeCell, type CellId, type FighterId, type FighterState, type PlayerView } from '@okiya/rules';
import type { MatchState } from '@okiya/rules';
import { HUMAN } from './match';
import { constraintText, describeLogEntry, describeRefusal, describeResult, fighterName, sideName, symbolIcon, tileName } from './text';
import { useMatch } from './useMatch';

function cellLabel(view: PlayerView, cell: CellId, fighter: FighterState | undefined, trapped: boolean): string {
  const parts = [cell, tileName(view.board[cell])];
  if (fighter) parts.push(`${fighter.owner === HUMAN ? 'your' : "bot's"} ${fighterName(fighter.type)}, ${fighter.charge ? 'charged' : 'spent'}`);
  if (trapped) parts.push('your trap');
  return parts.join(', ');
}

export function MatchScreen({ initialState, onLeave }: { initialState: MatchState; onLeave: () => void }) {
  const { view, legalActions, attempt } = useMatch(initialState);
  const [selected, setSelected] = useState<FighterId | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const humanTurn = view.activePlayer === HUMAN && !view.result;
  const ownFighters = view.fighters.filter((fighter) => fighter.owner === HUMAN);
  const reserve = ownFighters.filter((fighter) => fighter.cell === null);
  // Without an explicit choice, the first reserve fighter is selected.
  const selection =
    ownFighters.find((fighter) => fighter.id === selected) ?? (humanTurn ? reserve[0] : undefined);
  const highlighted = new Set<CellId>(
    legalActions.flatMap((action) =>
      (action.kind === 'deploy' || action.kind === 'move') && action.fighter === selection?.id ? [action.cell] : [],
    ),
  );
  const fighterAt = (cell: CellId) => view.fighters.find((fighter) => fighter.cell === cell);
  const ownTrapCells = new Set(view.ownTraps.map((trap) => trap.cell));

  function clickCell(cell: CellId) {
    if (!humanTurn) return;
    const occupant = fighterAt(cell);
    if (occupant?.owner === HUMAN && occupant.id !== selection?.id) {
      setSelected(occupant.id);
      setRefusal(null);
      return;
    }
    if (!selection) {
      setRefusal('Select one of your fighters first.');
      return;
    }
    const kind = selection.cell === null ? 'deploy' : 'move';
    const refused = attempt({ kind, fighter: selection.id, cell });
    if (refused) {
      setRefusal(describeRefusal(refused));
    } else {
      setRefusal(null);
      setSelected(null);
    }
  }

  const turnText = view.result
    ? describeResult(view.result, HUMAN)
    : view.activePlayer === HUMAN
      ? 'Your turn'
      : "Bot's turn";

  return (
    <main className="match">
      <header className="match-header">
        <h1>Okiya</h1>
        <span data-testid="seed">Seed {view.seed}</span>
        <span>Preset {view.preset.id}</span>
        <button type="button" onClick={onLeave}>
          New match
        </button>
      </header>

      <section className="status" aria-label="Match status">
        <p data-testid="turn" data-active={view.activePlayer} data-turn={view.turn} className="turn">
          {turnText}
        </p>
        <p>Turn {view.turn}</p>
        {view.constraint ? (
          <p data-testid="constraint" data-terrain={view.constraint.terrain} data-symbol={view.constraint.symbol} className="constraint">
            Constraint: {constraintText(view.constraint)} ({tileName(view.constraint)} {symbolIcon(view.constraint.symbol)})
          </p>
        ) : (
          <p data-testid="constraint" data-opening="true" className="constraint">
            Opening: deploy on any outside-edge cell (no constraint yet)
          </p>
        )}
        <p>
          Recharges: you {view.recharges.A}, bot {view.recharges.B} · Deployed: you {view.deployedCounts.A}, bot {view.deployedCounts.B} ·
          Objective: {view.objective}
        </p>
      </section>

      <div className="layout">
        <div role="grid" aria-label="Board" className="board" data-testid="board">
          {ALL_CELLS.map((cell) => {
            const tile = view.board[cell];
            const fighter = fighterAt(cell);
            const isHighlighted = humanTurn && highlighted.has(cell);
            return (
              <button
                type="button"
                key={cell}
                role="gridcell"
                className={`cell terrain-${tile.terrain.toLowerCase()}${isHighlighted ? ' highlighted' : ''}${
                  fighter && fighter.id === selection?.id ? ' selected' : ''
                }`}
                data-cell={cell}
                data-terrain={tile.terrain}
                data-symbol={tile.symbol}
                data-edge={isEdgeCell(cell)}
                data-highlighted={isHighlighted}
                data-occupied={fighter !== undefined}
                data-owner={fighter?.owner}
                aria-label={cellLabel(view, cell, fighter, ownTrapCells.has(cell))}
                onClick={() => clickCell(cell)}
              >
                <span className="cell-id">{cell}</span>
                <span className="tile">
                  {tile.terrain} {symbolIcon(tile.symbol)} {tile.symbol}
                </span>
                {fighter && (
                  <span className={`token ${fighter.owner === HUMAN ? 'own' : 'enemy'}`}>
                    {sideName(fighter.owner, HUMAN)}: {fighterName(fighter.type)} ({fighter.charge})
                  </span>
                )}
                {ownTrapCells.has(cell) && <span className="trap">trap</span>}
              </button>
            );
          })}
        </div>

        <aside className="side">
          <section aria-label="Your reserve" data-testid="reserve">
            <h2>Your reserve</h2>
            {reserve.length === 0 && <p>All deployed.</p>}
            {reserve.map((fighter) => (
              <button
                type="button"
                key={fighter.id}
                className={fighter.id === selection?.id ? 'selected' : ''}
                aria-pressed={fighter.id === selection?.id}
                onClick={() => {
                  setSelected(fighter.id);
                  setRefusal(null);
                }}
              >
                {fighterName(fighter.type)}
              </button>
            ))}
            <p>Bot reserve: {view.reserveCounts.B} hidden</p>
          </section>

          {refusal && (
            <p role="alert" data-testid="refusal" className="refusal">
              {refusal}
            </p>
          )}

          <section aria-label="Action log">
            <h2>Log</h2>
            <ol data-testid="log" className="log">
              {view.log.map((entry) => (
                <li key={entry.turn} data-player={entry.player}>
                  Turn {entry.turn} · {describeLogEntry(entry, HUMAN)}
                </li>
              ))}
            </ol>
          </section>

          {view.reveal && (
            <section aria-label="Reveal" data-testid="reveal">
              <h2>Reveal</h2>
              <p>Objectives: you {view.reveal.objectives.A}, bot {view.reveal.objectives.B}</p>
              <p>Your roster: {view.reveal.rosters.A.map(fighterName).join(', ')}</p>
              <p>Bot roster: {view.reveal.rosters.B.map(fighterName).join(', ')}</p>
              <ul>
                {view.reveal.trapHistory.map((trap) => (
                  <li key={trap.id}>
                    {sideName(trap.owner, HUMAN)} trap at {trap.cell}: {trap.fate.kind}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
