import type { PlayerId, PlayerView } from '@okiya/rules';
import { constraintText, describeResult } from './text';

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

export interface TurnInput {
  readonly human: PlayerId;
  /** The number of legal actions available to the human now. */
  readonly legalCount: number;
  /** The selected fighter's name and its number of legal actions, if one is selected. */
  readonly selection?: { readonly name: string; readonly optionCount: number } | null;
}

function actionsText(count: number): string {
  return `${count} legal action${count === 1 ? '' : 's'}`;
}

export function constraintWords(view: Pick<PlayerView, 'constraint'>): string {
  return view.constraint ? constraintText(view.constraint) : 'any outside-edge cell (opening, no constraint yet)';
}

export function turnState(view: PlayerView, { human, legalCount, selection }: TurnInput): TurnState {
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
  const target = view.constraint ? `a highlighted cell matching ${constraint}` : 'a highlighted outside-edge cell';
  const prompt = selection
    ? `${selection.name} selected: ${actionsText(selection.optionCount)}. Choose ${target}${
        selection.optionCount > 0 ? ', or an action button' : ''
      }.`
    : `You have ${actionsText(legalCount)}. Select a fighter, then ${target}.`;
  return { headline: 'Your turn', constraint, prompt, humanTurn: true, botThinking: false };
}

/** The whole turn state as one sentence, for screen readers and tests. */
export function turnSentence(state: TurnState): string {
  return `${state.headline}. Constraint: ${state.constraint}. ${state.prompt}`;
}
