// Public entry point of @okiya/content: typed game data and its validators.

export { TILES } from './tiles';
export { FIGHTERS, OBJECTIVES } from './fighters';
export { DEFAULT_ROSTERS, DEFAULT_TRAPS, defaultSetup } from './defaults';
export { SPEC_V0_2, SPEC_V0_2_TWO_DISPLACERS, SPEC_V0_2_LOCKED_DONT_COUNT, SPEC_V0_2_REPETITION_2, PRESETS } from './presets';
export { PAPER_TEST_01, PAPER_TEST_01_SWAPPED, SCENARIOS } from './scenarios';
export { validateTiles, validateFighters, validatePreset, validateScenario, type ContentIssue } from './validate';
