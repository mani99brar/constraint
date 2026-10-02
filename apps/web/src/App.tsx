import { useState, type FormEvent } from 'react';
import type { MatchState, PreparedMatch } from '@okiya/rules';
import { chooseSeed, createMatch, prepare, seedTextFromSearch } from './match';
import { MatchScreen } from './MatchScreen';
import { SetupScreen } from './SetupScreen';

type Screen =
  | { readonly kind: 'landing' }
  | { readonly kind: 'setup'; readonly prepared: PreparedMatch }
  | { readonly kind: 'match'; readonly state: MatchState };

/**
 * Landing page: start a match against the bot, with an optional seed from the field or `?seed=`.
 * Every match then goes through the setup screen.
 */
export function App() {
  const [seedText, setSeedText] = useState(() => seedTextFromSearch(window.location.search));
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'landing' });

  function start(event: FormEvent) {
    event.preventDefault();
    const choice = chooseSeed(seedText);
    if (!choice.ok) {
      setError(choice.error);
      return;
    }
    setError(null);
    setScreen({ kind: 'setup', prepared: prepare(choice.seed) });
  }

  const leave = () => setScreen({ kind: 'landing' });

  if (screen.kind === 'setup') {
    const { prepared } = screen;
    return (
      <SetupScreen
        prepared={prepared}
        onLeave={leave}
        onStart={(setup) => setScreen({ kind: 'match', state: createMatch(prepared, setup) })}
      />
    );
  }
  if (screen.kind === 'match') return <MatchScreen initialState={screen.state} onLeave={leave} />;

  return (
    <main className="landing">
      <h1>Okiya</h1>
      <p className="subtitle">Working title. One human against a bot on a 4×4 board of terrain/symbol tiles.</p>
      <form onSubmit={start} className="start-form">
        <label>
          Seed (optional)
          <input
            name="seed"
            inputMode="numeric"
            value={seedText}
            onChange={(event) => setSeedText(event.target.value)}
            placeholder="random"
          />
        </label>
        <button type="submit">Start match</button>
      </form>
      {error && (
        <p role="alert" className="refusal">
          {error}
        </p>
      )}
    </main>
  );
}
