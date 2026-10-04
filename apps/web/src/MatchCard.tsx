import { useLayoutEffect, useRef } from 'react';
import { SymbolEmblem, TerrainGlyph, TileArt } from './art';
import type { MatchCardModel } from './matchCard';

/**
 * The Match card (PRD I1): the tile the next take must match, with its scene, its emblem and both
 * names, or "Any edge tile" at the opening. A newly taken tile flies in from its cell: a CSS animation
 * under 400 ms, started by a class, which the reduced-motion switch turns off (PRD U8).
 */
export function MatchCard({ model }: { model: MatchCardModel }) {
  const tile = useRef<HTMLSpanElement>(null);
  const shown = useRef(model.takes);

  useLayoutEffect(() => {
    // Only a take made while the card is on screen flies in; a resumed game does not.
    if (shown.current === model.takes) return;
    shown.current = model.takes;
    const element = tile.current;
    const from = model.cell ? document.querySelector(`[data-testid="board"] [data-cell="${model.cell}"]`) : null;
    if (!element || !from) return;
    const start = from.getBoundingClientRect();
    const end = element.getBoundingClientRect();
    if (end.width === 0) return;
    element.style.setProperty('--from-x', `${start.left + start.width / 2 - (end.left + end.width / 2)}px`);
    element.style.setProperty('--from-y', `${start.top + start.height / 2 - (end.top + end.height / 2)}px`);
    element.style.setProperty('--from-scale', String(start.width / end.width));
    element.classList.add('arriving');
  }, [model.takes, model.cell]);

  const { terrain, symbol } = model;
  return (
    <div
      className="match-card"
      role="group"
      aria-label={model.label}
      data-testid="match-card"
      data-terrain={terrain ?? undefined}
      data-symbol={symbol ?? undefined}
      data-opening={terrain === null || undefined}
    >
      <span className="match-tile-slot">
        {terrain && symbol ? (
          <span key={model.takes} ref={tile} className="match-tile" onAnimationEnd={(event) => event.currentTarget.classList.remove('arriving')}>
            <TileArt terrain={terrain} symbol={symbol} />
          </span>
        ) : (
          <span className="match-tile opening" aria-hidden="true" />
        )}
      </span>
      <span className="match-text" aria-hidden="true">
        <span className="match-heading">Match</span>
        {terrain && symbol ? (
          <span className="match-names">
            <span className="match-name" data-testid="match-card-terrain">
              <TerrainGlyph terrain={terrain} />
              {terrain}
            </span>
            <span className="match-name" data-testid="match-card-symbol">
              <SymbolEmblem symbol={symbol} />
              {symbol}
            </span>
          </span>
        ) : (
          <span className="match-names match-opening" data-testid="match-card-opening">
            {model.text}
          </span>
        )}
      </span>
    </div>
  );
}
