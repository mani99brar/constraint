import type { Terrain, TileSymbol } from '@okiya/rules';

// Placeholder visuals drawn in code (PRD U1, U4): each terrain and symbol has its own shape, and
// every shape sits next to a text label, so colour is never the only signal.

const svgProps = { 'aria-hidden': true, focusable: false, viewBox: '0 0 24 24', className: 'icon' } as const;

/** Terrain glyphs: tree, waves, peaks, dunes. */
export function TerrainIcon({ terrain }: { terrain: Terrain }) {
  switch (terrain) {
    case 'Forest':
      return (
        <svg {...svgProps} data-shape="tree">
          <path d="M12 2 4 14h5l-3 5h12l-3-5h5z" fill="currentColor" />
          <rect x="11" y="19" width="2" height="4" fill="currentColor" />
        </svg>
      );
    case 'Water':
      return (
        <svg {...svgProps} data-shape="waves">
          <path d="M2 8q2.5-3 5 0t5 0 5 0 5 0M2 14q2.5-3 5 0t5 0 5 0 5 0M2 20q2.5-3 5 0t5 0 5 0 5 0" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'Mountain':
      return (
        <svg {...svgProps} data-shape="peaks">
          <path d="M1 21 9 6l4 7 3-4 7 12z" fill="currentColor" />
        </svg>
      );
    case 'Desert':
      return (
        <svg {...svgProps} data-shape="dunes">
          <path d="M1 20q5-9 11-4t11-2v6z" fill="currentColor" />
          <circle cx="18" cy="6" r="1.6" fill="currentColor" />
          <circle cx="7" cy="9" r="1.2" fill="currentColor" />
        </svg>
      );
  }
}

/** Symbol icons: sun, crescent moon, star, wave. */
export function SymbolIcon({ symbol }: { symbol: TileSymbol }) {
  switch (symbol) {
    case 'Sun':
      return (
        <svg {...svgProps} data-shape="sun">
          <circle cx="12" cy="12" r="5" fill="currentColor" />
          <path
            d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8 7 17M17 7l2.8-2.8"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case 'Moon':
      return (
        <svg {...svgProps} data-shape="moon">
          <path d="M15 2a10 10 0 1 0 7 15A8 8 0 0 1 15 2z" fill="currentColor" />
        </svg>
      );
    case 'Star':
      return (
        <svg {...svgProps} data-shape="star">
          <path d="m12 1 3.2 7 7.6.8-5.7 5.1 1.6 7.5L12 17.6l-6.7 3.8 1.6-7.5L1.2 8.8 8.8 8z" fill="currentColor" />
        </svg>
      );
    case 'Wave':
      return (
        <svg {...svgProps} data-shape="wave">
          <path d="M1 15c3-8 7-8 9-3s5 6 7 1 4-5 6-2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
  }
}

export function LockIcon() {
  return (
    <svg {...svgProps}>
      <rect x="4" y="10" width="16" height="12" rx="2" fill="currentColor" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 1 3 5v6c0 6 4 10 9 12 5-2 9-6 9-12V5z" fill="currentColor" />
    </svg>
  );
}

export function TrapIcon() {
  return (
    <svg {...svgProps}>
      <path d="M2 20h20L12 3z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 9v5M12 16.5v1.5" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
