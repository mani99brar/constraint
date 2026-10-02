import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SPEC_V0_2 } from '@okiya/content';
import { playerView, type CellId, type FighterId, type FighterState } from '@okiya/rules';
import { Board } from './Board';
import { createMatch, HUMAN, prepare } from './match';
import { defaultHumanSetup } from './setup';
import { tokenAccessibleName, tokenState } from './tokens';
import { trayContents } from './tray';
import { OwnTray } from './Tray';

function decode(html: string): string {
  return html.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

const view = playerView(createMatch(prepare(5), defaultHumanSetup(5, SPEC_V0_2), 11), HUMAN);

// Hand-built tokens covering every state: own and bot, charged and spent, locked, protected, in the tray.
const TOKENS: readonly FighterState[] = [
  { id: 'A:Pusher', owner: 'A', type: 'Pusher', cell: 'B3', charge: 1, lock: null, protection: null },
  { id: 'A:Anchor', owner: 'A', type: 'Anchor', cell: 'C3', charge: 0, lock: null, protection: { expiresAfterTurn: 6, by: 'A:Anchor' } },
  { id: 'B:Swapper', owner: 'B', type: 'Swapper', cell: 'C1', charge: 0, lock: { expiresAfterTurn: 7 }, protection: null },
  { id: 'A:TrapChecker', owner: 'A', type: 'TrapChecker', cell: null, charge: 1, lock: null, protection: null },
];

/** Owner, fighter, cell, charge, lock and protection, each stated. */
const STATES = /^(Your|Bot's) (Pusher|Anchor|Swapper|Trap Checker) (on [A-D][1-4]|in your tray), (charged|spent), (locked|not locked), (protected|not protected)$/;

describe('token accessible names (PRD T5, U3)', () => {
  it('state owner, fighter, cell, charge, lock and protection', () => {
    expect(TOKENS.map((fighter) => tokenAccessibleName(fighter, HUMAN))).toEqual([
      'Your Pusher on B3, charged, not locked, not protected',
      'Your Anchor on C3, spent, not locked, protected',
      "Bot's Swapper on C1, spent, locked, not protected",
      'Your Trap Checker in your tray, charged, not locked, not protected',
    ]);
    for (const fighter of TOKENS) expect(tokenAccessibleName(fighter, HUMAN)).toMatch(STATES);
  });

  it('carry the same state on every rendered token, on the board and in the tray', () => {
    const board = decode(
      renderToStaticMarkup(createElement(Board, { testId: 'board', board: view.board, human: HUMAN, fighters: TOKENS, ownTraps: new Set<CellId>(), onCellClick: () => {} })),
    );
    const tray = decode(
      renderToStaticMarkup(
        createElement(OwnTray, { tokens: trayContents({ fighters: TOKENS, reserveCounts: { A: 1, B: 0 } }, HUMAN).own, selected: null, playable: new Set<FighterId>(), disabled: false, onSelect: () => {} }),
      ),
    );
    const labels = [...`${board}${tray}`.matchAll(/data-label="([^"]+)"/g)].map((match) => match[1]!);
    expect(labels).toHaveLength(TOKENS.length);
    for (const label of labels) expect(label).toMatch(STATES);
    // Each board cell and tray button is named with its token's full state.
    for (const fighter of TOKENS) expect(`${board}${tray}`).toContain(`${tokenAccessibleName(fighter, HUMAN)}"`);
    expect(tray).toContain(`aria-label="${tokenAccessibleName(TOKENS[3]!, HUMAN)}"`);
    expect(board).toContain(`data-locked="true"`);
    expect(board).toContain(`data-protected="true"`);
  });

  it('draws charge, lock and protection on the token', () => {
    expect(tokenState(TOKENS[2]!, HUMAN)).toMatchObject({ own: false, charged: false, locked: true, protected: false, initials: 'SW', name: 'Swapper' });
    const html = renderToStaticMarkup(createElement(Board, { testId: 'board', board: view.board, human: HUMAN, fighters: TOKENS, ownTraps: new Set<CellId>(), onCellClick: () => {} }));
    expect(html.match(/class="token-badge lock"/g)).toHaveLength(1);
    expect(html.match(/class="token-badge shield"/g)).toHaveLength(1);
    expect(html.match(/class="token-charge full"/g)).toHaveLength(1);
  });
});
