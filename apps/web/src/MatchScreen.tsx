import { useState } from 'react';
import type { Action, CellId, FighterId, MatchState, PlayerId, PlayerView } from '@okiya/rules';
import { Board } from './Board';
import { EndScreen } from './EndScreen';
import { describeEvents } from './events';
import { BOT, HUMAN } from './match';
import { RulesPanel } from './RulesPanel';
import { highlightedCells, optionsFor, resolveCellClick, type CellChoice } from './selection';
import {
  constraintText,
  describeLogEntry,
  describeOption,
  describeRefusal,
  describeResult,
  fighterAccessibleName,
  fighterIdName,
  fighterName,
  fighterStatus,
  sideName,
  symbolIcon,
  tileName,
} from './text';
import { useMatch } from './useMatch';

function StatusPanel({ view }: { view: PlayerView }) {
  const turnText = view.result ? describeResult(view.result, HUMAN) : view.activePlayer === HUMAN ? 'Your turn' : "Bot's turn";
  const side = (player: PlayerId) => (player === HUMAN ? 'you' : 'bot');
  return (
    <section className="status" aria-label="Match status" data-testid="status">
      <p data-testid="turn" data-active={view.activePlayer} data-turn={view.turn} className="turn">
        {turnText}
      </p>
      <p>
        Turn {view.turn} · Objective: {view.objective}
      </p>
      {view.constraint ? (
        <p data-testid="constraint" data-terrain={view.constraint.terrain} data-symbol={view.constraint.symbol} className="constraint">
          Constraint: {constraintText(view.constraint)} ({tileName(view.constraint)} {symbolIcon(view.constraint.symbol)})
        </p>
      ) : (
        <p data-testid="constraint" data-opening="true" className="constraint">
          Opening: deploy on any outside-edge cell (no constraint yet)
        </p>
      )}
      <p data-testid="recharges" data-a={view.recharges.A} data-b={view.recharges.B}>
        Recharges left: {side('A')} {view.recharges.A}, {side('B')} {view.recharges.B}
      </p>
      <p data-testid="deployed" data-a={view.deployedCounts.A} data-b={view.deployedCounts.B}>
        Deployed: {side('A')} {view.deployedCounts.A}, {side('B')} {view.deployedCounts.B} · Bot reserve: {view.reserveCounts[BOT]} hidden
      </p>
      <ul data-testid="charges" aria-label="Charges">
        {view.fighters
          .filter((fighter) => fighter.cell !== null)
          .map((fighter) => (
            <li key={fighter.id} data-fighter={fighter.id} data-charge={fighter.charge} aria-label={fighterAccessibleName(fighter, HUMAN)}>
              {sideName(fighter.owner, HUMAN)}: {fighterName(fighter.type)} at {fighter.cell}, {fighterStatus(fighter)}
            </li>
          ))}
      </ul>
    </section>
  );
}

export function MatchScreen({ initialState, onLeave }: { initialState: MatchState; onLeave: () => void }) {
  const { view, legalActions, attempt } = useMatch(initialState);
  const [selected, setSelected] = useState<FighterId | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [choices, setChoices] = useState<{ cell: CellId; choices: readonly CellChoice[] } | null>(null);

  const humanTurn = view.activePlayer === HUMAN && !view.result;
  const ownFighters = view.fighters.filter((fighter) => fighter.owner === HUMAN);
  const reserve = ownFighters.filter((fighter) => fighter.cell === null);
  // Without an explicit choice, the first reserve fighter is selected.
  const selection = ownFighters.find((fighter) => fighter.id === selected) ?? (humanTurn ? reserve[0] : undefined);
  const options = humanTurn ? optionsFor(legalActions, selection?.id) : [];
  const highlighted = highlightedCells(options);

  function select(fighter: FighterId) {
    setSelected(fighter);
    setRefusal(null);
    setChoices(null);
  }

  function run(action: Action) {
    const refused = attempt(action);
    setChoices(null);
    if (refused) {
      setRefusal(describeRefusal(refused));
    } else {
      setRefusal(null);
      setSelected(null);
    }
  }

  function clickCell(cell: CellId) {
    if (!humanTurn) return;
    const click = resolveCellClick({
      cell,
      human: HUMAN,
      selection,
      options,
      occupant: view.fighters.find((fighter) => fighter.cell === cell),
    });
    switch (click.kind) {
      case 'apply':
      case 'attempt':
        return run(click.action);
      case 'select':
        return select(click.fighter);
      case 'choose':
        setRefusal(null);
        return setChoices({ cell: click.cell, choices: click.choices });
      case 'hint':
        return setRefusal(click.message);
    }
  }

  const recent = view.log.slice(-2);

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

      <StatusPanel view={view} />
      <EndScreen view={view} human={HUMAN} />

      <div className="layout">
        <Board
          testId="board"
          board={view.board}
          human={HUMAN}
          fighters={view.fighters}
          ownTraps={new Set(view.ownTraps.map((trap) => trap.cell))}
          highlighted={new Set(highlighted.keys())}
          selected={selection?.id}
          onCellClick={clickCell}
        />

        <aside className="side">
          <section aria-label="Your fighters" data-testid="reserve">
            <h2>Your reserve</h2>
            {reserve.length === 0 && <p>All deployed.</p>}
            {reserve.map((fighter) => (
              <button
                type="button"
                key={fighter.id}
                data-fighter={fighter.id}
                className={fighter.id === selection?.id ? 'selected' : ''}
                aria-pressed={fighter.id === selection?.id}
                aria-label={fighterAccessibleName(fighter, HUMAN)}
                onClick={() => select(fighter.id)}
              >
                {fighterName(fighter.type)}
              </button>
            ))}
          </section>

          {humanTurn && selection && (
            <section aria-label="Actions" data-testid="actions">
              <h2>{fighterName(selection.type)}: legal actions</h2>
              {options.length === 0 && <p>No legal action for this fighter.</p>}
              {options.map((option, index) => (
                <button type="button" key={index} data-kind={option.action.kind} onClick={() => run(option.action)}>
                  {describeOption(option.action)}
                </button>
              ))}
            </section>
          )}

          {choices && (
            <section aria-label={`Choose on ${choices.cell}`} data-testid="chooser">
              <h2>Choose on {choices.cell}</h2>
              {choices.choices.map((choice, index) =>
                choice.kind === 'action' ? (
                  <button type="button" key={index} onClick={() => run(choice.action)}>
                    {fighterIdName(choice.action.fighter)}: {describeOption(choice.action)}
                  </button>
                ) : (
                  <button type="button" key={index} onClick={() => select(choice.fighter)}>
                    Select {fighterIdName(choice.fighter)}
                  </button>
                ),
              )}
            </section>
          )}

          {refusal && (
            <p role="alert" data-testid="refusal" className="refusal">
              {refusal}
            </p>
          )}

          <section aria-label="Resolution" data-testid="resolution">
            <h2>Last actions</h2>
            {recent.map((entry) => (
              <div key={entry.turn} data-turn={entry.turn} data-player={entry.player}>
                <p>{describeLogEntry(entry, HUMAN)}</p>
                <ol>
                  {describeEvents(entry.events, HUMAN).map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ol>
              </div>
            ))}
          </section>

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

          <RulesPanel preset={view.preset} />
        </aside>
      </div>
    </main>
  );
}
