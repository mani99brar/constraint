import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Action, CellId, FighterId, MatchState, PlayerView } from '@okiya/rules';
import { Board } from './Board';
import type { BotDepthId } from './difficulty';
import { EndScreen } from './EndScreen';
import { inspectedOwnTraps, lastMove } from './events';
import type { HowToSection } from './howto';
import { HUMAN } from './match';
import { MenuDialog } from './MenuDialog';
import { glowingCells, pieceButtons, playableFighters, resolveCellTap, type PieceButton, type PieceMode } from './pieceActions';
import { outcomeOf } from './results';
import type { Settings } from './settings';
import type { SoundEffect, SoundPlayer } from './sound';
import { describeRefusal } from './text';
import { eventToasts, hintToast, refusalToast } from './toasts';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
import { topBarModel } from './topbar';
import { trayContents } from './tray';
import { BotTray, OwnTray } from './Tray';
import { useMatch } from './useMatch';
import { useToasts } from './useToasts';

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
  readonly onHowTo?: (opener: HTMLElement, section?: HowToSection['id']) => void;
  readonly onNewGame?: () => void;
  readonly onLeave: () => void;
}

/**
 * The tabletop (PRD §5.9): the top bar, the bot's face-down tray, the board and the player's
 * tray, with toasts over the board and the menu as a dialog. Nothing else is on screen.
 */
export function MatchScreen(props: MatchScreenProps) {
  const { initialState, depth, settings, onSettings, sound = SILENT, onChange, onHowTo, onNewGame, onLeave } = props;
  const { view, legalActions, attempt } = useMatch(initialState, depth, onChange);
  const [selected, setSelected] = useState<{ fighter: FighterId; mode: PieceMode } | null>(null);
  const [menu, setMenu] = useState<{ opener: HTMLElement | null } | null>(null);
  const { toasts, push } = useToasts();
  const heard = useRef(view.log.length);

  useEffect(() => {
    // One sound and the toasts of each new action; a resumed match starts quiet.
    if (view.log.length === heard.current) return;
    const fresh = view.log.slice(heard.current);
    heard.current = view.log.length;
    push(fresh.flatMap((entry) => eventToasts(entry.events, HUMAN)));
    const effect = soundOf(view);
    if (effect) sound.play(effect);
  }, [view, sound, push]);

  const humanTurn = view.activePlayer === HUMAN && !view.result;
  const ownFighters = view.fighters.filter((fighter) => fighter.owner === HUMAN);
  const selectedFighter = humanTurn && selected ? ownFighters.find((fighter) => fighter.id === selected.fighter) : undefined;
  const selection = selectedFighter && selected ? { fighter: selectedFighter, mode: selected.mode } : null;
  const buttons = selection?.fighter.cell ? pieceButtons(legalActions, selection.fighter) : [];
  const glowing = glowingCells(legalActions, selection, settings.highlights);
  const playable = playableFighters(legalActions, settings.highlights && humanTurn);
  const trays = trayContents(view, HUMAN);
  const bar = topBarModel(view, HUMAN);

  function refuse(text: string) {
    push([refusalToast(text)]);
    sound.play('refuse');
  }

  function select(fighter: FighterId) {
    setSelected({ fighter, mode: 'move' });
    sound.play('select');
  }

  function run(action: Action) {
    const refused = attempt(action);
    if (refused) {
      refuse(describeRefusal(refused));
    } else {
      setSelected(null);
    }
  }

  function tapCell(cell: CellId) {
    if (!humanTurn) return;
    const tap = resolveCellTap({
      cell,
      human: HUMAN,
      selection,
      legalActions,
      occupant: view.fighters.find((fighter) => fighter.cell === cell),
    });
    switch (tap.kind) {
      case 'apply':
      case 'attempt':
        return run(tap.action);
      case 'select':
        return select(tap.fighter);
      case 'cancel':
        return setSelected(null);
      case 'hint':
        return push([hintToast(tap.message)]);
    }
  }

  function pressButton(button: PieceButton) {
    if (!selection) return;
    if (button.kind === 'recharge') return run(button.actions[0]!);
    setSelected({ fighter: selection.fighter.id, mode: selection.mode === 'ability' ? 'move' : 'ability' });
    sound.play('select');
  }

  /** A tap off the board, the trays and the bars cancels the selection (PRD T3). */
  function tapAway(event: MouseEvent<HTMLElement>) {
    if (!(event.target as Element).closest('button, [role="dialog"]')) setSelected(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && selected) {
      event.preventDefault();
      setSelected(null);
    }
  }

  return (
    <main className={`match${humanTurn ? ' human-turn' : ''}`} data-testid="match-screen" onClick={tapAway} onKeyDown={onKeyDown}>
      <h1 className="visually-hidden">Match</h1>
      <TopBar
        model={bar}
        view={view}
        onGoal={(opener) => onHowTo?.(opener, 'objective')}
        onMenu={(opener) => {
          setSelected(null);
          setMenu({ opener });
        }}
      />
      <div className="table" data-testid="table">
        <Toasts toasts={toasts} />
        <BotTray count={trays.showBot ? trays.botCount : 0} />
        <Board
          testId="board"
          board={view.board}
          human={HUMAN}
          fighters={view.fighters}
          ownTraps={new Set(view.ownTraps.map((trap) => trap.cell))}
          inspectedTraps={inspectedOwnTraps(view, HUMAN)}
          glowing={glowing}
          playable={playable}
          selected={selection?.fighter.id ?? null}
          lastMove={lastMove(view)}
          actions={selection?.fighter.cell ? { cell: selection.fighter.cell, buttons, mode: selection.mode, onPress: pressButton } : null}
          disabled={!humanTurn}
          onCellClick={tapCell}
        />
        <OwnTray
          tokens={trays.own}
          selected={selection?.fighter.id ?? null}
          playable={playable}
          disabled={!humanTurn}
          onSelect={(fighter) => (selection?.fighter.id === fighter ? setSelected(null) : select(fighter))}
        />
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
      </div>

      {menu && (
        <MenuDialog
          title="Menu"
          settings={settings}
          onSettings={(next) => onSettings?.(next)}
          onClose={() => setMenu(null)}
          returnFocusTo={menu.opener}
          onHowTo={onHowTo ? (opener) => onHowTo(opener) : undefined}
          onQuit={onLeave}
        />
      )}
    </main>
  );
}
