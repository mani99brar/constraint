import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SPEC_V0_2 } from '@okiya/content';
import { listLegalActions, playerView, type Action, type PlayerView } from '@okiya/rules';
import { createMatch, HUMAN, prepare } from './match';
import { MatchScreen } from './MatchScreen';
import { DEFAULT_SETTINGS } from './settings';
import { defaultHumanSetup } from './setup';
import { ABILITY_MATCH, turnSentence, turnState } from './turn';

const opening = playerView(createMatch(prepare(1), defaultHumanSetup(1, SPEC_V0_2), 3), HUMAN);
const constrained: PlayerView = { ...opening, activePlayer: 'A', constraint: { terrain: 'Forest', symbol: 'Moon' } };

const anchorAbilities: Action[] = [
  { kind: 'ability', fighter: 'A:Anchor', target: 'B2' },
  { kind: 'ability', fighter: 'A:Anchor', target: 'B3' },
];

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

  it('names the acting fighter’s own tile as the one that must match when its ability gates on the actor', () => {
    const state = turnState(constrained, {
      human: HUMAN,
      legalCount: 9,
      selection: { name: 'Anchor', type: 'Anchor', cell: 'B2', tile: { terrain: 'Forest', symbol: 'Sun' }, options: anchorAbilities },
    });
    expect(state.prompt).toBe(
      "Anchor selected: 2 legal actions. Ability: Anchor's own tile (B2, Forest–Sun) must match Forest or Moon, not the target's; choose a highlighted target.",
    );
    expect(state.prompt).not.toContain('highlighted cell matching');
    for (const type of ['Upgrader', 'TrapChecker', 'Anchor', 'TerrainWeaver', 'Trapper'] as const) expect(ABILITY_MATCH[type]).toBe('actor');
  });

  it('names the target’s tile for a displacer and the destination for Teleporter (spec §9)', () => {
    const pusher = turnState(constrained, {
      human: HUMAN,
      legalCount: 9,
      selection: {
        name: 'Pusher',
        type: 'Pusher',
        cell: 'C2',
        tile: { terrain: 'Water', symbol: 'Star' },
        options: [
          { kind: 'move', fighter: 'A:Pusher', cell: 'C3' },
          { kind: 'ability', fighter: 'A:Pusher', target: 'C1' },
        ],
      },
    });
    expect(pusher.prompt).toBe(
      'Pusher selected: 2 legal actions. Move: a highlighted adjacent empty cell matching Forest or Moon. Ability: choose a highlighted target whose tile matches Forest or Moon.',
    );
    const teleporter = turnState(constrained, {
      human: HUMAN,
      legalCount: 9,
      selection: { name: 'Teleporter', type: 'Teleporter', cell: 'A1', tile: null, options: [{ kind: 'ability', fighter: 'A:Teleporter', target: 'D4' }] },
    });
    expect(teleporter.prompt).toBe('Teleporter selected: 1 legal action. Ability: choose a highlighted empty cell matching Forest or Moon.');
  });

  it('asks a reserve fighter for an empty matching cell, without "highlighted" when highlights are off', () => {
    const selection = { name: 'Pusher', type: 'Pusher', cell: null, tile: null, options: [{ kind: 'deploy', fighter: 'A:Pusher', cell: 'B2' }] } as const;
    expect(turnState(constrained, { human: HUMAN, legalCount: 9, selection }).prompt).toBe(
      'Pusher selected: 1 legal action. Deploy it on a highlighted empty cell matching Forest or Moon.',
    );
    expect(turnState(constrained, { human: HUMAN, legalCount: 9, selection, highlights: false }).prompt).toBe(
      'Pusher selected: 1 legal action. Deploy it on an empty cell matching Forest or Moon.',
    );
    expect(turnState(constrained, { human: HUMAN, legalCount: 9, highlights: false }).prompt).toBe(
      'You have 9 legal actions. Select a fighter, then a cell matching Forest or Moon.',
    );
  });

  it('explains the opening deployment before any constraint exists', () => {
    const state = turnState({ ...opening, activePlayer: 'A' }, { human: HUMAN, legalCount: 48 });
    expect(state.constraint).toContain('outside-edge');
    expect(state.prompt).toBe('You have 48 legal actions. Select a fighter, then a highlighted outside-edge cell.');
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

  it('shows the total of available actions on the match screen, with no reserve fighter selected', () => {
    let seed = 1;
    let state = createMatch(prepare(seed), defaultHumanSetup(seed, SPEC_V0_2), 3);
    while (state.activePlayer !== HUMAN) {
      seed += 1;
      state = createMatch(prepare(seed), defaultHumanSetup(seed, SPEC_V0_2), 3);
    }
    const count = listLegalActions(state).length;
    const html = renderToStaticMarkup(createElement(MatchScreen, { initialState: state, depth: 'normal', settings: DEFAULT_SETTINGS, onLeave: () => {} }));
    expect(html).toContain(`You have ${count} legal actions. Select a fighter`);
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain('data-highlighted="true"');
    expect(html).not.toContain('data-testid="actions"');
  });
});
