import { useEffect, useRef, useState } from 'react';
import type { CellId, GameState } from '@okiya/game';
import { turnAnnouncement } from './announce';
import { Board } from './Board';
import { boardModel } from './boardModel';
import { EndScreen, SittingScore } from './EndScreen';
import { takeFeedback } from './feedback';
import { MatchCard } from './MatchCard';
import { matchCardModel } from './matchCard';
import { MenuDialog } from './MenuDialog';
import type { GameMode } from './mode';
import { lastEvent, type RefusalMark } from './reactions';
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
 * The table (PRD U1–U3, U9, U10, §5.8): the board with a slim nameplate for each player beside it, the
 * score of the sitting in one line between them, the Match card, a top bar with the menu button, a fixed
 * toast slot outside the board and, at the end, the result card beside the board (below it on a phone).
 * Every change of turn is announced through an `aria-live` region.
 */
export function MatchScreen(props: MatchScreenProps) {
  const { initialState, mode, score, settings, onSettings, sound = SILENT, onChange, onHowTo, onPlayAgain, onLeave } = props;
  const { state, attempt } = useGame(initialState, mode, onChange);
  const [menu, setMenu] = useState<{ opener: HTMLElement | null } | null>(null);
  const { toasts, push, afterTake } = useToasts();
  const heard = useRef(state.takes.length);
  // The takes on screen when the game was shown: a new or resumed game starts with no event (PRD U9).
  const [shownAtTakes] = useState(initialState.takes.length);
  const [refusal, setRefusal] = useState<RefusalMark | null>(null);

  useEffect(() => {
    // One sound per new take and the bot's take toast; a resumed game starts quiet.
    const feedback = takeFeedback(state, heard.current, mode);
    heard.current = state.takes.length;
    afterTake(feedback);
    if (feedback.sound) sound.play(feedback.sound);
  }, [state, mode, sound, afterTake]);

  const board = boardModel(state, { mode, highlights: settings.highlights, tileNames: settings.tileNames });
  // The avatars react to the last event, derived here from the takes and the refusals, never the board.
  const { event, key } = lastEvent(state, shownAtTakes, refusal);
  const [one, two] = seatModels(state, mode, score, event, key);

  function tapCell(cell: CellId) {
    const refused = attempt(cell);
    if (refused) {
      setRefusal((previous) => ({ by: state.toMove, atTakes: state.takes.length, count: (previous?.count ?? 0) + 1 }));
      push([refusalToast(describeRefusal(refused, state))]);
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
      <TopBar onMenu={(opener) => setMenu({ opener })} />
      <div className="side side-a">
        <Seat view={one} />
        <MatchCard model={matchCardModel(state)} />
      </div>
      <SittingScore score={score} mode={mode} />
      <div className="board-area" data-testid="table">
        <Board model={board} onCellClick={tapCell} />
      </div>
      <div className="side side-b">
        <Seat view={two} />
        <EndScreen state={state} mode={mode}>
          {onPlayAgain && (
            <button type="button" className="primary" data-testid="play-again" onClick={() => onPlayAgain(state)}>
              Play again
            </button>
          )}
          <button type="button" data-testid="end-home" onClick={onLeave}>
            Home
          </button>
        </EndScreen>
      </div>
      <Toasts toasts={toasts} />

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
