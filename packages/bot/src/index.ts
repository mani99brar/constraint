// Public entry point of @okiya/bot: the bot's setup choice and action choice.

export { chooseSetup, BOT_ROSTER } from './setup';
export {
  chooseAction,
  preferScouted,
  DEFAULT_BUDGET,
  DEFAULT_MAX_DEPTH,
  type RootScore,
  type SearchOptions,
  type SearchStats,
} from './search';

// Constraint v1.0 (docs/game-spec.md).
export {
  analyzeTake,
  chooseTake,
  DIFFICULTIES,
  NORMAL_DEPTH,
  NORMAL_MAX_POSITIONS,
  POSITION_BUDGET,
  type Difficulty,
  type TakeAnalysis,
  type TakeOptions,
} from './take';
