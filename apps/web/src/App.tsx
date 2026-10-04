import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '@okiya/game';
import { homeModel } from './home';
import { HomeScreen } from './HomeScreen';
import { HowToPlay } from './HowToPlay';
import { howToOpensFirst, rememberHowToSeen } from './howto';
import { HUMAN, nextStarter, startGame } from './match';
import { MatchScreen } from './MatchScreen';
import { twoPlayers, versusBot, type GameMode } from './mode';
import { clockSetup, type ClockTimes } from './clock';
import { loadResults, recordFinishedGame, resetResults, type Results } from './results';
import { clearSavedGame, loadSavedGame, saveGame, type SavedGame } from './save';
import { addResult, NO_SCORE, scoreAfter, type Score } from './score';
import { loadSettings, saveSettings, type Settings } from './settings';
import { browserAudioContext, createSoundPlayer } from './sound';
import { rememberStarter, starterForNewGame } from './starter';
import { browserStorage, type KeyValueStorage } from './storage';

type Screen =
  | { readonly kind: 'home' }
  | { readonly kind: 'match'; readonly state: GameState; readonly mode: GameMode; readonly key: number; readonly clockLeft: ClockTimes | null };

export interface AppProps {
  /** Where settings, the saved game and the results live; the browser's `localStorage` by default. */
  readonly storage?: KeyValueStorage | null;
}

/**
 * The published game (PRD §5.7, §5.8): the home screen, where one tap on Play starts the game its play
 * panel shows, a bot game at the remembered difficulty or a two-player game, the game with the score of its sitting, How to Play, the
 * remembered settings, the saved game and the results by difficulty.
 */
