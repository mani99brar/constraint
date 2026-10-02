import { useState } from 'react';
import { Logo } from './art';
import { DIFFICULTY_OPTIONS, difficultyLabel, type Difficulty } from './difficulty';
import { MenuDialog } from './MenuDialog';
import type { Results } from './results';
import type { Settings } from './settings';
import { TAGLINE, TITLE } from './title';

export interface TitleScreenProps {
  /** The saved unfinished game, if any: its difficulty and how many tiles were taken. */
  readonly saved: { readonly difficulty: Difficulty; readonly takes: number } | null;
  readonly results: Results;
  readonly settings: Settings;
  readonly onContinue: () => void;
  readonly onNewGame: () => void;
  readonly onHowTo: (opener: HTMLElement) => void;
  readonly onResetResults: () => void;
  readonly onSettings: (settings: Settings) => void;
}

/** The title screen (PRD E1): Continue, New game, How to play, results by difficulty and a settings menu. */
export function TitleScreen({ saved, results, settings, onContinue, onNewGame, onHowTo, onResetResults, onSettings }: TitleScreenProps) {
  const [menu, setMenu] = useState<{ opener: HTMLElement } | null>(null);
  const played = DIFFICULTY_OPTIONS.some(({ id }) => results[id].wins + results[id].losses + results[id].draws > 0);
  return (
    <main className="title-screen" data-testid="title-screen">
      <div className="hero">
        <Logo size={88} />
        <div>
          <h1 data-testid="title">{TITLE}</h1>
          <p className="tagline">{TAGLINE}</p>
        </div>
      </div>

      <nav className="main-menu" aria-label="Main menu">
        {saved && (
          <button type="button" className="primary" data-testid="continue" onClick={onContinue}>
            Continue
            <span className="menu-note">
              {difficultyLabel(saved.difficulty)} bot, {saved.takes} {saved.takes === 1 ? 'tile' : 'tiles'} taken
            </span>
          </button>
        )}
        <button type="button" className={saved ? '' : 'primary'} data-testid="new-game" onClick={onNewGame}>
          New game
          {saved && <span className="menu-note">replaces the saved game</span>}
        </button>
        <button type="button" data-testid="open-how-to-play" onClick={(event) => onHowTo(event.currentTarget)}>
          How to play
        </button>
        <button type="button" data-testid="open-settings" aria-haspopup="dialog" onClick={(event) => setMenu({ opener: event.currentTarget })}>
          Settings
        </button>
      </nav>

      <section aria-labelledby="results-title" data-testid="results" className="card results">
        <h2 id="results-title">Your results</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Bot</th>
              <th scope="col">Wins</th>
              <th scope="col">Losses</th>
              <th scope="col">Draws</th>
            </tr>
          </thead>
          <tbody>
            {DIFFICULTY_OPTIONS.map(({ id, label }) => (
              <tr key={id} data-difficulty={id} data-wins={results[id].wins} data-losses={results[id].losses} data-draws={results[id].draws}>
                <th scope="row">{label}</th>
                <td>{results[id].wins}</td>
                <td>{results[id].losses}</td>
                <td>{results[id].draws}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="help">Kept in this browser only.</p>
        <button type="button" data-testid="reset-results" disabled={!played} onClick={onResetResults}>
          Reset results
        </button>
      </section>

      {menu && <MenuDialog title="Settings" settings={settings} onSettings={onSettings} onClose={() => setMenu(null)} returnFocusTo={menu.opener} />}
    </main>
  );
}
