import { describe, expect, it } from 'vitest';
import type { GameResult, Player } from '@okiya/game';
import { TWO_PLAYERS, versusBot, type GameMode } from './mode';
import { handBuilt } from './playouts.test-helper';
import { avatarLooks, lastEvent, NO_EVENT, type ReactionEvent } from './reactions';

// The avatars' reactions (PRD U9): a resting face and a one-shot motion, from the state, the last event
// and the mode, never from the position on the board.

const easy = versusBot('easy');
const MODES: readonly [string, GameMode][] = [
  ['a bot game', easy],
  ['a two-player game', TWO_PLAYERS],
];
const forestStar = { terrain: 'Forest', symbol: 'Star' } as const;
const other = (player: Player): Player => (player === 'A' ? 'B' : 'A');

/** The face and motion of both seats, Player 1 first. */
function looks(state: Parameters<typeof avatarLooks>[0], event: ReactionEvent, mode: GameMode) {
  return avatarLooks(state, event, mode, 3).map((look) => [look.expression, look.reaction]);
}

/** The face of the player to move: ready, or thinking for the bot. */
const ready = (mode: GameMode, player: Player) => (mode.kind === 'bot' && player === 'B' ? 'thinking' : 'to-move');

describe('reaction model (PRD U9)', () => {
  it.each(MODES)('shows the start and a resumed game as no event, the player to move ready: %s', (_name, mode) => {
    for (const toMove of ['A', 'B'] as const) {
      const start = handBuilt([], toMove, null, { starter: toMove });
      const resumed = handBuilt(['A', 'B', 'A', null, 'B'], toMove, forestStar);
      for (const state of [start, resumed]) {
        const faces = looks(state, NO_EVENT, mode);
        expect(faces[toMove === 'A' ? 0 : 1]).toEqual([ready(mode, toMove), null]);
        expect(faces[toMove === 'A' ? 1 : 0]).toEqual(['idle', null]);
      }
    }
    // A game shown at 5 takes with no refusal has no event.
    expect(lastEvent(handBuilt(['A', 'B', 'A', null, 'B', 'A'], 'B', forestStar), 5, null)).toEqual({ event: NO_EVENT, key: 0 });
  });

  it.each(MODES)('gives the taker a nod and the other seat a glance after a take with no result, by each seat: %s', (_name, mode) => {
    for (const taker of ['A', 'B'] as const) {
      const next = other(taker);
      const state = handBuilt(['A', 'B', 'A'], next, forestStar);
      const faces = looks(state, { kind: 'take', by: taker }, mode);
      const byTaker = faces[taker === 'A' ? 0 : 1]!;
      const byOther = faces[taker === 'A' ? 1 : 0]!;
      expect(byTaker).toEqual(['idle', 'nod']);
      // The other seat glances at the take; the bot keeps its thinking face while it does.
      expect(byOther).toEqual([ready(mode, next), 'glance']);
    }
  });

  it('keeps the bot on its thinking face while it chooses, glancing at your take', () => {
    const state = handBuilt(['A'], 'B', forestStar);
    expect(looks(state, { kind: 'take', by: 'A' }, easy)).toEqual([
      ['idle', 'nod'],
      ['thinking', 'glance'],
    ]);
    expect(looks(state, NO_EVENT, easy)).toEqual([
      ['idle', null],
      ['thinking', null],
    ]);
  });

  it.each(MODES)('makes a refused tap wince the one who tapped, and nobody else, by each seat: %s', (_name, mode) => {
    for (const tapper of ['A', 'B'] as const) {
      if (mode.kind === 'bot' && tapper === 'B') continue; // the bot never taps
      const state = handBuilt(['A', 'B'], tapper, forestStar);
      const faces = looks(state, { kind: 'refusal', by: tapper }, mode);
      expect(faces[tapper === 'A' ? 0 : 1]).toEqual(['to-move', 'wince']);
      expect(faces[tapper === 'A' ? 1 : 0]).toEqual(['idle', null]);
    }
  });

  it.each(MODES)('gives the winner the won face with a bounce and the other the lost face, by line, square and blockade for each seat: %s', (_name, mode) => {
    for (const winner of ['A', 'B'] as const) {
      for (const by of ['line', 'square', 'blockade'] as const) {
        const result: GameResult = by === 'blockade' ? { kind: 'win', winner, by } : { kind: 'win', winner, by, cells: ['A1', 'A2', 'A3', 'A4'] };
        const state = handBuilt(['A', 'B', 'A', 'B'], other(winner), forestStar, { result });
        const faces = looks(state, { kind: 'take', by: winner }, mode);
        expect(faces[winner === 'A' ? 0 : 1]).toEqual(['won', 'bounce']);
        expect(faces[winner === 'A' ? 1 : 0]).toEqual(['lost', null]);
        // Shown again later (no event), the faces stay and nothing moves.
        expect(looks(state, NO_EVENT, mode)[winner === 'A' ? 0 : 1]).toEqual(['won', null]);
      }
    }
  });

  it.each(MODES)('leaves both idle with no motion after a draw: %s', (_name, mode) => {
    const tokens = Array.from({ length: 16 }, (_, i) => (i % 2 ? 'B' : 'A') as Player);
    const state = handBuilt(tokens, 'A', forestStar, { result: { kind: 'draw', by: 'full-board' } });
    for (const by of ['A', 'B'] as const) {
      expect(looks(state, { kind: 'take', by }, mode)).toEqual([
        ['idle', null],
        ['idle', null],
      ]);
    }
  });

  it('gives the same faces and reactions for two different boards with the same last event', () => {
    const one = handBuilt(['A', 'B', 'A', 'B', 'A'], 'B', forestStar);
    const two = handBuilt([null, null, 'A', 'B', null, 'A', 'B', 'A', null, null, 'B', 'A'], 'B', { terrain: 'Desert', symbol: 'Wave' });
    expect(one.tokens).not.toEqual(two.tokens);
    for (const [, mode] of MODES) {
      for (const event of [NO_EVENT, { kind: 'take', by: 'A' } as const, { kind: 'refusal', by: 'B' } as const]) {
        expect(avatarLooks(one, event, mode, 4)).toEqual(avatarLooks(two, event, mode, 4));
      }
    }
  });

  it('derives the last event from the takes and the refusals, with a key that grows on every event', () => {
    const shownAt = 2;
    const base = (takes: number, toMove: Player) => handBuilt(Array.from({ length: takes }, (_, i) => (i % 2 ? 'B' : 'A') as Player), toMove, forestStar);
    const keys: number[] = [];
    const record = (result: ReturnType<typeof lastEvent>) => {
      keys.push(result.key);
      return result.event;
    };
    expect(record(lastEvent(base(2, 'A'), shownAt, null))).toEqual(NO_EVENT);
    expect(record(lastEvent(base(3, 'B'), shownAt, null))).toEqual({ kind: 'take', by: 'A' });
    expect(record(lastEvent(base(4, 'A'), shownAt, null))).toEqual({ kind: 'take', by: 'B' });
    // Two refusals in a row: each is the last event, each with a new key, so the wince plays twice.
    expect(record(lastEvent(base(4, 'A'), shownAt, { by: 'A', atTakes: 4, count: 1 }))).toEqual({ kind: 'refusal', by: 'A' });
    expect(record(lastEvent(base(4, 'A'), shownAt, { by: 'A', atTakes: 4, count: 2 }))).toEqual({ kind: 'refusal', by: 'A' });
    // The next take makes the refusal old news.
    expect(record(lastEvent(base(5, 'B'), shownAt, { by: 'A', atTakes: 4, count: 2 }))).toEqual({ kind: 'take', by: 'A' });
    expect(keys).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
