import { useEffect, useRef, useState } from 'react';
import type { CellId, GameState } from '@okiya/game';
import { turnAnnouncement } from './announce';
import { TerrainScene } from './art';
import { Board } from './Board';
import { boardModel } from './boardModel';
import { EndScreen } from './EndScreen';
import { endShrinking, END_SHRINK_LIMIT_MS } from './end';
import { takeFeedback } from './feedback';
import { MatchCard } from './MatchCard';
import { matchCardModel } from './matchCard';
import { MenuDialog } from './MenuDialog';
import { clockOf, type GameMode } from './mode';
import type { ClockTimes } from './clock';
import { lastEvent, type RefusalMark } from './reactions';
import { scoreboardModel, type Score } from './score';
import { Scoreboard } from './Scoreboard';
import { Seat } from './Seat';
import { seatModels } from './seats';
import type { Settings } from './settings';
import type { SoundPlayer } from './sound';
import { describeRefusal, shortRefusal } from './text';
import { refusalToast } from './toasts';
import { Toasts } from './Toasts';
import { TopBar } from './TopBar';
import { Countdown } from './Countdown';
import { NO_HAPTICS, type HapticsPlayer } from './haptics';
import { useClock } from './useClock';
import { useCountdown } from './useCountdown';
import { useGame } from './useGame';
import { useToasts } from './useToasts';

const TERRAINS = ['Forest', 'Water', 'Mountain', 'Desert'] as const;

const SILENT: SoundPlayer = { unlock: () => {}, play: () => false };

export interface MatchScreenProps {
  readonly initialState: GameState;
  readonly mode: GameMode;
  /** The score of the sitting, this game's result included once it has ended. */
  readonly score: Score;
  readonly settings: Settings;
  readonly onSettings?: (settings: Settings) => void;
  readonly sound?: SoundPlayer;
  /** Haptics for the same moments as the sounds, plus the countdown's ticks; none by default. */
  readonly haptics?: HapticsPlayer;
  /** Hears every new state once, to save the game, count its result and update the score. */
  readonly onChange?: (state: GameState) => void;
  readonly onHowTo?: (opener: HTMLElement) => void;
  /** Play again: a new game in the same mode, the other player starting, the score kept. */
  readonly onPlayAgain?: (finished: GameState) => void;
  readonly onLeave: () => void;
  /** A timed game's time left when it was resumed; its starting times when not given. */
  readonly clockLeft?: ClockTimes | null;
  /** Hands over a reader of the clocks' time left, so the game can be saved with it. */
  readonly onClockReader?: (read: () => ClockTimes | null) => void;
  /** A new game opens with a short 3, 2, 1 countdown: no takes, no bot and no clocks until it ends. */
  readonly countdown?: boolean;
}

/**
 * The table (PRD U1–U3, U9, U10, §5.8): the board with a slim nameplate for each player beside it, the
 * scoreboard row above it (each seat's score either side of the Match card, the draws under it), a top bar
 * with the menu button, toasts outside the board and, at the end, the result card beside the board (below
 * it on a phone, where the board shrinks to make room while the end sequence plays). Every change of turn
 * is announced through an `aria-live` region.
 */
