import { SymbolEmblem, TerrainGlyph, TileArt } from './art';
import type { MatchCardModel } from './matchCard';

/**
 * The Match card (PRD I1): the tile the next take must match, with its scene, its emblem and both
 * names, or "Any edge tile" at the opening; after a blockade it says that no tile matches (PRD U10).
 * A new tile changes in place with a short crossfade under 200 ms (PRD U8): nothing flies in. It sits
 * at the centre of the scoreboard row; on a phone its names area keeps one size, so the blockade says
 * "No match" there in one line, and the card's accessible name keeps the whole sentence.
 */
export function MatchCard({ model }: { model: MatchCardModel }) {
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
      data-blocked={model.blocked !== null || undefined}
    >
      <span className="match-tile-slot">
        {terrain && symbol ? (
          <span key={model.takes} className="match-tile">
            <TileArt terrain={terrain} symbol={symbol} />
          </span>
        ) : (
          <span className="match-tile opening" aria-hidden="true" />
        )}
      </span>
      <span key={model.takes} className="match-text" aria-hidden="true">
        <span className="match-heading">Match</span>
        {model.blocked ? (
          <span className="match-names match-blocked" data-testid="match-card-blocked">
            <span className="long-form">{model.blocked}</span>
            <span className="short-form">{model.blockedShort}</span>
          </span>
        ) : terrain && symbol ? (
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
