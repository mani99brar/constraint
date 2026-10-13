import { SymbolMark, TerrainThumb } from './art';
import type { MatchCardModel } from './matchCard';

/** The 4 x 4 board with its edge ring lit: where the first take may go. */
function EdgeDiagram() {
  return (
    <svg className="edge-diagram" viewBox="0 0 34 34" aria-hidden="true" focusable="false" data-testid="edge-diagram">
      {Array.from({ length: 16 }, (_, index) => {
        const row = Math.floor(index / 4);
        const column = index % 4;
        const edge = row % 3 === 0 || column % 3 === 0;
        return <rect key={index} x={3 + column * 7.5} y={3 + row * 7.5} width="6" height="6" rx="1.5" className={edge ? 'on' : 'off'} />;
      })}
    </svg>
  );
}

/**
 * The Match card (PRD I1): what the next take needs, said as one sentence, "Match Desert or Sun": the
 * word Match, then two chips, the terrain with its picture and the symbol drawn as on the tiles, joined
 * by "or", either of which makes a tile legal. At the opening it says "First take: Any edge tile" beside a
 * diagram of the edge ring; after a blockade it says that no tile matches (PRD U10).
 * A new tile changes in place with a short crossfade under 200 ms (PRD U8): nothing flies in. On a
 * phone the names area keeps one size, so the blockade says "No match" there in one line, and the
 * card's accessible name keeps the whole sentence.
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
      data-ended={model.ended || undefined}
    >
      <span className="match-heading" aria-hidden="true">
        {terrain === null ? 'First take' : model.ended || model.blocked ? 'Last tile taken' : 'Match'}
      </span>
      <span key={model.takes} className="match-text" aria-hidden="true">
        {model.blocked ? (
          <span className="match-names match-blocked" data-testid="match-card-blocked">
            <span className="long-form">{model.blocked}</span>
            <span className="short-form">{model.blockedShort}</span>
          </span>
        ) : terrain && symbol ? (
          <span className="match-names">
            <span className="match-chip chip-terrain">
              <TerrainThumb terrain={terrain} />
              <span className="chip-text">
                <i>Terrain</i>
                <b data-testid="match-card-terrain">{terrain}</b>
              </span>
            </span>
            {!model.ended && <span className="match-or">or</span>}
            <span className="match-chip chip-symbol">
              <span className="chip-emblem">
                <SymbolMark symbol={symbol} variant="icon" />
              </span>
              <span className="chip-text">
                <i>Symbol</i>
                <b data-testid="match-card-symbol">{symbol}</b>
              </span>
            </span>
          </span>
        ) : (
          <span className="match-names match-opening-row">
            <span className="match-chip chip-opening">
              <EdgeDiagram />
              <span className="chip-text">
                <b data-testid="match-card-opening">{model.text}</b>
              </span>
            </span>
          </span>
        )}
      </span>
    </div>
  );
}
