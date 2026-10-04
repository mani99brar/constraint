import type { Player, Terrain, TileSymbol } from '@okiya/game';

// All art is drawn in code (PRD U1): a small scene per terrain, an emblem per symbol and a mark per
// player's token, each with its own shape, so colour is never the only signal. Colours are theme tokens.

const glyph = { 'aria-hidden': true, focusable: false, viewBox: '0 0 24 24' } as const;

/** A terrain's scene, filling its tile behind the token: pines, waves, peaks or dunes. */
export function TerrainScene({ terrain }: { terrain: Terrain }) {
  const ink = `var(--${terrain.toLowerCase()}-ink)`;
  const props = { 'aria-hidden': true, focusable: false, viewBox: '0 0 100 100', preserveAspectRatio: 'xMidYMid slice', className: 'scene' } as const;
  switch (terrain) {
    case 'Forest':
      return (
        <svg {...props} data-shape="pines">
          <path d="M0 82q25-12 50-4t50-6v28H0z" fill={ink} opacity="0.28" />
          {[
            [22, 30, 1],
            [78, 26, 0.9],
            [64, 48, 0.75],
          ].map(([x, y, s]) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${s})`} fill={ink} opacity="0.62">
              <path d="M0-18 13 4H5l10 14H-15L-5 4h-8z" />
              <rect x="-2.5" y="18" width="5" height="9" />
            </g>
          ))}
        </svg>
      );
    case 'Water':
      return (
        <svg {...props} data-shape="waves">
          <g fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round" opacity="0.55">
            <path d="M-4 22q8-7 16 0t16 0 16 0 16 0 16 0 16 0 16 0" />
            <path d="M-12 50q8-7 16 0t16 0 16 0 16 0 16 0 16 0 16 0" opacity="0.7" />
            <path d="M-4 78q8-7 16 0t16 0 16 0 16 0 16 0 16 0 16 0" />
          </g>
          <path d="M80 62a9 6 0 1 1-1-.2l-8 3z" fill={ink} opacity="0.5" />
        </svg>
      );
    case 'Mountain':
      return (
        <svg {...props} data-shape="peaks">
          <path d="M-6 92 30 30l18 28 14-20 44 54z" fill={ink} opacity="0.5" />
          <path d="M30 30 21 46l7-3 4 5 5-6zM62 38l-7 10 6-2 4 4 4-5z" fill="var(--surface)" opacity="0.85" />
        </svg>
      );
    case 'Desert':
      return (
        <svg {...props} data-shape="dunes">
          <path d="M-4 70q30-22 58-4t50-8v42H-4z" fill={ink} opacity="0.32" />
          <path d="M-4 88q34-16 62-2t46-4v18H-4z" fill={ink} opacity="0.45" />
          <g fill={ink} opacity="0.65" transform="translate(80 30)">
            <rect x="-3" y="0" width="6" height="30" rx="3" />
            <path d="M-3 16h-6a3 3 0 0 1-3-3V6a2.5 2.5 0 0 1 5 0v5h4zM3 12h5V4a2.5 2.5 0 0 1 5 0v8a4 4 0 0 1-4 4H3z" />
          </g>
        </svg>
      );
  }
}

/** A small terrain glyph for the top bar and How to Play. */
export function TerrainGlyph({ terrain }: { terrain: Terrain }) {
  const color = `var(--${terrain.toLowerCase()}-ink)`;
  switch (terrain) {
    case 'Forest':
      return (
        <svg {...glyph} className="glyph" data-shape="pines">
          <path d="M12 2 5 13h4l-4 6h14l-4-6h4z" fill={color} />
          <rect x="10.8" y="19" width="2.4" height="4" fill={color} />
        </svg>
      );
    case 'Water':
      return (
        <svg {...glyph} className="glyph" data-shape="waves">
          <path d="M2 8q2.5-3 5 0t5 0 5 0 5 0M2 14q2.5-3 5 0t5 0 5 0 5 0M2 20q2.5-3 5 0t5 0 5 0 5 0" fill="none" stroke={color} strokeWidth="2.2" />
        </svg>
      );
    case 'Mountain':
      return (
        <svg {...glyph} className="glyph" data-shape="peaks">
          <path d="M1 21 9 6l4 7 3-4 7 12z" fill={color} />
        </svg>
      );
    case 'Desert':
      return (
        <svg {...glyph} className="glyph" data-shape="dunes">
          <path d="M1 21q5-8 11-4t11-2v6z" fill={color} />
          <rect x="15" y="4" width="3" height="11" rx="1.5" fill={color} />
          <path d="M15 10h-2V7h-1.6v4a1.4 1.4 0 0 0 1.4 1.4H15z" fill={color} />
        </svg>
      );
  }
}

/** A symbol's emblem: a round badge with a sun, crescent, star or wave. */
export function SymbolEmblem({ symbol }: { symbol: TileSymbol }) {
  const color = `var(--${symbol.toLowerCase()})`;
  let mark;
  switch (symbol) {
    case 'Sun':
      mark = (
        <>
          <circle cx="12" cy="12" r="4.2" fill={color} />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </>
      );
      break;
    case 'Moon':
      mark = <path d="M14.5 4.2a8 8 0 1 0 5.6 11.4 6.4 6.4 0 0 1-5.6-11.4z" fill={color} />;
      break;
    case 'Star':
      mark = <path d="m12 3.5 2.5 5.3 5.8.7-4.3 4 1.1 5.8L12 16.4l-5.1 2.9L8 13.5l-4.3-4 5.8-.7z" fill={color} />;
      break;
    case 'Wave':
      mark = <path d="M3.5 14.5c2.5-6 6-6 8-2s5 5 6.8.7 2.8-2.2 2.8-2.2" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />;
      break;
  }
  return (
    <svg {...glyph} className="emblem-svg" data-shape={symbol.toLowerCase()}>
      <circle cx="12" cy="12" r="11" fill="var(--chip)" stroke={color} strokeWidth="1.4" />
      {mark}
    </svg>
  );
}

/** The mark on a player's token: a ring on Player 1's, a diamond on Player 2's (the bot's in a bot game). */
export function TokenMark({ player }: { player: Player }) {
  return (
    <svg {...glyph} className="token-mark" data-shape={player === 'A' ? 'ring' : 'diamond'}>
      {player === 'A' ? (
        <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
      ) : (
        <path d="M12 4.5 19.5 12 12 19.5 4.5 12z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** A whole tile as the board draws it: its terrain scene and its symbol emblem, at any size. */
export function TileArt({ terrain, symbol, className = '' }: { terrain: Terrain; symbol: TileSymbol; className?: string }) {
  return (
    <span className={`tile-art terrain-${terrain.toLowerCase()} ${className}`.trim()} data-terrain={terrain} data-symbol={symbol} aria-hidden="true">
      <TerrainScene terrain={terrain} />
      <span className="tile-symbol">
        <SymbolEmblem symbol={symbol} />
      </span>
    </span>
  );
}

export function MenuIcon() {
  return (
    <svg {...glyph} className="glyph">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
