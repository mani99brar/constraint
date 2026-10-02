import { describe, expect, it } from 'vitest';
import { describeRefusal } from './text';

describe('refusal text (PRD R4)', () => {
  it('names the tile and the constraint it fails to match', () => {
    expect(
      describeRefusal({
        code: 'no-match',
        cell: 'C3',
        tile: { terrain: 'Desert', symbol: 'Moon' },
        constraint: { terrain: 'Forest', symbol: 'Star' },
      }),
    ).toBe('Desert–Moon does not match Forest or Star.');
  });
});
