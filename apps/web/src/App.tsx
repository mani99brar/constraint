import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '@okiya/game';
import { DifficultyScreen } from './DifficultyScreen';
import { HowToPlay } from './HowToPlay';
import { howToOpensFirst, rememberHowToSeen } from './howto';
import { HUMAN, nextStarter, startGame } from './match';
import { MatchScreen } from './MatchScreen';
import { TWO_PLAYERS, versusBot, type GameMode } from './mode';
import { ModeScreen } from './ModeScreen';
import { loadResults, recordFinishedGame, resetResults, type Results } from './results';
import { clearSavedGame, loadSavedGame, saveGame, type SavedGame } from './save';
import { addResult, NO_SCORE, scoreAfter, type Score } from './score';
import { loadSettings, saveSettings, type Settings } from './settings';
import { browserAudioContext, createSoundPlayer } from './sound';
import { rememberStarter, starterForNewGame } from './starter';
import { browserStorage, type KeyValueStorage } from './storage';
import { TitleScreen } from './TitleScreen';

type Screen =
  | { readonly kind: 'title' }
  | { readonly kind: 'mode' }
  | { readonly kind: 'difficulty' }
  | { readonly kind: 'match'; readonly state: GameState; readonly mode: GameMode; readonly key: number };

export interface AppProps {
  /** Where settings, the saved game and the results live; the browser's `localStorage` by default. */
  readonly storage?: KeyValueStorage | null;
}

/**
 * The published game (PRD §5.7, §5.8): the title screen, New game (a mode, then for a bot game a
 * difficulty, then the board), the game with the score of its sitting, How to Play, the remembered
 * settings, the saved game and the results by difficulty.
 */
export function App({ storage: given }: AppProps) {
  const storage = useMemo(() => (given === undefined ? browserStorage() : given), [given]);
  const [settings, setSettings] = useState<Settings>(() => loadSettings(storage));
  const [results, setResults] = useState<Results>(() => loadResults(storage));
  const [saved, setSaved] = useState<SavedGame | null>(() => loadSavedGame(storage));
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const [score, setScoreState] = useState<Score>(NO_SCORE);
  const [howTo, setHowTo] = useState<{ opener: HTMLElement | null } | null>(() => (howToOpensFirst(storage) ? { opener: null } : null));
  const matchKey = useRef(0);
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

  function changeSettings(next: Settings) {
    setSettings(next);
    saveSettings(storage, next);
  }

  function closeHowTo() {
    rememberHowToSeen(storage);
    setHowTo(null);
  }

  /** Back to the title screen, which ends the sitting (PRD P3); the saved game stays for Continue. */
  function showTitle() {
    setScore(scoreAfter('leave', scoreRef.current));
    setSaved(loadSavedGame(storage));
    setResults(loadResults(storage));
    setScreen({ kind: 'title' });
  }

  function play(state: GameState, mode: GameMode) {
    rememberStarter(storage, state.starter);
    matchKey.current += 1;
    setScreen({ kind: 'match', state, mode, key: matchKey.current });
  }

  /** New game: a new sitting with its score at zero. */
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
    if (state.result) {
      clearSavedGame(storage);
      setScore(addResult(scoreRef.current, state.result));
      setResults(recordFinishedGame(storage, mode, state.result, HUMAN));
    } else {
      saveGame(storage, state, mode, scoreRef.current);
    }
  }

  let content;
  switch (screen.kind) {
    case 'mode':
      content = <ModeScreen onBack={showTitle} onVersusBot={() => setScreen({ kind: 'difficulty' })} onTwoPlayers={() => newGame(TWO_PLAYERS)} />;
      break;
    case 'difficulty':
      content = <DifficultyScreen onBack={() => setScreen({ kind: 'mode' })} onChoose={(difficulty) => newGame(versusBot(difficulty))} />;
      break;
    case 'match': {
      const { mode } = screen;
      content = (
        <MatchScreen
          key={screen.key}
          initialState={screen.state}
          mode={mode}
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
          onLeave={showTitle}
        />
      );
      break;
    }
    case 'title':
      content = (
        <TitleScreen
          saved={saved ? { mode: saved.mode, takes: saved.state.takes.length } : null}
          results={results}
          settings={settings}
          onContinue={() => {
            const current = loadSavedGame(storage);
            if (!current) return setSaved(null);
            setScore(current.score);
            play(current.state, current.mode);
          }}
          onNewGame={() => setScreen({ kind: 'mode' })}
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
