import { useEffect, useRef, useState } from 'react';
import type { CellId, GameState } from '@okiya/game';
import { Board } from './Board';
import { boardModel } from './boardModel';
import type { Difficulty } from './difficulty';
import { EndScreen } from './EndScreen';
import { takeFeedback } from './feedback';
import { HUMAN } from './match';
import { MenuDialog } from './MenuDialog';
import type { Settings } from './settings';
import type { SoundPlayer } from './sound';
import { describeRefusal } from './text';
import { refusalToast } from './toasts';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
import { topBarModel } from './topbar';
import { useGame } from './useGame';
import { useToasts } from './useToasts';

const SILENT: SoundPlayer = { unlock: () => {}, play: () => false };

export interface MatchScreenProps {
  readonly initialState: GameState;
  readonly difficulty: Difficulty;
  readonly settings: Settings;
  readonly onSettings?: (settings: Settings) => void;
  readonly sound?: SoundPlayer;
  /** Hears every new state once, to save the game or record its result. */
  readonly onChange?: (state: GameState) => void;
  readonly onHowTo?: (opener: HTMLElement) => void;
  /** Play again: a new game at the same difficulty, the other player starting. */
  readonly onPlayAgain?: (finished: GameState) => void;
  readonly onLeave: () => void;
}

/**
 * The tabletop (PRD U1–U4): the top bar and the board, with toasts over the board and the menu as a
 * dialog. Nothing else is on screen until the game ends.
 */
export function MatchScreen(props: MatchScreenProps) {
  const { initialState, difficulty, settings, onSettings, sound = SILENT, onChange, onHowTo, onPlayAgain, onLeave } = props;
  const { state, attempt } = useGame(initialState, difficulty, onChange);
  const [menu, setMenu] = useState<{ opener: HTMLElement | null } | null>(null);
  const { toasts, push } = useToasts();
  const heard = useRef(state.takes.length);

  useEffect(() => {
    // One sound per new take, and a toast at the end; a resumed game starts quiet.
    const feedback = takeFeedback(state, heard.current, HUMAN);
    heard.current = state.takes.length;
    push(feedback.toasts);
    if (feedback.sound) sound.play(feedback.sound);
  }, [state, sound, push]);

  const board = boardModel(state, { human: HUMAN, highlights: settings.highlights });
  const bar = topBarModel(state, HUMAN);

  function tapCell(cell: CellId) {
    const refusal = attempt(cell);
    if (refusal) {
      push([refusalToast(describeRefusal(refusal, state))]);
      sound.play('refuse');
    }
  }

  return (
    <main className={`match${bar.humanTurn ? ' human-turn' : ''}${state.result ? ' ended' : ''}`} data-testid="match-screen">
      <h1 className="visually-hidden">Game</h1>
      <TopBar model={bar} state={state} onMenu={(opener) => setMenu({ opener })} />
      <div className="table" data-testid="table">
        <Toasts toasts={toasts} />
        <Board model={board} onCellClick={tapCell} />
        <EndScreen state={state} human={HUMAN}>
          {onPlayAgain && (
            <button type="button" className="primary" data-testid="play-again" onClick={() => onPlayAgain(state)}>
              Play again
            </button>
          )}
          <button type="button" data-testid="end-title" onClick={onLeave}>
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
          onHowTo={onHowTo}
          onQuit={onLeave}
        />
      )}
    </main>
  );
}
