import type { Action, CellId, FighterType, PlayerId, PlayerView, Tile } from '@okiya/rules';
import { constraintText, describeResult, tileName } from './text';

/** What the status bar says about the turn (PRD U5), without reading the log. */
export interface TurnState {
  /** Whose turn it is, or the result once the match has ended. */
  readonly headline: string;
  /** The constraint in words, for example "Forest or Moon". */
  readonly constraint: string;
  /** What the player can do now, or that the bot is thinking. */
  readonly prompt: string;
  readonly humanTurn: boolean;
  readonly botThinking: boolean;
}

/**
 * Which tile an ability's matching applies to (spec §9): the actor's own tile for the abilities
 * gated on the actor, the target's tile for the displacers, and the destination for Teleporter.
 */
export type AbilityMatch = 'actor' | 'target' | 'destination';

export const ABILITY_MATCH: Readonly<Record<FighterType, AbilityMatch>> = {
  Teleporter: 'destination',
  Pusher: 'target',
  Swapper: 'target',
  Puller: 'target',
  Upgrader: 'actor',
  TrapChecker: 'actor',
  Anchor: 'actor',
  TerrainWeaver: 'actor',
  Trapper: 'actor',
};

/** The selected fighter, where it stands and its legal actions. */
export interface TurnSelection {
  readonly name: string;
  readonly type: FighterType;
  readonly cell: CellId | null;
  /** The tile under the fighter, when it is deployed. */
  readonly tile: Tile | null;
  readonly options: readonly Action[];
}

export interface TurnInput {
  readonly human: PlayerId;
  /** The number of legal actions available to the human now. */
  readonly legalCount: number;
  /** The selected fighter, if the player has selected one; nothing is selected by default. */
  readonly selection?: TurnSelection | null;
  /** Whether legal cells are highlighted on the board (PRD E4); the words follow the setting. */
  readonly highlights?: boolean;
}

function actionsText(count: number): string {
  return `${count} legal action${count === 1 ? '' : 's'}`;
}

export function constraintWords(view: Pick<PlayerView, 'constraint'>): string {
  return view.constraint ? constraintText(view.constraint) : 'any outside-edge cell (opening, no constraint yet)';
}

/** "a highlighted target" with highlights on, "a target" or "an empty cell" with them off. */
type Mark = (noun: string) => string;

function marker(highlights: boolean): Mark {
  return (noun) => (highlights ? `a highlighted ${noun}` : `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`);
}

function selectionPrompt(selection: TurnSelection, constraint: string, opening: boolean, mark: Mark): string {
  const { name, options } = selection;
  if (options.length === 0) return `${name} selected: no legal action now. Select another fighter.`;
  const head = `${name} selected: ${actionsText(options.length)}.`;
  if (selection.cell === null) {
    return `${head} Deploy it on ${opening ? mark('outside-edge cell') : `${mark('empty cell')} matching ${constraint}`}.`;
  }
  const count = (kind: Action['kind']) => options.filter((option) => option.kind === kind).length;
  const parts = [head];
  if (count('move') > 0) parts.push(`Move: ${mark('adjacent empty cell')} matching ${constraint}.`);
  if (count('ability') > 0) {
    switch (ABILITY_MATCH[selection.type]) {
      case 'actor': {
        const tile = selection.tile ? ` (${selection.cell}, ${tileName(selection.tile)})` : '';
        parts.push(`Ability: ${name}'s own tile${tile} must match ${constraint}, not the target's; choose ${mark('target')}.`);
        break;
      }
      case 'target':
        parts.push(`Ability: choose ${mark('target')} whose tile matches ${constraint}.`);
        break;
      case 'destination':
        parts.push(`Ability: choose ${mark('empty cell')} matching ${constraint}.`);
        break;
    }
  }
  if (count('recharge') > 0) parts.push(`Recharge: its tile matches ${constraint}; use the Recharge button.`);
  return parts.join(' ');
}

export function turnState(view: PlayerView, { human, legalCount, selection, highlights = true }: TurnInput): TurnState {
  const constraint = constraintWords(view);
  if (view.result) {
    return { headline: describeResult(view.result, human), constraint, prompt: 'The match is over.', humanTurn: false, botThinking: false };
  }
  if (view.activePlayer !== human) {
    return {
      headline: "Bot's turn",
      constraint,
      prompt: 'The bot is thinking… Your controls are paused until it has moved.',
      humanTurn: false,
      botThinking: true,
    };
  }
  const mark = marker(highlights);
  const opening = view.constraint === null;
  const prompt = selection
    ? selectionPrompt(selection, constraint, opening, mark)
    : `You have ${actionsText(legalCount)}. Select a fighter, then ${
        opening ? mark('outside-edge cell') : `${mark('cell')} matching ${constraint}`
      }.`;
  return { headline: 'Your turn', constraint, prompt, humanTurn: true, botThinking: false };
}

/** The whole turn state as one sentence, for screen readers and tests. */
export function turnSentence(state: TurnState): string {
  return `${state.headline}. Constraint: ${state.constraint}. ${state.prompt}`;
}
