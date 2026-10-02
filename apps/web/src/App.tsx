import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchState, PreparedMatch } from '@okiya/rules';
import type { BotDepthId } from './difficulty';
import { DifficultyScreen } from './DifficultyScreen';
import { HowToPlay } from './HowToPlay';
import { howToOpensFirst, rememberHowToSeen, type HowToSection } from './howto';
import { createMatch, HUMAN, prepare } from './match';
import { MatchScreen } from './MatchScreen';
import { loadResults, outcomeOf, recordResult, resetResults, type Results } from './results';
import { clearSavedMatch, loadSavedMatch, saveMatch, type SavedMatch } from './save';
import { loadSettings, saveSettings, type Settings } from './settings';
import { SetupScreen } from './SetupScreen';
import { browserAudioContext, createSoundPlayer } from './sound';
import { browserStorage, type KeyValueStorage } from './storage';
import { TitleScreen } from './TitleScreen';

type Screen =
  | { readonly kind: 'title' }
  | { readonly kind: 'difficulty' }
  | { readonly kind: 'setup'; readonly prepared: PreparedMatch; readonly depth: BotDepthId }
  | { readonly kind: 'match'; readonly state: MatchState; readonly depth: BotDepthId; readonly key: number };

export interface AppProps {
  /** Where settings, the saved match and the results live; the browser's `localStorage` by default. */
  readonly storage?: KeyValueStorage | null;
}

/**
 * The published game (PRD §5.8): the title screen, New game (difficulty, then setup), the match,
 * How to Play, the remembered settings, the saved match and the results by difficulty.
 */
export function App({ storage: given }: AppProps) {
  const storage = useMemo(() => (given === undefined ? browserStorage() : given), [given]);
  const [settings, setSettings] = useState<Settings>(() => loadSettings(storage));
  const [results, setResults] = useState<Results>(() => loadResults(storage));
  const [saved, setSaved] = useState<SavedMatch | null>(() => loadSavedMatch(storage));
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const [howTo, setHowTo] = useState<{ opener: HTMLElement | null; section?: HowToSection['id'] | undefined } | null>(() =>
    howToOpensFirst(storage) ? { opener: null } : null,
  );
  const matchKey = useRef(0);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sound = useMemo(() => createSoundPlayer({ createContext: browserAudioContext, muted: () => !settingsRef.current.sound }), []);

  useEffect(() => {
    // Sound may start only inside a user gesture's own handler (PRD E5). A touch activates the
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

  function openHowTo(opener: HTMLElement, section?: HowToSection['id']) {
    setHowTo({ opener, section });
  }

  function closeHowTo() {
    rememberHowToSeen(storage);
    setHowTo(null);
  }

  function showTitle() {
    setSaved(loadSavedMatch(storage));
    setResults(loadResults(storage));
    setScreen({ kind: 'title' });
  }

  function play(state: MatchState, depth: BotDepthId) {
    matchKey.current += 1;
    setScreen({ kind: 'match', state, depth, key: matchKey.current });
  }

  /** Saves the running match after every action; a finished one is removed and counted once. */
  function matchChanged(state: MatchState, depth: BotDepthId) {
    if (state.result) {
      clearSavedMatch(storage);
      setResults(recordResult(storage, depth, outcomeOf(state.result, HUMAN)));
    } else {
      saveMatch(storage, state, depth);
    }
  }

  let content;
  switch (screen.kind) {
    case 'difficulty':
      content = (
        <DifficultyScreen
          onBack={showTitle}
          onChoose={(depth) => {
            sound.play('select');
            setScreen({ kind: 'setup', prepared: prepare(), depth });
          }}
        />
      );
      break;
    case 'setup': {
      const { prepared, depth } = screen;
      content = (
        <SetupScreen
          prepared={prepared}
          depth={depth}
          onHowTo={openHowTo}
          onLeave={() => setScreen({ kind: 'difficulty' })}
          onStart={(setup) => {
            sound.play('select');
            play(createMatch(prepared, setup), depth);
          }}
        />
      );
      break;
    }
    case 'match': {
      const { depth } = screen;
      content = (
        <MatchScreen
          key={screen.key}
          initialState={screen.state}
          depth={depth}
          settings={settings}
          onSettings={changeSettings}
          sound={sound}
          onChange={(state) => matchChanged(state, depth)}
          onHowTo={openHowTo}
          onNewGame={() => setScreen({ kind: 'difficulty' })}
          onLeave={showTitle}
        />
      );
      break;
    }
    case 'title':
      content = (
        <TitleScreen
          saved={saved ? { depth: saved.depth, turn: saved.state.turn } : null}
          results={results}
          settings={settings}
          onContinue={() => {
            const current = loadSavedMatch(storage);
            if (current) play(current.state, current.depth);
            else setSaved(null);
          }}
          onNewGame={() => setScreen({ kind: 'difficulty' })}
          onHowTo={openHowTo}
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
      {howTo && <HowToPlay onClose={closeHowTo} returnFocusTo={howTo.opener} section={howTo.section} />}
    </>
  );
}
