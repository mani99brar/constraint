import { describe, expect, it } from 'vitest';
import { applyAction, canonicalSignature, listLegalActions, matchLogOf, replayMatchLog, type Action, type MatchState } from '../api';
import { seededMatch, TEST_TILES } from './testing';

/** Plays a fixed rotation through the legal-action list and returns the final state and the actions taken. */
function play(state: MatchState, turns: number): { state: MatchState; actions: Action[] } {
  const actions: Action[] = [];
  for (let i = 0; i < turns && !state.result; i += 1) {
    const legal = listLegalActions(state);
    const action = legal[(i * 7) % legal.length]!;
    const applied = applyAction(state, action);
    if (!applied.ok) throw new Error('legal action refused');
    actions.push(action);
    state = applied.state;
  }
  return { state, actions };
}

describe('determinism (PRD L1)', () => {
  it('gives the same final state for the same seed and action log', () => {
    const first = play(seededMatch(2024), 14);
    let replayed = seededMatch(2024);
    for (const action of first.actions) {
      const applied = applyAction(replayed, action);
      if (!applied.ok) throw new Error('replayed action refused');
      replayed = applied.state;
    }
    expect(replayed).toEqual(first.state);
    expect(canonicalSignature(replayed)).toBe(canonicalSignature(first.state));
  });

  it('replays a match log to the same final state', () => {
    const { state } = play(seededMatch(99), 10);
    const log = matchLogOf(state);
    expect(log.formatVersion).toBe(1);
    expect(log.actions).toHaveLength(state.history.length);
    expect(replayMatchLog(JSON.parse(JSON.stringify(log)), TEST_TILES)).toEqual(state);
  });

  it('keeps the state plain serializable data', () => {
    const { state } = play(seededMatch(5), 6);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