export function App({ storage: given }: AppProps) {
  const storage = useMemo(() => (given === undefined ? browserStorage() : given), [given]);
  const [settings, setSettings] = useState<Settings>(() => loadSettings(storage));
  const [results, setResults] = useState<Results>(() => loadResults(storage));
  const [saved, setSaved] = useState<SavedGame | null>(() => loadSavedGame(storage));
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [score, setScoreState] = useState<Score>(NO_SCORE);
  const [howTo, setHowTo] = useState<{ opener: HTMLElement | null } | null>(() => (howToOpensFirst(storage) ? { opener: null } : null));
  const matchKey = useRef(0);
  // A timed game's clocks are read when the game is saved: after every take, on leaving and when the page hides.
  const readClock = useRef<(() => ClockTimes | null) | null>(null);
  const running = useRef<{ state: GameState; mode: GameMode } | null>(null);
  const onClockReader = useMemo(() => (read: () => ClockTimes | null) => {
    readClock.current = read;
  }, []);
  // The score is read when a game reports a new state, so it lives in a ref beside its state.
  const scoreRef = useRef(score);
  const setScore = (next: Score) => {
    scoreRef.current = next;
    setScoreState(next);
  };

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sound = useMemo(() => createSoundPlayer({ createContext: browserAudioContext, muted: () => !settingsRef.current.sound }), []);

  useEffect(() => {
    // Sound may start only inside a user gesture's own handler (PRD E4). A touch activates the
    // page on pointerup and touchend, not on pointerdown, so all of them unlock.
    const unlock = () => sound.unlock();
    const gestures = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;
    for (const gesture of gestures) window.addEventListener(gesture, unlock, true);
    return () => {
      for (const gesture of gestures) window.removeEventListener(gesture, unlock, true);
    };
  }, [sound]);

  useEffect(() => {
    // The colour theme (PRD U5): index.html sets it before the first paint; a new choice applies at once.
    document.documentElement.setAttribute('data-palette', settings.palette);
  }, [settings.palette]);

  function changeSettings(next: Settings) {
    settingsRef.current = next;
    setSettings(next);
    saveSettings(storage, next);
  }

  function closeHowTo() {
    rememberHowToSeen(storage);
    setHowTo(null);
  }

  /** Saves the running game again with its clocks as they stand now. */
  function saveClocks() {
    const current = running.current;
    if (current && !current.state.result && readClock.current?.()) saveGame(storage, current.state, current.mode, scoreRef.current, readClock.current());
  }

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') saveClocks();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', saveClocks);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', saveClocks);
    };
  });

  /** Back to the home screen, which ends the sitting (PRD P3); the saved game stays for Continue. */
  function showHome() {
    saveClocks();
    running.current = null;
    readClock.current = null;
    setScore(scoreAfter('leave', scoreRef.current));
    setSaved(loadSavedGame(storage));
    setResults(loadResults(storage));
    setScreen({ kind: 'home' });
  }

  function play(state: GameState, mode: GameMode, clockLeft: ClockTimes | null = null) {
    rememberStarter(storage, state.starter);
    matchKey.current += 1;
    running.current = { state, mode };
    setScreen({ kind: 'match', state, mode, key: matchKey.current, clockLeft });
  }

  /** A game started from the home screen: a new sitting with its score at zero. */
  function newGame(mode: GameMode) {
    sound.play('select');
    setScore(scoreAfter('new-game', scoreRef.current));
    play(startGame(undefined, starterForNewGame(storage)), mode);
  }

  /**
   * Saves the running game with the score after every take; a finished one is removed, added to the
   * score of the sitting once, and counted in the results when it was a bot game.
   */
  function gameChanged(state: GameState, mode: GameMode) {
    running.current = { state, mode };
    if (state.result) {
      clearSavedGame(storage);
      setScore(addResult(scoreRef.current, state.result));
      setResults(recordFinishedGame(storage, mode, state.result, HUMAN));
    } else {
      saveGame(storage, state, mode, scoreRef.current, readClock.current?.() ?? null);
    }
  }

  let content;
  switch (screen.kind) {
    case 'match': {
      const { mode } = screen;
      content = (
        <MatchScreen
          key={screen.key}
          initialState={screen.state}
          mode={mode}
          clockLeft={screen.clockLeft}
          onClockReader={onClockReader}
          score={score}
          settings={settings}
          onSettings={changeSettings}
          sound={sound}
          onChange={(state) => gameChanged(state, mode)}
          onHowTo={(opener) => setHowTo({ opener })}
          onPlayAgain={(finished) => {
            sound.play('select');
            setScore(scoreAfter('play-again', scoreRef.current));
            play(startGame(undefined, nextStarter(finished)), mode);
          }}
          onLeave={showHome}
        />
      );
      break;
    }
    case 'home':
      content = (
        <HomeScreen
          model={homeModel(saved ? { mode: saved.mode, takes: saved.state.takes.length } : null, settings, results)}
          settings={settings}
          onContinue={() => {
            const current = loadSavedGame(storage);
            if (!current) return setSaved(null);
            setScore(current.score);
            play(current.state, current.mode, current.clockLeft);
          }}
          onPlay={() => {
            const { opponent, difficulty, clockA, clockB } = settingsRef.current;
            newGame(opponent === 'bot' ? versusBot(difficulty) : twoPlayers(clockSetup(clockA, clockB)));
          }}
          onOpponent={(opponent) => changeSettings({ ...settingsRef.current, opponent })}
          onDifficulty={(difficulty) => changeSettings({ ...settingsRef.current, difficulty })}
          onClock={(player, choice) => changeSettings({ ...settingsRef.current, ...(player === 'A' ? { clockA: choice } : { clockB: choice }) })}
          onHowTo={(opener) => setHowTo({ opener })}
          onResetResults={() => setResults(resetResults(storage))}
          onSettings={changeSettings}
        />
      );
      break;
  }

  return (
    <>
      <div className="app" inert={howTo !== null}>
        {content}
      </div>
      {howTo && <HowToPlay onClose={closeHowTo} returnFocusTo={howTo.opener} />}
    </>
  );
}
