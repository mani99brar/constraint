// Public entry point of @okiya/rules. Later lanes build against these types and functions only.

export * from './board';
export * from './fighters';
export * from './preset';
export * from './setup';
export * from './state';
export * from './actions';
export * from './abilities';
export * from './events';
export * from './view';
export * from './log';

export { prepareMatch, startMatch, validateSetup, InvalidSetupError, type PrepareMatchInput } from '../core/setup';
export { listLegalActions, validateAction } from '../core/legality';
export { applyAction } from '../core/apply';
export { playerView, projectEvents, projectLogEntry } from '../core/view';
export { hypotheticalState } from '../core/hypothetical';
export { canonicalSignature } from '../core/signature';
export { objectiveResult, blockadeResult } from '../core/terminal';
export { matchLogOf, parseMatchLog, replayMatchLog, replayMatchSteps } from '../core/log';
export { ABILITY_MODULES } from '../abilities/registry';
