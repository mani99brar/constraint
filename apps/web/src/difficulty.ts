import type { Difficulty } from '@okiya/bot';

export type { Difficulty };

/** The bot's three strengths (PRD B2), passed to `chooseTake` as they are. */
export const DIFFICULTY_OPTIONS = [
  { id: 'easy', label: 'Easy', description: 'Takes a winning tile when it sees one, otherwise any legal tile.' },
  { id: 'normal', label: 'Normal', description: 'Looks three takes ahead and avoids handing you a win.' },
  { id: 'hard', label: 'Hard', description: 'Plays perfectly from its second take on.' },
] as const satisfies readonly { readonly id: Difficulty; readonly label: string; readonly description: string }[];

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTY_OPTIONS.some((option) => option.id === value);
}

export function difficultyLabel(difficulty: Difficulty): string {
  return DIFFICULTY_OPTIONS.find((option) => option.id === difficulty)!.label;
}
