import { useEffect, useRef, useState } from 'react';
import type { Action, CellId, FighterId, FighterState, MatchState, PlayerId, PlayerView } from '@okiya/rules';
import { Board } from './Board';
import { depthLabel, type BotDepthId } from './difficulty';
import { EndScreen } from './EndScreen';
import { describeEvents, inspectedOwnTraps, recentAction } from './events';
import { objectiveSummary } from './howto';
import { SymbolIcon, TerrainIcon } from './icons';
import { BOT, HUMAN } from './match';
import { outcomeOf } from './results';
import { markedCells, optionsFor, resolveCellClick, type CellChoice } from './selection';
import type { Settings } from './settings';
import { SettingsPanel } from './SettingsPanel';
import type { SoundEffect, SoundPlayer } from './sound';
import {
  describeLogEntry,
  describeOption,
  describeRefusal,
  fighterAccessibleName,
  fighterHelp,
  fighterIdName,
  fighterName,
  fighterStatus,
  sideName,
} from './text';
import { turnSentence, turnState, type TurnState } from './turn';
import { useMatch } from './useMatch';

/** Whose turn, the constraint in words and what the player can do now (PRD U5). */
function TurnBar({ view, turn }: { view: PlayerView; turn: TurnState }) {
  return (
    <section
      className={`turn-bar${turn.humanTurn ? ' human' : ''}${turn.botThinking ? ' thinking' : ''}`}
      aria-label="Turn"
      data-testid="turn-bar"
      title={turnSentence(turn)}
    >
      <div className="turn-line">
        <p data-testid="turn" data-active={view.activePlayer} data-turn={view.turn} className="turn" aria-live="polite">
          {turn.headline}
        </p>
        <span className="turn-meta">
          Turn {view.turn} · You are {HUMAN}, the bot is {BOT}
        </span>
      </div>
      {view.constraint ? (
        <p data-testid="constraint" data-terrain={view.constraint.terrain} data-symbol={view.constraint.symbol} className="constraint">
          Constraint:{' '}
          <span className={`chip terrain-${view.constraint.terrain.toLowerCase()}`}>
            <TerrainIcon terrain={view.constraint.terrain} />
            {view.constraint.terrain}
          </span>
          {' or '}
          <span className="chip">
            <SymbolIcon symbol={view.constraint.symbol} />
            {view.constraint.symbol}
          </span>
        </p>
      ) : (
        <p data-testid="constraint" data-opening="true" className="constraint">
          Opening: deploy on any outside-edge cell (no constraint yet)
        </p>
      )}
      <p data-testid="turn-prompt" className="turn-prompt" data-thinking={turn.botThinking}>
        {turn.botThinking && <span className="spinner" aria-hidden="true" />}
        {turn.prompt}
      </p>
    </section>
  );
}