export function MatchScreen(props: MatchScreenProps) {
  const { initialState, mode, score, settings, onSettings, sound = SILENT, haptics = NO_HAPTICS, onChange, onHowTo, onPlayAgain, onLeave, clockLeft, onClockReader, countdown = false } = props;
  const start = useCountdown(countdown && initialState.takes.length === 0 && !initialState.result);
  const { state, attempt, timeOut } = useGame(initialState, mode, onChange, start.counting);
  const [menu, setMenu] = useState<{ opener: HTMLElement | null } | null>(null);
  // A timed game's clocks: the mover's runs, none while the menu is open; running out of time loses.
  const [clockStart] = useState(() => clockLeft ?? clockOf(mode));
  const clock = useClock(clockStart, state, menu !== null || start.counting, timeOut);
  const readClock = useRef(clock.read);
  readClock.current = clock.read;
  useEffect(() => onClockReader?.(() => readClock.current()), [onClockReader]);
  const { toasts, push, afterTake } = useToasts();
  const heard = useRef(state.takes.length);
  // The takes on screen when the game was shown: a new or resumed game starts with no event (PRD U9).
  const [shownAtTakes] = useState(initialState.takes.length);
  const [refusal, setRefusal] = useState<RefusalMark | null>(null);
  // The phone's end shrink may run only while the end sequence plays, never for a game shown ended or after it.
  const [endedAtStart] = useState(initialState.result !== null);
  const [shrinkDone, setShrinkDone] = useState(false);
  const ended = state.result !== null;
  const shrinking = endShrinking(ended, endedAtStart, shrinkDone);

  useEffect(() => {
    if (!shrinking) return;
    const timer = setTimeout(() => setShrinkDone(true), END_SHRINK_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [shrinking]);

  useEffect(() => {
    // One sound per new take and the bot's take toast; a resumed game starts quiet.
    const feedback = takeFeedback(state, heard.current, mode);
    heard.current = state.takes.length;
    afterTake(feedback);
    if (feedback.sound) {
      sound.play(feedback.sound);
      haptics.play(feedback.sound);
    }
  }, [state, mode, sound, haptics, afterTake]);

  // The countdown ticks once for each of 3, 2, 1 and gives a firmer one when the game starts.
  const counted = useRef(start.count);
  useEffect(() => {
    if (start.count === counted.current) return;
    counted.current = start.count;
    haptics.play(start.count > 0 ? 'tick' : 'go');
  }, [start.count, haptics]);

  const board = boardModel(state, { mode, highlights: settings.highlights, tileNames: settings.tileNames, waiting: start.counting });
  // The avatars react to the last event, derived here from the takes and the refusals, never the board.
  const { event, key } = lastEvent(state, shownAtTakes, refusal);
  const [one, two] = seatModels(state, mode, score, event, key, clock.times ? { times: clock.times, running: clock.running } : null, start.counting);

  function tapCell(cell: CellId) {
    const refused = attempt(cell);
    if (refused) {
      setRefusal((previous) => ({ by: state.toMove, atTakes: state.takes.length, count: (previous?.count ?? 0) + 1 }));
      push([refusalToast(describeRefusal(refused, state), shortRefusal(refused))]);
      sound.play('refuse');
      haptics.play('refuse');
    }
  }

  const cardModel = matchCardModel(state);
  return (
    <main
      className={`match${state.result ? ' ended' : ''}`}
      data-testid="match-screen"
      data-mode={mode.kind}
      data-to-move={state.toMove}
      data-starter={state.starter}
      data-takes={state.takes.length}
      data-accepts-takes={board.acceptsTakes}
      data-ended={ended}
      data-end-shrinking={shrinking || undefined}
      data-timed={clockStart !== null || undefined}
      data-starting={start.counting || undefined}
      data-backdrop={settings.backdrop}
      data-scene-motion={settings.sceneMotion}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === '--board-size') setShrinkDone(true);
      }}
    >
      {settings.backdrop && (
        <div className="backdrop" aria-hidden="true" data-testid="backdrop" data-terrain={cardModel.terrain ?? undefined}>
          {TERRAINS.map((terrain) => (
            <div key={terrain} className={`backdrop-layer terrain-${terrain.toLowerCase()}`} data-layer={terrain}>
              <TerrainScene terrain={terrain} />
            </div>
          ))}
        </div>
      )}
      <h1 className="visually-hidden">Game</h1>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="announcer">
        {turnAnnouncement(state, mode)}
      </p>
      <Scoreboard model={scoreboardModel(score, mode)}>
        <MatchCard model={cardModel} />
      </Scoreboard>
      <TopBar onMenu={(opener) => setMenu({ opener })} />
      <div className="side side-a">
        <Seat view={one} />
      </div>
      <div className="board-area" data-testid="table">
        <Board model={board} onCellClick={tapCell} />
        {start.counting && <Countdown count={start.count} onSkip={start.skip} />}
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
          haptics={haptics}
          onHowTo={onHowTo}
          onQuit={onLeave}
        />
      )}
    </main>
  );
}
