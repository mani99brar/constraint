import { describe, expect, it } from 'vitest';
import { SPEC_V0_2 } from '@okiya/content';
import { playerView, type PlayerView } from '@okiya/rules';
import { createMatch, HUMAN, prepare } from './match';
import { defaultHumanSetup } from './setup';
import { OPENING_LABEL, topBarModel } from './topbar';

const base = playerView(createMatch(prepare(1), defaultHumanSetup(1, SPEC_V0_2), 3), HUMAN);
// Hand-built: the player to move under Forest or Moon, with recharges spent on both sides.
const view: PlayerView = { ...base, activePlayer: 'A', constraint: { terrain: 'Forest', symbol: 'Moon' }, recharges: { A: 2, B: 0 }, result: null };

describe('top bar model (PRD T4, U5)', () => {
  it('gives the turn text, the two constraint emblems and both sides’ recharge pips', () => {
    const model = topBarModel(view, HUMAN);
    expect(model.turnText).toBe('Your turn');
    expect(model.humanTurn).toBe(true);
    expect(model.botThinking).toBe(false);
    expect(model.constraint).toEqual([
      { kind: 'terrain', terrain: 'Forest', name: 'Forest' },
      { kind: 'symbol', symbol: 'Moon', name: 'Moon' },
    ]);
    expect(model.constraintLabel).toBe('Constraint: Forest or Moon');
    expect(model.recharges).toEqual([
      { player: 'A', side: 'You', left: 2, total: 3, pips: [true, true, false], label: 'Your recharges: 2 of 3 left' },
      { player: 'B', side: 'Bot', left: 0, total: 3, pips: [false, false, false], label: "Bot's recharges: 0 of 3 left" },
    ]);
    expect(model.goal).toEqual({ objective: 'Square', label: 'Goal: Square' });
  });

  it('says the bot is thinking on its turn', () => {
    const model = topBarModel({ ...view, activePlayer: 'B' }, HUMAN);
    expect(model.turnText).toBe('Bot is thinking');
    expect(model.botThinking).toBe(true);
    expect(model.humanTurn).toBe(false);
  });

  it('shows the opening instead of emblems before the first deployment', () => {
    const model = topBarModel({ ...view, constraint: null }, HUMAN);
    expect(model.constraint).toBeNull();
    expect(model.constraintLabel).toBe(OPENING_LABEL);
  });

  it('gives the result once the match has ended', () => {
    const model = topBarModel({ ...view, result: { kind: 'win', winner: 'B', reason: 'objective' } }, HUMAN);
    expect(model.turnText).toBe('The bot wins by completing a square.');
    expect(model.humanTurn).toBe(false);
    expect(model.botThinking).toBe(false);
  });
});
