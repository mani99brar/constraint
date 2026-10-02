import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIGHTERS, OBJECTIVES, SPEC_V0_2 } from '@okiya/content';
import { ALL_CELLS, applyAction, listLegalActions, playerView, type FighterState, type MatchState, type PlayerView } from '@okiya/rules';
import { MatchScreen } from './MatchScreen';
import { SetupScreen } from './SetupScreen';
import { Board } from './Board';
import { EndScreen } from './EndScreen';
import { createMatch, HUMAN, prepare } from './match';
import { DEFAULT_SETTINGS } from './settings';
import { defaultHumanSetup } from './setup';
import { fighterHelp } from './text';
import { cellAccessibleName } from './tokens';

function decode(html: string): string {
  return html.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

const runningState = createMatch(prepare(5), defaultHumanSetup(5, SPEC_V0_2), 11);
const running = playerView(runningState, HUMAN);

// Hand-built: no match in this worktree reaches an end with traps triggered or removed (PRD R6).
const finished: PlayerView = {
  ...running,
  result: { kind: 'win', winner: 'B', reason: 'objective' },
  reveal: {
    objectives: { A: 'Square', B: 'Square' },
    rosters: { A: ['Teleporter', 'Pusher', 'TrapChecker', 'TerrainWeaver'], B: ['Swapper', 'Upgrader', 'Puller', 'Trapper'] },
    trapHistory: [
      { id: 'A-setup-1', owner: 'A', cell: 'B2', source: 'setup', placedOnTurn: 0, placedBy: null, fate: { kind: 'live' } },
      {
        id: 'A-setup-2',
        owner: 'A',
        cell: 'C3',
        source: 'setup',
        placedOnTurn: 0,
        placedBy: null,
        fate: { kind: 'triggered', turn: 4, fighter: 'B:Swapper' },
      },
      {
        id: 'B-setup-1',
        owner: 'B',
        cell: 'A3',
        source: 'setup',
        placedOnTurn: 0,
        placedBy: null,
        fate: { kind: 'removed', turn: 5, by: 'A:TrapChecker' },
      },
      { id: 'B-setup-2', owner: 'B', cell: 'D2', source: 'setup', placedOnTurn: 0, placedBy: null, fate: { kind: 'live' } },
      {
        id: 'B-trap-5',
        owner: 'B',
        cell: 'C1',
        source: 'trapper',
        placedOnTurn: 8,
        placedBy: 'B:Trapper',
        fate: { kind: 'triggered', turn: 9, fighter: 'A:Pusher' },
      },
    ],
  },
};

describe('end screen (PRD R6)', () => {
  it('shows the result, both objectives, both rosters and every trap with its cell and fate', () => {
    const html = decode(renderToStaticMarkup(createElement(EndScreen, { view: finished, human: HUMAN })));
    expect(html).toContain('The bot wins by completing a square.');
    expect(html).toContain('Objectives: you Square, bot Square');
    expect(html).toContain('Your roster: Teleporter, Pusher, Trap Checker, Terrain Weaver');
    expect(html).toContain('Bot roster: Swapper, Upgrader, Puller, Trapper');
    expect(html).toContain('Your setup trap at B2: never triggered');
    expect(html).toContain("Your setup trap at C3: triggered on turn 4 by bot's Swapper");
    expect(html).toContain("Bot's setup trap at A3: removed on turn 5 by your Trap Checker");
    expect(html).toContain("Bot's setup trap at D2: never triggered");
    expect(html).toContain("Bot's trap placed on turn 8 at C1: triggered on turn 9 by your Pusher");
    expect(html.match(/<li /g)).toHaveLength(5);
  });

  it('shows nothing while the match runs', () => {
    expect(renderToStaticMarkup(createElement(EndScreen, { view: running, human: HUMAN }))).toBe('');
  });
});

describe('board accessible names (PRD U3)', () => {
  it('names every cell and fighter', () => {
    const pusher: FighterState = { id: 'A:Pusher', owner: 'A', type: 'Pusher', cell: 'B3', charge: 1, lock: null, protection: null };
    const swapper: FighterState = { id: 'B:Swapper', owner: 'B', type: 'Swapper', cell: 'C1', charge: 0, lock: null, protection: null };
    const html = decode(
      renderToStaticMarkup(
        createElement(Board, {
          testId: 'board',
          board: running.board,
          human: HUMAN,
          fighters: [pusher, swapper],
          ownTraps: new Set(['D4' as const]),
          onCellClick: () => {},
        }),
      ),
    );
    expect(html.match(/role="gridcell"/g)).toHaveLength(ALL_CELLS.length);
    for (const cell of ALL_CELLS) {
      const fighter = [pusher, swapper].find((candidate) => candidate.cell === cell);
      expect(html).toContain(`aria-label="${cellAccessibleName(cell, running.board[cell], fighter, HUMAN, cell === 'D4')}"`);
    }
    const b3 = running.board.B3;
    expect(html).toContain(`aria-label="B3, ${b3.terrain}–${b3.symbol}, Your Pusher on B3, charged, not locked, not protected"`);
    expect(html).toContain(`Bot's Swapper on C1, spent, not locked, not protected"`);
    expect(html).toContain(', your trap"');
  });
});

/** A match a few actions in, so the log, both trays and the board all have something to show. */
function played(actions: number): MatchState {
  let state = runningState;
  for (let i = 0; i < actions && !state.result; i += 1) {
    const applied = applyAction(state, listLegalActions(state)[0]!);
    if (!applied.ok) throw new Error('first legal action refused');
    state = applied.state;
  }
  return state;
}

describe('the tabletop match screen (PRD T1)', () => {
  const state = played(4);
  const html = decode(renderToStaticMarkup(createElement(MatchScreen, { initialState: state, depth: 'normal', settings: DEFAULT_SETTINGS, onLeave: () => {} })));

  it('renders no log, last-actions, status, reserve-list, on-the-board, legend or settings panel', () => {
    expect(playerView(state, HUMAN).log.length).toBe(4);
    for (const testId of ['log', 'resolution', 'status', 'charges', 'deployed', 'reserve', 'on-board', 'legend', 'settings', 'menu-settings', 'turn-prompt', 'actions', 'chooser']) {
      expect(html, testId).not.toContain(`data-testid="${testId}"`);
    }
    for (const heading of ['Log', 'Last actions', 'Status', 'Your reserve', 'On the board', 'Settings', 'Legend']) {
      expect(html, heading).not.toMatch(new RegExp(`<h[1-6][^>]*>${heading}</h`));
      expect(html, heading).not.toContain(`aria-label="${heading}"`);
    }
    expect(html).not.toContain('class="legend');
    expect(html).not.toMatch(/Turn \d+ ·/);
    expect(html).not.toMatch(/legal actions?\b/);
  });

  it('renders the top bar, both trays and the board, and nothing else but the menu button', () => {
    for (const testId of ['top-bar', 'turn', 'constraint', 'recharges', 'goal-chip', 'menu-button', 'bot-tray', 'board', 'own-tray', 'toasts']) {
      expect(html, testId).toContain(`data-testid="${testId}"`);
    }
    expect(html).not.toContain('data-testid="menu"');
    expect(html).not.toContain('data-testid="end-screen"');
  });
});

describe('objective and fighter help in words (PRD E3)', () => {
  const square = OBJECTIVES.find((objective) => objective.id === 'Square')!;
  const setupHtml = decode(renderToStaticMarkup(createElement(SetupScreen, { prepared: prepare(5), depth: 'normal', onStart: () => {}, onLeave: () => {} })));
  const matchHtml = decode(
    renderToStaticMarkup(createElement(MatchScreen, { initialState: runningState, depth: 'normal', settings: DEFAULT_SETTINGS, onLeave: () => {} })),
  );

  it('explains the player’s objective from its summary on the setup screen, and as the goal chip during the match', () => {
    expect(setupHtml).toContain(`Your goal: Square.</strong> ${square.summary}`);
    expect(matchHtml).toMatch(/data-testid="goal-chip"[^>]*>Goal: Square</);
  });

  it('takes every fighter’s help text from FIGHTERS', () => {
    for (const fighter of FIGHTERS) {
      expect(fighterHelp(fighter.type)).toBe(fighter.summary);
      expect(setupHtml).toContain(fighter.summary);
    }
    for (const type of defaultHumanSetup(5, SPEC_V0_2).roster) expect(matchHtml).toContain(`data-fighter="A:${type}"`);
  });

  it('renders none of the bot’s reserve, traps or objective while the match runs (PRD I4)', () => {
    const botSetup = runningState.setups.B;
    for (const type of botSetup.roster) expect(matchHtml).not.toContain(`B:${type}`);
    const trapCells = [...matchHtml.matchAll(/data-cell="([A-D][1-4])"[^>]*data-own-trap="true"/g)].map((match) => match[1]);
    expect(trapCells.sort()).toEqual([...runningState.setups.A.traps].sort());
    expect(matchHtml).not.toContain('Bot roster');
    expect(matchHtml).not.toContain('bot Square');
  });
});
