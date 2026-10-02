import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '@okiya/game';
import type { Difficulty } from './difficulty';
import { DifficultyScreen } from './DifficultyScreen';
import { HowToPlay } from './HowToPlay';
import { howToOpensFirst, rememberHowToSeen } from './howto';
import { HUMAN, nextStarter, startGame } from './match';
import { rememberStarter, starterForNewGame } from './starter';
import { MatchScreen } from './MatchScreen';
import { loadResults, outcomeOf, recordResult, resetResults, type Results } from './results';
import { clearSavedGame, loadSavedGame, saveGame, type SavedGame } from './save';
import { loadSettings, saveSettings, type Settings } from './settings';
import { browserAudioContext, createSoundPlayer } from './sound';
import { browserStorage, type KeyValueStorage } from './storage';
import { TitleScreen } from './TitleScreen';

type Screen =
  | { readonly kind: 'title' }
  | { readonly kind: 'difficulty' }
  | { readonly kind: 'match'; readonly state: GameState; readonly difficulty: Difficulty; readonly key: number };

export interface AppProps {
  /** Where settings, the saved game and the results live; the browser's `localStorage` by default. */
  readonly storage?: KeyValueStorage | null;
}

/**
 * The published game (PRD §5.7): the title screen, New game (a difficulty, then the board), the
 * game, How to Play, the remembered settings, the saved game and the results by difficulty.
 */
export function App({ storage: given }: AppProps) {
  const storage = useMemo(() => (given === undefined ? browserStorage() : given), [given]);
  const [settings, setSettings] = useState<Settings>(() => loadSettings(storage));
  const [results, setResults] = useState<Results>(() => loadResults(storage));
  const [saved, setSaved] = useState<SavedGame | null>(() => loadSavedGame(storage));
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const [howTo, setHowTo] = useState<{ opener: HTMLElement | null } | null>(() => (howToOpensFirst(storage) ? { opener: null } : null));
  const matchKey = useRef(0);

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

  function showTitle() {
    setSaved(loadSavedGame(storage));
    setResults(loadResults(storage));
    setScreen({ kind: 'title' });
  }

  function play(state: GameState, difficulty: Difficulty) {
    rememberStarter(storage, state.starter);
    matchKey.current += 1;
    setScreen({ kind: 'match', state, difficulty, key: matchKey.current });
  }

  /** Saves the running game after every take; a finished one is removed and counted once. */
  function gameChanged(state: GameState, difficulty: Difficulty) {
    if (state.result) {
      clearSavedGame(storage);
      setResults(recordResult(storage, difficulty, outcomeOf(state.result, HUMAN)));
    } else {
      saveGame(storage, state, difficulty);
    }
  }

  let content;
  switch (screen.kind) {
    case 'difficulty':
      content = (
        <DifficultyScreen
          onBack={showTitle}
          onChoose={(difficulty) => {
            sound.play('select');
            play(startGame(undefined, starterForNewGame(storage)), difficulty);
          }}
        />
      );
      break;
    case 'match': {
      const { difficulty } = screen;
      content = (
        <MatchScreen
          key={screen.key}
          initialState={screen.state}
          difficulty={difficulty}
          settings={settings}
          onSettings={changeSettings}
          sound={sound}
          onChange={(state) => gameChanged(state, difficulty)}
          onHowTo={(opener) => setHowTo({ opener })}
          onPlayAgain={(finished) => {
            sound.play('select');
            play(startGame(undefined, nextStarter(finished)), difficulty);
          }}
          onLeave={showTitle}
        />
      );
      break;
    }
    case 'title':
      content = (
        <TitleScreen
          saved={saved ? { difficulty: saved.difficulty, takes: saved.state.takes.length } : null}
          results={results}
          settings={settings}
          onContinue={() => {
            const current = loadSavedGame(storage);
            if (current) play(current.state, current.difficulty);
            else setSaved(null);
          }}
          onNewGame={() => setScreen({ kind: 'difficulty' })}
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
