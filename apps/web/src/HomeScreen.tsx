import { useRef, useState, type KeyboardEvent } from 'react';
import { TILES, type Player } from '@okiya/game';
import { TileArt, TokenMark } from './art';
import { Avatar } from './Avatar';
import { DIFFICULTY_OPTIONS, type Difficulty } from './difficulty';
import { difficultyAfterKey, REPLACES_NOTE, type HomeModel } from './home';
import { MenuDialog } from './MenuDialog';
import type { Settings } from './settings';
import { TAGLINE, TITLE } from './title';

export interface HomeScreenProps {
  readonly model: HomeModel;
  readonly settings: Settings;
  readonly onContinue: () => void;
  readonly onPlayBot: (difficulty: Difficulty) => void;
  readonly onPlayTwo: () => void;
  readonly onDifficulty: (difficulty: Difficulty) => void;
  readonly onHowTo: (opener: HTMLElement) => void;
  readonly onResetResults: () => void;
  readonly onSettings: (settings: Settings) => void;
}

/** The hero's little board: a fixed deal of the 16 tiles with a few tokens on it, drawn with the tile art. */
const HERO_ORDER = [5, 10, 3, 12, 14, 0, 9, 7, 2, 13, 6, 11, 8, 1, 15, 4];
const HERO_TOKENS: Readonly<Record<number, Player>> = { 1: 'A', 6: 'B', 10: 'A', 13: 'B' };

function HeroBoard() {
  return (
    <div className="hero-board" data-testid="hero-board" aria-hidden="true">
      {HERO_ORDER.map((index, position) => {
        const tile = TILES[index]!;
        const token = HERO_TOKENS[position];
        return (
          <span key={position} className="hero-cell">
            {token ? (
              <span className={`token hero-token p${token === 'A' ? 1 : 2}`}>
                <TokenMark player={token} />
              </span>
            ) : (
              <TileArt terrain={tile.terrain} symbol={tile.symbol} />
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The difficulty switch (PRD S1): a radio group with one Tab stop, where the arrow keys move and select,
 * as a radio group does. The choice is remembered in the settings.
 */
function DifficultySwitch({ value, onChange }: { value: Difficulty; onChange: (difficulty: Difficulty) => void }) {
  const buttons = useRef(new Map<Difficulty, HTMLButtonElement>());
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = difficultyAfterKey(value, event.key);
    if (!next) return;
    event.preventDefault();
    onChange(next);
    buttons.current.get(next)?.focus();
  }
  return (
    <div className="difficulty-switch" role="radiogroup" aria-label="Bot difficulty" data-testid="difficulty-switch" data-value={value}>
      {DIFFICULTY_OPTIONS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={id === value}
          tabIndex={id === value ? 0 : -1}
          data-difficulty={id}
          ref={(element) => {
            if (element) buttons.current.set(id, element);
            else buttons.current.delete(id);
          }}
          onClick={() => onChange(id)}
          onKeyDown={onKeyDown}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * The home screen (PRD S1, E1, E5): a hero with the drawn wordmark over a board in its frame and both
 * avatars, Continue for a saved game, a Versus bot card with its remembered difficulty, a Two players
 * card, a compact results strip with its reset, and How to Play and Settings. One tap on Play starts a game.
 */
export function HomeScreen({ model, settings, onContinue, onPlayBot, onPlayTwo, onDifficulty, onHowTo, onResetResults, onSettings }: HomeScreenProps) {
  const [menu, setMenu] = useState<{ opener: HTMLElement } | null>(null);
  const difficulty = DIFFICULTY_OPTIONS.find((option) => option.id === model.difficulty)!;
  return (
    <main className="home" data-testid="home-screen">
      <header className="hero" data-testid="hero">
        <Avatar player="A" expression="to-move" testId="hero-avatar-A" />
        <div className="hero-centre">
          <h1 className="wordmark" data-testid="title">
            {TITLE}
          </h1>
          <HeroBoard />
        </div>
        <Avatar player="B" expression="idle" testId="hero-avatar-B" />
        <p className="tagline material-card">{TAGLINE}</p>
      </header>

      {model.continueGame && (
        <button type="button" className="primary continue" data-testid="continue" onClick={onContinue}>
          Continue
          <span className="menu-note">{model.continueGame.note}</span>
        </button>
      )}

      <div className="play-cards">
        <section className="play-card material-card" aria-labelledby="play-bot-title" data-testid="card-bot">
          <h2 id="play-bot-title">Versus bot</h2>
          <p className="card-note">You against the bot. {difficulty.description}</p>
          <DifficultySwitch value={model.difficulty} onChange={onDifficulty} />
          {model.replacesSaved && (
            <p className="replaces" id="play-bot-replaces" data-testid="replaces-bot">
              {REPLACES_NOTE}
            </p>
          )}
          <button
            type="button"
            className="primary play"
            data-testid="play-bot"
            aria-describedby={model.replacesSaved ? 'play-bot-replaces' : undefined}
            onClick={() => onPlayBot(model.difficulty)}
          >
            Play<span className="visually-hidden"> versus bot</span>
          </button>
        </section>
        <section className="play-card material-card" aria-labelledby="play-two-title" data-testid="card-two">
          <h2 id="play-two-title">Two players</h2>
          <p className="card-note">Player 1 and Player 2 take turns on this device.</p>
          {model.replacesSaved && (
            <p className="replaces" id="play-two-replaces" data-testid="replaces-two">
              {REPLACES_NOTE}
            </p>
          )}
          <button
            type="button"
            className="primary play"
            data-testid="play-two"
            aria-describedby={model.replacesSaved ? 'play-two-replaces' : undefined}
            onClick={onPlayTwo}
          >
            Play<span className="visually-hidden"> two players</span>
          </button>
        </section>
      </div>

      <section aria-labelledby="results-title" data-testid="results" className="results-strip material-card">
        <h2 id="results-title">Your results against the bot</h2>
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
            {model.results.map((row) => (
              <tr key={row.difficulty} data-difficulty={row.difficulty} data-wins={row.wins} data-losses={row.losses} data-draws={row.draws}>
                <th scope="row">{row.label}</th>
                <td>{row.wins}</td>
                <td>{row.losses}</td>
                <td>{row.draws}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" data-testid="reset-results" disabled={!model.canReset} onClick={onResetResults}>
          Reset
          <span className="visually-hidden"> results</span>
        </button>
      </section>

      <nav className="home-links" aria-label="More">
        <button type="button" data-testid="open-how-to-play" onClick={(event) => onHowTo(event.currentTarget)}>
          How to play
        </button>
        <button type="button" data-testid="open-settings" aria-haspopup="dialog" onClick={(event) => setMenu({ opener: event.currentTarget })}>
          Settings
        </button>
      </nav>

      {menu && <MenuDialog title="Settings" settings={settings} onSettings={onSettings} onClose={() => setMenu(null)} returnFocusTo={menu.opener} />}
    </main>
  );
}
