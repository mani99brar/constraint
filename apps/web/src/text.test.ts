import { describe, expect, it } from 'vitest';
import type { ActionRefusal, FighterState, SetupRefusal } from '@okiya/rules';
import { describeRefusal, describeSetupRefusal } from './text';
import { cellAccessibleName, tokenAccessibleName } from './tokens';

const tile = { terrain: 'Desert', symbol: 'Moon' } as const;
const constraint = { terrain: 'Forest', symbol: 'Star' } as const;

// One sample per code; the Record type makes the compiler fail when a code is missing.
const ACTION_REFUSALS: Record<ActionRefusal['code'], ActionRefusal> = {
  'match-over': { code: 'match-over' },
  'unknown-action': { code: 'unknown-action', kind: 'pass' },
  'not-your-fighter': { code: 'not-your-fighter', fighter: 'B:Pusher', activePlayer: 'A' },
  'unknown-cell': { code: 'unknown-cell', cell: 'E9' },
  'not-in-reserve': { code: 'not-in-reserve', fighter: 'A:Pusher' },
  'not-deployed': { code: 'not-deployed', fighter: 'A:Pusher' },
  'opening-must-deploy': { code: 'opening-must-deploy' },
  'not-edge-cell': { code: 'not-edge-cell', cell: 'B2' },
  'cell-occupied': { code: 'cell-occupied', cell: 'B2' },
  'no-match': { code: 'no-match', cell: 'C3', tile, constraint },
  'not-adjacent': { code: 'not-adjacent', from: 'A1', to: 'C3' },
  'fighter-locked': { code: 'fighter-locked', fighter: 'A:Swapper' },
  'no-charge': { code: 'no-charge', fighter: 'A:Teleporter' },
  'already-charged': { code: 'already-charged', fighter: 'A:Teleporter' },
  'no-recharges-left': { code: 'no-recharges-left', player: 'A' },
  'invalid-target': { code: 'invalid-target', fighter: 'A:Pusher', target: 'D4' },
};

const SETUP_REFUSALS: Record<SetupRefusal['code'], SetupRefusal> = {
  'roster-size': { code: 'roster-size', expected: 4, actual: 5 },
  'unknown-fighter': { code: 'unknown-fighter', fighter: 'Wizard' },
  'fighters-not-distinct': { code: 'fighters-not-distinct', fighter: 'TrapChecker' },
  'displacer-limit': { code: 'displacer-limit', limit: 1, actual: 2 },
  'trap-count': { code: 'trap-count', expected: 2, actual: 3 },
  'unknown-cell': { code: 'unknown-cell', cell: 'Z0' },
  'trap-cells-not-distinct': { code: 'trap-cells-not-distinct', cell: 'B2' },
};

describe('refusal text (PRD R4)', () => {
  it('names the tile and the constraint it fails to match', () => {
    expect(describeRefusal(ACTION_REFUSALS['no-match'])).toBe('Desert–Moon does not match Forest or Star.');
  });

  it.each(Object.values(ACTION_REFUSALS))('has readable text for the action refusal $code', (refusal) => {
    const text = describeRefusal(refusal);
    expect(text).toMatch(/^[A-Z0-9].*\.$/);
    expect(text).not.toContain(refusal.code);
    expect(text).not.toContain('undefined');
  });

  it.each(Object.values(SETUP_REFUSALS))('has readable text for the setup refusal $code', (refusal) => {
    const text = describeSetupRefusal(refusal);
    expect(text).toMatch(/^[A-Z0-9].*\.$/);
    expect(text).not.toContain(refusal.code);
    expect(text).not.toContain('undefined');
  });

  it('uses fighter names, not type ids', () => {
    expect(describeSetupRefusal(SETUP_REFUSALS['fighters-not-distinct'])).toContain('Trap Checker');
    expect(describeRefusal(ACTION_REFUSALS['fighter-locked'])).toBe('Swapper is locked.');
  });
});

describe('accessible names (PRD U3)', () => {
  const pusher: FighterState = { id: 'A:Pusher', owner: 'A', type: 'Pusher', cell: 'B3', charge: 1, lock: null, protection: null };

  it('names a cell by its id, tile, fighter and charge', () => {
    expect(cellAccessibleName('B3', { terrain: 'Water', symbol: 'Moon' }, pusher, 'A', false)).toBe(
      'B3, Water–Moon, Your Pusher on B3, charged, not locked, not protected',
    );
  });

  it('names an empty cell, an own trap, an enemy fighter, a lock and protection', () => {
    expect(cellAccessibleName('A1', { terrain: 'Forest', symbol: 'Sun' }, undefined, 'A', true)).toBe('A1, Forest–Sun, your trap');
    const swapper: FighterState = {
      id: 'B:Swapper',
      owner: 'B',
      type: 'Swapper',
      cell: 'C2',
      charge: 0,
      lock: { expiresAfterTurn: 7 },
      protection: { expiresAfterTurn: 6, by: 'B:Anchor' },
    };
    expect(cellAccessibleName('C2', { terrain: 'Desert', symbol: 'Wave' }, swapper, 'A', false)).toBe(
      "C2, Desert–Wave, Bot's Swapper on C2, spent, locked, protected",
    );
  });

  it('names a tray token', () => {
    expect(tokenAccessibleName({ ...pusher, cell: null }, 'A')).toBe('Your Pusher in your tray, charged, not locked, not protected');
  });

  it('marks an own trap the bot inspected as maybe removed', () => {
    expect(cellAccessibleName('A1', { terrain: 'Forest', symbol: 'Sun' }, undefined, 'A', true, true)).toBe(
      'A1, Forest–Sun, your trap, inspected by the bot, may have been removed',
    );
  });
});
