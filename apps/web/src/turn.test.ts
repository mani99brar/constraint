import { describe, expect, it } from 'vitest';
import { SPEC_V0_2 } from '@okiya/content';
import { listLegalActions, playerView, type PlayerView } from '@okiya/rules';
import { createMatch, HUMAN, prepare } from './match';
import { defaultHumanSetup } from './setup';
import { turnSentence, turnState } from './turn';

const opening = playerView(createMatch(prepare(1), defaultHumanSetup(1, SPEC_V0_2), 3), HUMAN);
const constrained: PlayerView = { ...opening, activePlayer: 'A', constraint: { terrain: 'Forest', symbol: 'Moon' } };

describe('turn-state text (PRD U5)', () => {
  it('names whose turn it is, the constraint in words and the number of available actions', () => {
    const state = turnState(constrained, { human: HUMAN, legalCount: 12 });
    expect(state.headline).toBe('Your turn');
    expect(state.constraint).toBe('Forest or Moon');
    expect(state.prompt).toBe('You have 12 legal actions. Select a fighter, then a highlighted cell matching Forest or Moon.');
    expect(turnSentence(state)).toBe(
      'Your turn. Constraint: Forest or Moon. You have 12 legal actions. Select a fighter, then a highlighted cell matching Forest or Moon.',
    );
    expect(state.humanTurn).toBe(true);
    expect(state.botThinking).toBe(false);
  });

  it('counts the selected fighter’s actions, in the singular for one', () => {
    const state = turnState(constrained, { human: HUMAN, legalCount: 9, selection: { name: 'Pusher', optionCount: 1 } });
    expect(state.prompt).toBe('Pusher selected: 1 legal action. Choose a highlighted cell matching Forest or Moon, or an action button.');
  });

  it('explains the opening deployment before any constraint exists', () => {
    const state = turnState({ ...opening, activePlayer: 'A' }, { human: HUMAN, legalCount: 48 });
    expect(state.constraint).toContain('outside-edge');
    expect(state.prompt).toContain('48 legal actions');
  });

  it('says the bot is thinking during its turn', () => {
    const state = turnState({ ...constrained, activePlayer: 'B' }, { human: HUMAN, legalCount: 0 });
    expect(state.headline).toBe("Bot's turn");
    expect(state.constraint).toBe('Forest or Moon');
    expect(state.prompt).toMatch(/^The bot is thinking/);
    expect(state.botThinking).toBe(true);
    expect(state.humanTurn).toBe(false);
  });

  it('gives the result once the match has ended', () => {
    const state = turnState({ ...constrained, result: { kind: 'draw', reason: 'repetition' } }, { human: HUMAN, legalCount: 0 });
    expect(state.headline).toBe('Draw by repetition.');
    expect(state.botThinking).toBe(false);
  });

  it('matches the engine’s count in a real opening', () => {
    const state = createMatch(prepare(1), defaultHumanSetup(1, SPEC_V0_2), 3);
    if (state.activePlayer !== HUMAN) return;
    const count = listLegalActions(state).length;
    expect(turnState(playerView(state, HUMAN), { human: HUMAN, legalCount: count }).prompt).toContain(`${count} legal actions`);
  });
});
