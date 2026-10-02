import type { GameState } from '@okiya/game';
import { MenuIcon, SymbolEmblem, TerrainGlyph, TokenMark } from './art';
import type { TopBarModel } from './topbar';

export interface TopBarProps {
  readonly model: TopBarModel;
  readonly state: Pick<GameState, 'toMove' | 'takes' | 'starter' | 'lastTile'>;
  readonly onMenu: (opener: HTMLElement) => void;
}

/** The slim top bar (PRD U2): whose turn, the last tile as two emblems, both token counts and the menu. */
export function TopBar({ model, state, onMenu }: TopBarProps) {
  const { lastTile } = model;
  return (
    <header className="top-bar" data-testid="top-bar">
      <div className="turn-area">
        <p
          className={`turn${model.humanTurn ? ' yours' : ''}${model.botThinking ? ' thinking' : ''}`}
          data-testid="turn"
          data-to-move={state.toMove}
          data-takes={state.takes.length}
          data-human-turn={model.humanTurn}
          aria-live="polite"
        >
          {model.botThinking && <span className="spinner" aria-hidden="true" />}
          {model.turnText}
        </p>
        {model.starterText && (
          <p className="starter" data-testid="starter" data-starter={state.starter}>
            {model.starterText}
          </p>
        )}
      </div>
      <div
        className="last-tile"
        role="group"
        aria-label={model.lastTileLabel}
        data-testid="last-tile"
        data-terrain={state.lastTile?.terrain}
        data-symbol={state.lastTile?.symbol}
        data-opening={lastTile === null || undefined}
      >
        {lastTile ? (
          lastTile.map((emblem) => (
            <span key={emblem.kind} className={`last-tile-emblem ${emblem.kind}`} data-testid={`last-tile-${emblem.kind}`}>
              {emblem.kind === 'terrain' ? <TerrainGlyph terrain={emblem.terrain} /> : <SymbolEmblem symbol={emblem.symbol} />}
              <span className="emblem-name">{emblem.name}</span>
            </span>
          ))
        ) : (
          <span className="last-tile-opening">{model.lastTileLabel}</span>
        )}
      </div>
      <div className="token-counts" data-testid="token-counts">
        {model.counts.map((count) => {
          const owner = count.side === 'You' ? 'you' : 'bot';
          return (
            <span
              key={count.player}
              className={`token-count ${owner}`}
              role="img"
              aria-label={count.label}
              data-testid={`tokens-${owner}`}
              data-left={count.left}
              data-total={count.total}
            >
              <span className={`count-token ${owner === 'you' ? 'own' : 'bot'}`} aria-hidden="true">
                <TokenMark owner={owner} />
              </span>
              <span className="count-text" aria-hidden="true">
                {count.side} {count.left}/{count.total}
              </span>
            </span>
          );
        })}
      </div>
      <button type="button" className="menu-button" data-testid="menu-button" aria-haspopup="dialog" onClick={(event) => onMenu(event.currentTarget)}>
        <MenuIcon />
        <span className="menu-text">Menu</span>
      </button>
    </header>
  );
}
