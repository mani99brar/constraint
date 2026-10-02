import { useState, type FormEvent } from 'react';
import type { MatchState } from '@okiya/rules';
import { createMatch, generateSeed, parseSeed } from './match';
import { MatchScreen } from './MatchScreen';

/** Landing page: start a match against the bot, with an optional seed from the field or `?seed=`. */
export function App() {
  const [seedText, setSeedText] = useState(() => new URLSearchParams(window.location.search).get('seed') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);

  function start(event: FormEvent) {
    event.preventDefault();
    const seed = seedText.trim() === '' ? generateSeed() : parseSeed(seedText);
    if (seed === null) {
      setError('The seed must be a whole number from 0 to 4294967295.');
      return;
    }
    setError(null);
    setMatch(createMatch(seed));
  }

  if (match) return <MatchScreen initialState={match} onLeave={() => setMatch(null)} />;

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
