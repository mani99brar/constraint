// Public entry point of @okiya/game: the rules of Constraint v1.0 (docs/game-spec.md). Pure and deterministic.

export * from './board';
export * from './state';
export { newGame, validateTake, legalTakes, take, tokenAt, tileAt, isValidSeed, InvalidSeedError, type NewGameInput } from './game';
export { gameLogOf, parseGameLog, replayGame, GAME_LOG_FORMAT_VERSION, type GameLog, type GameLogRefusal } from './log';
