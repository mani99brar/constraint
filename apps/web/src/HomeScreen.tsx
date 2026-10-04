import { useState } from 'react';
import { TILES, type Player } from '@okiya/game';
import { TileArt, TokenMark } from './art';
import { Avatar } from './Avatar';
import { DIFFICULTY_OPTIONS, type Difficulty } from './difficulty';
import type { ClockChoice } from './clock';
import { ClockSlider } from './ClockSlider';
import { difficultyAfterKey, opponentAfterKey, REPLACES_NOTE, type HomeModel } from './home';
import { MenuDialog } from './MenuDialog';
import { RadioSwitch } from './RadioSwitch';
import { OPPONENTS, type Opponent, type Settings } from './settings';
import { TITLE } from './title';

export interface HomeScreenProps {
  readonly model: HomeModel;
  readonly settings: Settings;
  readonly onContinue: () => void;
  /** Starts the game the play panel shows. */
  readonly onPlay: () => void;
  readonly onOpponent: (opponent: Opponent) => void;
  readonly onDifficulty: (difficulty: Difficulty) => void;
  /** A player's clock for a two-player game: off, or one to five minutes. */
  readonly onClock: (player: Player, choice: ClockChoice) => void;
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
 * The home screen (PRD S1, E1, E5): a hero with the drawn wordmark over a board in its frame and both
 * avatars, Continue for a saved game, one play panel (the opponent, the bot's difficulty while the bot is
 * chosen, each player's clock while a friend is chosen, and one Play button labelled with the choice), one quiet line of results, and How to Play and
 * Settings, which holds the results' reset. One tap on Play starts a game.
 */
export function HomeScreen({ model, settings, onContinue, onPlay, onOpponent, onDifficulty, onClock, onHowTo, onResetResults, onSettings }: HomeScreenProps) {
  const [menu, setMenu] = useState<{ opener: HTMLElement } | null>(null);
  return (
    <main className="home" data-testid="home-screen">
      <header className="hero" data-testid="hero">
        <Avatar player="A" expression="to-move" testId="hero-avatar-A" />
        <div className="hero-centre">
          <h1 className="wordmark" data-testid="title">{TITLE}</h1>
          <HeroBoard />
        </div>
        <Avatar player="B" expression="idle" testId="hero-avatar-B" />
      </header>

      {model.continueGame && (
        <button type="button" className="primary continue" data-testid="continue" onClick={onContinue}>
          Continue
          <span className="menu-note">{model.continueGame.note}</span>
        </button>
      )}

      <section className="play-panel material-card" aria-label="Play" data-testid="play-panel">
        <div className="panel-row">
          <span className="panel-label" aria-hidden="true">
            Opponent
          </span>
          <RadioSwitch label="Opponent" testId="opponent-switch" options={OPPONENTS} value={model.opponent} afterKey={opponentAfterKey} onChange={onOpponent} />
        </div>
        {model.showDifficulty && (
          <div className="panel-row">
            <span className="panel-label" aria-hidden="true">
              Bot
            </span>
            <RadioSwitch label="Bot difficulty" testId="difficulty-switch" options={DIFFICULTY_OPTIONS} value={model.difficulty} afterKey={difficultyAfterKey} onChange={onDifficulty} />
          </div>
        )}
        {model.showClocks &&
          (['A', 'B'] as const).map((player) => (
            <div className="panel-row clock-row" key={player}>
              <span className="panel-label" aria-hidden="true">
                Player {player === 'A' ? 1 : 2} clock
              </span>
              <ClockSlider player={player} value={player === 'A' ? model.clockA : model.clockB} onChange={(choice) => onClock(player, choice)} />
            </div>
          ))}
        {model.replacesSaved && (
          <p className="replaces" id="play-replaces" data-testid="replaces">
            {REPLACES_NOTE}
          </p>
        )}
        <button type="button" className="primary play" data-testid="play" aria-describedby={model.replacesSaved ? 'play-replaces' : undefined} onClick={onPlay}>
          {model.playLabel}
        </button>
      </section>

      <p className="results-line" data-testid="results">
        <span aria-hidden="true">{model.resultsLine}</span>
        <span className="visually-hidden">{model.resultsSpoken}</span>
        {model.results.map((row) => (
          <span key={row.difficulty} hidden data-difficulty={row.difficulty} data-wins={row.wins} data-losses={row.losses} data-draws={row.draws} />
        ))}
      </p>

      <nav className="home-links" aria-label="More">
        <button type="button" data-testid="open-how-to-play" onClick={(event) => onHowTo(event.currentTarget)}>
          How to play
        </button>
        <button type="button" data-testid="open-settings" aria-haspopup="dialog" onClick={(event) => setMenu({ opener: event.currentTarget })}>
          Settings
        </button>
      </nav>

      {menu && (
        <MenuDialog
          title="Settings"
          settings={settings}
          onSettings={onSettings}
          onClose={() => setMenu(null)}
          returnFocusTo={menu.opener}
          onResetResults={onResetResults}
          canReset={model.canReset}
        />
      )}
    </main>
  );
}
