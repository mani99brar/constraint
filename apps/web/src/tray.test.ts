import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FighterId, FighterState } from '@okiya/rules';
import { trayContents } from './tray';
import { BotTray, OwnTray } from './Tray';

const fighter = (id: FighterState['id'], cell: FighterState['cell']): FighterState => ({
  id,
  owner: id[0] as 'A' | 'B',
  type: id.slice(2) as FighterState['type'],
  cell,
  charge: 1,
  lock: null,
  protection: null,
});

// Hand-built: two of the player's four deployed, one of the bot's; the view lists only deployed bot fighters.
const view = {
  fighters: [fighter('A:Teleporter', 'A1'), fighter('A:Pusher', null), fighter('B:Swapper', 'D4'), fighter('A:Anchor', null), fighter('A:Trapper', 'B2')],
  reserveCounts: { A: 2, B: 3 },
};

describe('piece trays (PRD T2)', () => {
  it('holds exactly the player’s reserve, in the view’s order', () => {
    const trays = trayContents(view, 'A');
    expect(trays.own.map((token) => token.id)).toEqual(['A:Pusher', 'A:Anchor']);
    expect(trays.showOwn).toBe(true);
  });

  it('shows only the bot’s reserve count, face down', () => {
    const trays = trayContents(view, 'A');
    expect(trays.botCount).toBe(3);
    expect(trays.showBot).toBe(true);
    const html = renderToStaticMarkup(createElement(BotTray, { count: trays.botCount }));
    expect(html.match(/data-testid="face-down-token"/g)).toHaveLength(3);
    expect(html).not.toMatch(/data-fighter|Swapper|Upgrader|Puller|Trapper/);
  });

  it('hides a tray once it is empty', () => {
    const empty = trayContents({ fighters: [fighter('A:Teleporter', 'A1')], reserveCounts: { A: 0, B: 0 } }, 'A');
    expect(empty).toEqual({ own: [], botCount: 0, showOwn: false, showBot: false });
    expect(renderToStaticMarkup(createElement(BotTray, { count: 0 }))).toBe('');
    expect(renderToStaticMarkup(createElement(OwnTray, { tokens: [], selected: null, playable: new Set<FighterId>(), disabled: false, onSelect: () => {} }))).toBe('');
  });
});
