import { FIGHTERS, OBJECTIVES } from '@okiya/content';
import type { ObjectiveId } from '@okiya/rules';
import { readText, writeJson, type KeyValueStorage } from './storage';
import { TITLE } from './title';

/** The `localStorage` key that remembers the How to Play dialog was seen once (PRD E3). */
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

/** The objective in words, from its `summary` in `@okiya/content`. */
export function objectiveSummary(id: ObjectiveId): string {
  return OBJECTIVES.find((objective) => objective.id === id)?.summary ?? id;
}

export function objectiveName(id: ObjectiveId): string {
  return OBJECTIVES.find((objective) => objective.id === id)?.name ?? id;
}

export interface HowToSection {
  readonly id: 'objective' | 'matching' | 'turn' | 'fighters' | 'traps' | 'ending';
  readonly title: string;
  readonly paragraphs: readonly string[];
}

/**
 * How to Play (PRD E3): the objective, matching, a turn, every fighter, traps and how a match
 * ends. Fighter and objective texts come from `@okiya/content`, so they never drift from the data.
 */
export function howToSections(objective: ObjectiveId = 'Square'): HowToSection[] {
  const displacers = FIGHTERS.filter((fighter) => fighter.displacer).map((fighter) => fighter.name);
  return [
    {
      id: 'objective',
      title: `Goal: ${objectiveName(objective)}`,
      paragraphs: [
        `${TITLE} is a duel on a 4×4 board against a bot. Each side secretly picks four fighters from a pool of ${FIGHTERS.length}.`,
        `${objectiveSummary(objective)} Any of the nine 2×2 blocks counts, and you win the moment yours is complete. The bot has the same goal, so block its squares too.`,
      ],
    },
    {
      id: 'matching',
      title: 'Matching',
      paragraphs: [
        'Every tile has a terrain (Forest, Water, Mountain or Desert) and a symbol (Sun, Moon, Star or Wave). The tile you act on becomes the constraint for your opponent.',
        'A tile matches the constraint when it has the same terrain or the same symbol; one is enough. With the constraint Forest or Moon, a Forest–Sun tile and a Water–Moon tile both match, a Desert–Star tile does not.',
        'The very first deploy of a match has no constraint: it goes on any cell of the outside edge.',
      ],
    },
    {
      id: 'turn',
      title: 'Your turn',
      paragraphs: [
        'Take exactly one action. Deploy a reserve fighter on an empty matching cell; move a fighter one step up, down, left or right to an empty matching cell; recharge a spent fighter standing on a matching tile (three recharges per match); or spend a fighter’s charge on its ability.',
        'Select a fighter to see its options. With move highlights on, its legal cells are marked on the board; an illegal choice is always refused with the reason.',
      ],
    },
    {
      id: 'fighters',
      title: 'Fighters',
      paragraphs: [
        `Every fighter starts with one charge and spends it to use its ability. ${displacers.join(', ')} displace other fighters, yours or the bot’s.`,
      ],
    },
    {
      id: 'traps',
      title: 'Traps',
      paragraphs: [
        'Before the match each side hides two traps on the board. An enemy fighter that enters your trap loses its charge, or is locked for a turn if it has none. Your own traps never affect you.',
        'You see only your own traps. The bot’s show up when they spring.',
      ],
    },
    {
      id: 'ending',
      title: 'How a match ends',
      paragraphs: [
        'A completed square wins at once; if both squares complete together, it is a draw. A player with no legal action on their turn loses. The third time the same position comes back, the match is drawn.',
      ],
    },
  ];
}

/** Example tiles for the matching illustration, against the constraint Forest or Moon. */
export const MATCHING_EXAMPLE = {
  constraint: { terrain: 'Forest', symbol: 'Moon' },
  tiles: [
    { terrain: 'Forest', symbol: 'Sun', matches: true, why: 'same terrain' },
    { terrain: 'Water', symbol: 'Moon', matches: true, why: 'same symbol' },
    { terrain: 'Desert', symbol: 'Star', matches: false, why: 'neither' },
  ],
} as const;
