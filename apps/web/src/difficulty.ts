import type { SearchOptions } from '@okiya/bot';

/** Bot strength as search depth (decisions: Easy 1, Normal 2, Hard 3), passed to `chooseAction`. */
export const BOT_DEPTHS = [
  { id: 'easy', label: 'Easy', maxDepth: 1, description: 'Looks at its own actions only.' },
  { id: 'normal', label: 'Normal', maxDepth: 2, description: 'Also weighs your best reply.' },
  { id: 'hard', label: 'Hard', maxDepth: 3, description: 'Searches one move further ahead.' },
] as const;

export type BotDepthId = (typeof BOT_DEPTHS)[number]['id'];
export const DEFAULT_DEPTH: BotDepthId = 'normal';

export function isBotDepth(value: unknown): value is BotDepthId {
  return BOT_DEPTHS.some((depth) => depth.id === value);
}

export function searchOptionsFor(depth: BotDepthId): SearchOptions {
  return { maxDepth: BOT_DEPTHS.find((candidate) => candidate.id === depth)!.maxDepth };
}

export function depthLabel(depth: BotDepthId): string {
  return BOT_DEPTHS.find((candidate) => candidate.id === depth)!.label;
}
