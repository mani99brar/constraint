import { useEffect, useRef, useState } from 'react';
import type { CellId, GameState } from '@okiya/game';
import { turnAnnouncement } from './announce';
import { Board } from './Board';
import { boardModel } from './boardModel';
import { EndScreen, SittingScore } from './EndScreen';
import { takeFeedback } from './feedback';
import { matchCardModel } from './matchCard';
import { MenuDialog } from './MenuDialog';
import type { GameMode } from './mode';
import type { Score } from './score';
import { Seat } from './Seat';
import { seatModels } from './seats';
import type { Settings } from './settings';
import type { SoundPlayer } from './sound';
import { describeRefusal } from './text';
import { refusalToast } from './toasts';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
import { useGame } from './useGame';
import { useToasts } from './useToasts';

const SILENT: SoundPlayer = { unlock: () => {}, play: () => false };

export interface MatchScreenProps {
  readonly initialState: GameState;
  readonly mode: GameMode;
  /** The score of the sitting, this game's result included once it has ended. */
  readonly score: Score;
  readonly settings: Settings;
  readonly onSettings?: (settings: Settings) => void;
  readonly sound?: SoundPlayer;
  /** Hears every new state once, to save the game, count its result and update the score. */
  readonly onChange?: (state: GameState) => void;
  readonly onHowTo?: (opener: HTMLElement) => void;
  /** Play again: a new game in the same mode, the other player starting, the score kept. */
  readonly onPlayAgain?: (finished: GameState) => void;
  readonly onLeave: () => void;
}

/**
 * The table (PRD U1–U3, §5.8): the board with a seat for each player beside it, the Match card, a top
 * bar with the menu button, toasts over the board and the end screen under it. Every change of turn is
 * announced through an `aria-live` region.
 */
export function MatchScreen(props: MatchScreenProps) {
  const { initialState, mode, score, settings, onSettings, sound = SILENT, onChange, onHowTo, onPlayAgain, onLeave } = props;
  const { state, attempt } = useGame(initialState, mode, onChange);
  const [menu, setMenu] = useState<{ opener: HTMLElement | null } | null>(null);
  const { toasts, push, afterTake } = useToasts();
  const heard = useRef(state.takes.length);

  useEffect(() => {
    // One sound per new take and the bot's take toast; a resumed game starts quiet.
    const feedback = takeFeedback(state, heard.current, mode);
    heard.current = state.takes.length;
    afterTake(feedback);
    if (feedback.sound) sound.play(feedback.sound);
  }, [state, mode, sound, afterTake]);

  const board = boardModel(state, { mode, highlights: settings.highlights });
  const [one, two] = seatModels(state, mode, score);

  function tapCell(cell: CellId) {
    const refusal = attempt(cell);
    if (refusal) {
      push([refusalToast(describeRefusal(refusal, state))]);
      sound.play('refuse');
    }
  }

  return (
    <main
      className={`match${state.result ? ' ended' : ''}`}
      data-testid="match-screen"
      data-mode={mode.kind}
      data-to-move={state.toMove}
      data-starter={state.starter}
      data-takes={state.takes.length}
      data-accepts-takes={board.acceptsTakes}
      data-ended={state.result !== null}
    >
      <h1 className="visually-hidden">Game</h1>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="announcer">
        {turnAnnouncement(state, mode)}
      </p>
      <TopBar card={matchCardModel(state)} onMenu={(opener) => setMenu({ opener })} />
      <Seat view={one} />
      <div className="board-area" data-testid="table">
        <Toasts toasts={toasts} />
        <Board model={board} onCellClick={tapCell} />
      </div>
      <Seat view={two} />
      <SittingScore score={score} mode={mode} />
      <EndScreen state={state} mode={mode}>
        {onPlayAgain && (
          <button type="button" className="primary" data-testid="play-again" onClick={() => onPlayAgain(state)}>
            Play again
          </button>
        )}
        <button type="button" data-testid="end-title" onClick={onLeave}>
          Title screen
        </button>
      </EndScreen>

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
