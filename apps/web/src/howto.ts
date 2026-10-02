import { EDGE_CELLS, type CellId, type Tile } from '@okiya/game';
import { readText, writeJson, type KeyValueStorage } from './storage';
import { TITLE } from './title';

/** The `localStorage` key that remembers the How to Play dialog was seen once (PRD E2). */
export const HOWTO_SEEN_KEY = 'okiya.howto.seen';
/** The playtest build's guide dismissal, honoured so its players are not shown the dialog again. */
const LEGACY_GUIDE_KEY = 'okiya.guide.dismissed';

/** Whether the dialog opens by itself: only on the very first visit, and never when storage fails. */
export function howToOpensFirst(storage: KeyValueStorage | null): boolean {
  if (!storage) return false;
  return readText(storage, HOWTO_SEEN_KEY) !== 'true' && readText(storage, LEGACY_GUIDE_KEY) !== 'true';
}

export function rememberHowToSeen(storage: KeyValueStorage | null): boolean {
  return writeJson(storage, HOWTO_SEEN_KEY, true);
}

/** How a cell of a small board diagram is drawn: a token, a mark, or both. */
export interface DiagramCell {
  readonly token?: 'you' | 'bot';
  /** `glow` a tile you may take, `shape` part of a winning shape, `last` the last take, `dead` a tile that does not match. */
  readonly mark?: 'glow' | 'shape' | 'last' | 'dead';
}

export interface Diagram {
  readonly id: string;
  readonly caption: string;
  readonly cells: Readonly<Partial<Record<CellId, DiagramCell>>>;
}

export interface HowToSection {
  readonly id: 'taking' | 'opening' | 'shapes' | 'blockade' | 'draw';
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly diagrams: readonly Diagram[];
}

const you: DiagramCell = { token: 'you' };
const bot: DiagramCell = { token: 'bot' };
const shape: DiagramCell = { token: 'you', mark: 'shape' };
const dead: DiagramCell = { mark: 'dead' };

function cells(entries: Record<string, DiagramCell>): Partial<Record<CellId, DiagramCell>> {
  return entries as Partial<Record<CellId, DiagramCell>>;
}

/** The small board diagrams of How to Play; `howto.test.ts` checks them against the rules. */
export const DIAGRAMS = {
  opening: {
    id: 'opening',
    caption: 'The first take: any of the 12 edge tiles.',
    cells: Object.fromEntries(EDGE_CELLS.map((cell) => [cell, { mark: 'glow' } satisfies DiagramCell])),
  },
  line: {
    id: 'line',
    caption: 'A line: a row, a column or a long diagonal, like this one.',
    cells: cells({ A1: shape, B2: shape, C3: shape, D4: shape, A2: bot, B3: bot, C1: bot }),
  },
  square: {
    id: 'square',
    caption: 'A square: any 2×2 block of the board.',
    cells: cells({ B2: shape, B3: shape, C2: shape, C3: shape, A2: bot, C4: bot, D1: bot }),
  },
  blockade: {
    id: 'blockade',
    caption: 'You took C2 last. None of the three tiles left matches it, so the bot cannot take and you win.',
    cells: cells({
      A1: you, A3: you, B2: you, C4: you, D1: you, D3: you,
      C2: { token: 'you', mark: 'last' },
      A2: bot, A4: bot, B1: bot, B3: bot, C1: bot, D2: bot,
      B4: dead, C3: dead, D4: dead,
    }),
  },
  draw: {
    id: 'draw',
    caption: 'A full board with no line and no square: a draw.',
    cells: cells({
      A1: you, A2: you, A3: bot, A4: bot,
      B1: bot, B2: bot, B3: you, B4: you,
      C1: you, C2: you, C3: bot, C4: bot,
      D1: bot, D2: bot, D3: you, D4: you,
    }),
  },
} as const satisfies Record<string, Diagram>;

/**
 * How to Play (PRD E2): taking a matching tile, the edge opening, the line and square shapes, the
 * blockade and the full-board draw, each with a small board diagram.
 */
export function howToSections(): HowToSection[] {
  return [
    {
      id: 'taking',
      title: 'Take a matching tile',
      paragraphs: [
        `${TITLE} is played against a bot on a 4×4 board of 16 tiles. Every tile shows a terrain (Forest, Water, Mountain or Desert) and a symbol (Sun, Moon, Star or Wave).`,
        'On your turn, take one tile: one of your tokens goes on its cell. The tile you took becomes the last tile, shown in the top bar, and the next take must match it, with the same terrain or the same symbol; one is enough. It may come from anywhere on the board.',
        'Tap a tile, or move to it with the arrow keys and press Enter. With highlights on, the tiles you may take glow. A tile that does not match is refused with the reason.',
      ],
      diagrams: [],
    },
    {
      id: 'opening',
      title: 'The first take',
      paragraphs: [
        'There is no last tile yet, so the first take of a game may be any tile on the edge of the board. The first game’s starter is chosen at random; Play again lets the other player start.',
      ],
      diagrams: [DIAGRAMS.opening],
    },
    {
      id: 'shapes',
      title: 'Lines and squares',
      paragraphs: [
        'Each of you has 8 tokens. You win at once when four of your tokens make a line, a full row, a full column or one of the two long diagonals, or fill a 2×2 square.',
      ],
      diagrams: [DIAGRAMS.line, DIAGRAMS.square],
    },
    {
      id: 'blockade',
      title: 'Blockade',
      paragraphs: [
        'When no tile left on the board matches the last tile, the next player cannot take one and loses: whoever took last wins. Steering the bot into such a dead end is the heart of the game.',
      ],
      diagrams: [DIAGRAMS.blockade],
    },
    {
      id: 'draw',
      title: 'Full board',
      paragraphs: ['When all 16 cells hold tokens and nobody has made a line or a square, the game is a draw.'],
      diagrams: [DIAGRAMS.draw],
    },
  ];
}

/** Example tiles for the matching illustration, against the last tile Forest–Moon. */
export const MATCHING_EXAMPLE: {
  readonly lastTile: Tile;
  readonly tiles: readonly (Tile & { readonly matches: boolean; readonly why: string })[];
} = {
  lastTile: { terrain: 'Forest', symbol: 'Moon' },
  tiles: [
    { terrain: 'Forest', symbol: 'Sun', matches: true, why: 'same terrain' },
    { terrain: 'Water', symbol: 'Moon', matches: true, why: 'same symbol' },
    { terrain: 'Desert', symbol: 'Star', matches: false, why: 'neither' },
  ],
};
