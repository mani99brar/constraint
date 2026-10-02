import { FIGHTERS, OBJECTIVES } from '@okiya/content';
import type { ObjectiveId } from '@okiya/rules';

/** The `localStorage` key that remembers a dismissed guide (PRD U7). */
export const GUIDE_KEY = 'okiya.guide.dismissed';

/** The part of `Storage` the guide uses. */
export interface GuideStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's `localStorage`, or null where reading it throws (private modes, blocked storage). */
export function browserStorage(): GuideStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Whether the guide opens: yes on a first visit, no once dismissed, and yes when storage fails. */
export function guideStartsOpen(storage: GuideStorage | null): boolean {
  try {
    return storage?.getItem(GUIDE_KEY) !== 'true';
  } catch {
    return true;
  }
}

/** Remembers the dismissal; returns false when storage refuses, and the game carries on. */
export function rememberDismissed(storage: GuideStorage | null): boolean {
  try {
    if (!storage) return false;
    storage.setItem(GUIDE_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

export interface GuideStep {
  readonly id: 'matching' | 'fighters' | 'objective';
  readonly title: string;
  readonly text: string;
}

/** The objective in words, from its `summary` in `@okiya/content`. */
export function objectiveSummary(id: ObjectiveId): string {
  return OBJECTIVES.find((objective) => objective.id === id)?.summary ?? id;
}

/** The short first-match guide: matching, the fighters and the objective. */
export function guideSteps(objective: ObjectiveId = 'Square'): GuideStep[] {
  const displacers = FIGHTERS.filter((fighter) => fighter.displacer).map((fighter) => fighter.name);
  return [
    {
      id: 'matching',
      title: 'Matching',
      text:
        'Every tile has a terrain and a symbol. Each action sets the constraint to its tile, for example "Forest or Moon": ' +
        'the next action must use a tile with that terrain or that symbol, so your tile decides what the bot may do next. ' +
        'The very first deploy goes on any outside-edge cell.',
    },
    {
      id: 'fighters',
      title: 'Fighters',
      text:
        `Each side fields four fighters. On your turn select one: highlighted cells show where it can deploy, move or use ` +
        `its ability, which costs its single charge. ${displacers.join(', ')} displace other fighters. Hidden traps ` +
        'drain the charge, or lock a fighter that has none.',
    },
    {
      id: 'objective',
      title: `Objective: ${OBJECTIVES.find((candidate) => candidate.id === objective)?.name ?? objective}`,
      text: `${objectiveSummary(objective)} Any one of the nine 2×2 blocks counts. The bot has the same goal, so block its squares too.`,
    },
  ];
}