function StatusPanel({ view }: { view: PlayerView }) {
  const side = (player: PlayerId) => (player === HUMAN ? 'you' : 'bot');
  return (
    <section className="status panel" aria-label="Match status" data-testid="status">
      <h2>Status</h2>
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

interface FighterButtonsProps {
  readonly fighters: readonly FighterState[];
  readonly selection: FighterState | undefined;
  readonly legalActions: readonly Action[];
  readonly disabled: boolean;
  readonly onSelect: (fighter: FighterId) => void;
}

/** One button per own fighter, with its help text from `@okiya/content`. */
function FighterButtons({ fighters, selection, legalActions, disabled, onSelect }: FighterButtonsProps) {
  return (
    <ul className="fighter-list">
      {fighters.map((fighter) => {
        const actionCount = legalActions.filter((action) => action.fighter === fighter.id).length;
        return (
          <li key={fighter.id} className={fighter.id === selection?.id ? 'chosen' : ''}>
            <button
              type="button"
              data-fighter={fighter.id}
              data-has-actions={actionCount > 0}
              className={fighter.id === selection?.id ? 'selected' : ''}
              aria-pressed={fighter.id === selection?.id}
              aria-label={fighterAccessibleName(fighter, HUMAN)}
              aria-describedby={`help-${fighter.id}`}
              disabled={disabled}
              onClick={() => onSelect(fighter.id)}
            >
              {fighterName(fighter.type)}
            </button>
            <span id={`help-${fighter.id}`} className="help" data-help={fighter.type}>
              {fighter.cell && <span className="tag">{`${fighter.cell}, ${fighterStatus(fighter)}`}</span>} {fighterHelp(fighter.type)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const SILENT: SoundPlayer = { unlock: () => {}, play: () => false };

/** The sound of the newest log entry: a trap springing, the player's action or the bot's, or the result. */
function soundOf(view: PlayerView): SoundEffect | null {
  const entry = view.log[view.log.length - 1];
  if (!entry) return null;
  if (view.result) return outcomeOf(view.result, HUMAN);
  if (entry.events.some((event) => event.kind === 'trap-triggered')) return 'trap';
  return entry.player === HUMAN ? 'place' : 'bot';
}

export interface MatchScreenProps {
  readonly initialState: MatchState;
  readonly depth: BotDepthId;
  readonly settings: Settings;
  readonly onSettings?: (settings: Settings) => void;
  readonly sound?: SoundPlayer;
  /** Hears every new state once, to save the match or record its result. */
  readonly onChange?: (state: MatchState) => void;
  readonly onHowTo?: (opener: HTMLElement) => void;
  readonly onNewGame?: () => void;
  readonly onLeave: () => void;
}

export function MatchScreen(props: MatchScreenProps) {
  const { initialState, depth, settings, onSettings, sound = SILENT, onChange, onHowTo, onNewGame, onLeave } = props;
  const { view, legalActions, attempt } = useMatch(initialState, depth, onChange);
  const [selected, setSelected] = useState<FighterId | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [choices, setChoices] = useState<{ cell: CellId; choices: readonly CellChoice[] } | null>(null);
  const heard = useRef(view.log.length);

  useEffect(() => {
    // One sound per new action; a resumed match starts silent.
    if (view.log.length === heard.current) return;
    heard.current = view.log.length;
    const effect = soundOf(view);
    if (effect) sound.play(effect);
  }, [view, sound]);

  const humanTurn = view.activePlayer === HUMAN && !view.result;
  const ownFighters = view.fighters.filter((fighter) => fighter.owner === HUMAN);
  const reserve = ownFighters.filter((fighter) => fighter.cell === null);
  const deployed = ownFighters.filter((fighter) => fighter.cell !== null);
  // Nothing is selected until the player chooses, so the turn bar shows every available action.
  const selection = humanTurn ? ownFighters.find((fighter) => fighter.id === selected) : undefined;
  const options = humanTurn ? optionsFor(legalActions, selection?.id) : [];
  const turn = turnState(view, {
    human: HUMAN,
    legalCount: legalActions.length,
    highlights: settings.highlights,
    selection: selection
      ? {
          name: fighterName(selection.type),
          type: selection.type,
          cell: selection.cell,
          tile: selection.cell ? view.board[selection.cell] : null,
          options: options.map((option) => option.action),
        }
      : null,
  });
  const recent = recentAction(view, HUMAN);

  function refuse(text: string) {
    setRefusal(text);
    sound.play('refuse');
  }

  function select(fighter: FighterId) {
    setSelected(fighter);
    setRefusal(null);
    setChoices(null);
    sound.play('select');
  }

  function run(action: Action) {
    const refused = attempt(action);
    setChoices(null);
    if (refused) {
      refuse(describeRefusal(refused));
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
        return refuse(click.message);
    }
  }

  const recentEntries = view.log.slice(-2);
  const objective = view.objective;

  return (
    <main className="match">
      <header className="match-header">
        <h1 className="visually-hidden">Match</h1>
        <span data-testid="bot-depth">Bot: {depthLabel(depth)}</span>
        <span className="header-actions">
          {onHowTo && (
            <button type="button" data-testid="match-how-to-play" onClick={(event) => onHowTo(event.currentTarget)}>
              How to play
            </button>
          )}
          <button type="button" data-testid="menu" onClick={onLeave}>
            Menu
          </button>
        </span>
      </header>

      <EndScreen view={view} human={HUMAN}>
        {onNewGame && (
          <button type="button" className="primary" onClick={onNewGame}>
            New game
          </button>
        )}
        <button type="button" onClick={onLeave}>
          Title screen
        </button>
      </EndScreen>
      <TurnBar view={view} turn={turn} />

      <div className="layout">
        <div className="play">
          <Board
            testId="board"
            board={view.board}
            human={HUMAN}
            fighters={view.fighters}
            ownTraps={new Set(view.ownTraps.map((trap) => trap.cell))}
            inspectedTraps={inspectedOwnTraps(view, HUMAN)}
            highlighted={markedCells(options, settings.highlights)}
            selected={selection?.id}
            recent={recent}
            disabled={!humanTurn}
            onCellClick={clickCell}
          />
          <p className="objective" data-testid="objective">
            <strong>Your objective: {objective}.</strong> {objectiveSummary(objective)}
          </p>
          <p className="legend" aria-hidden="true">
            {settings.highlights && <span className="legend-item legal">Legal for the selected fighter</span>}
            <span className="legend-item recent">Last action</span>
            <span className="legend-item own">● you</span>
            <span className="legend-item enemy">◆ bot</span>
          </p>
        </div>

        <div className="controls">
          {refusal && (
            <p role="alert" data-testid="refusal" className="refusal">
              {refusal}
            </p>
          )}

          {choices && (
            <section aria-label={`Choose on ${choices.cell}`} data-testid="chooser" className="panel chooser">
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

          {humanTurn && selection && (
            <section aria-label="Actions" data-testid="actions" className="panel">
              <h2>{fighterName(selection.type)}: legal actions</h2>
              <p className="help">{fighterHelp(selection.type)}</p>
              {options.length === 0 && <p>No legal action for this fighter.</p>}
              <div className="button-row">
                {options.map((option, index) => (
                  <button type="button" key={index} data-kind={option.action.kind} onClick={() => run(option.action)}>
                    {describeOption(option.action)}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Your reserve" data-testid="reserve" className="panel">
            <h2>Your reserve</h2>
            {reserve.length === 0 && <p className="muted">All deployed.</p>}
            <FighterButtons fighters={reserve} selection={selection} legalActions={legalActions} disabled={!humanTurn} onSelect={select} />
          </section>

          {deployed.length > 0 && (
            <section aria-label="Your fighters on the board" data-testid="on-board" className="panel">
              <h2>On the board</h2>
              <FighterButtons fighters={deployed} selection={selection} legalActions={legalActions} disabled={!humanTurn} onSelect={select} />
            </section>
          )}

          <section aria-label="Resolution" data-testid="resolution" className="panel" aria-live="polite">
            <h2>Last actions</h2>
            {recentEntries.length === 0 && <p className="muted">No action yet.</p>}
            {recentEntries.map((entry) => (
              <div key={entry.turn} data-turn={entry.turn} data-player={entry.player} className="resolution-entry">
                <p>
                  <strong>{describeLogEntry(entry, HUMAN)}</strong>
                </p>
                <ol>
                  {describeEvents(entry.events, HUMAN).map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ol>
              </div>
            ))}
          </section>

          <StatusPanel view={view} />

          <section aria-label="Action log" className="panel">
            <h2>Log</h2>
            <ol data-testid="log" className="log">
              {view.log.map((entry) => (
                <li key={entry.turn} data-player={entry.player}>
                  Turn {entry.turn} · {describeLogEntry(entry, HUMAN)}
                </li>
              ))}
            </ol>
          </section>

          {onSettings && <SettingsPanel settings={settings} onChange={onSettings} compact />}
        </div>
      </div>
    </main>
  );
}
