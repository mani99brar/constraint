import { useState } from 'react';
import { FIGHTERS } from '@okiya/content';
import { fighterId, type FighterState, type FighterType, type PreparedMatch, type Setup } from '@okiya/rules';
import { Board } from './Board';
import { depthLabel, type BotDepthId } from './difficulty';
import { objectiveSummary } from './howto';
import { HUMAN } from './match';
import { addFighter, defaultHumanSetup, EMPTY_DRAFT, removeFighter, setupRefusals, toggleTrap, type DraftChange, type SetupDraft } from './setup';
import { describeSetupRefusal, fighterName } from './text';
import { Token } from './Token';
import { tokenState } from './tokens';

export interface SetupScreenProps {
  readonly prepared: PreparedMatch;
  readonly depth: BotDepthId;
  readonly onStart: (setup: Setup) => void;
  readonly onLeave: () => void;
  readonly onHowTo?: (opener: HTMLElement) => void;
}

/** A fresh, charged token of the player's, as it waits in the tray. */
function freshToken(type: FighterType) {
  const fighter: FighterState = { id: fighterId(HUMAN, type), owner: HUMAN, type, cell: null, charge: 1, lock: null, protection: null };
  return tokenState(fighter, HUMAN);
}

/** Setup (spec §5, PRD S2): fighters picked as tokens, setup traps placed by tapping the revealed board. */
export function SetupScreen({ prepared, depth, onStart, onLeave, onHowTo }: SetupScreenProps) {
  const { preset } = prepared;
  const [draft, setDraft] = useState<SetupDraft>(EMPTY_DRAFT);
  const [refusals, setRefusals] = useState<string[]>([]);
  const objective = preset.objectivePool[0] ?? 'Square';
  const limit = preset.variants.displacerLimit;

  function change(result: DraftChange) {
    setDraft(result.draft);
    setRefusals(result.refusal ? [describeSetupRefusal(result.refusal)] : []);
  }

  function start() {
    const refused = setupRefusals(draft, preset);
    if (refused.length > 0) {
      setRefusals(refused.map(describeSetupRefusal));
      return;
    }
    onStart(draft);
  }

  return (
    <main className="setup" data-testid="setup-screen">
      <header className="screen-head">
        <h1>Setup</h1>
        <span className="muted" data-testid="bot-depth">
          Bot: {depthLabel(depth)}
        </span>
        <span className="head-buttons">
          {onHowTo && (
            <button type="button" onClick={(event) => onHowTo(event.currentTarget)}>
              How to play
            </button>
          )}
          <button type="button" onClick={onLeave}>
            Back
          </button>
        </span>
      </header>
      <p className="objective" data-testid="objective">
        <strong>Your goal: {objective}.</strong> {objectiveSummary(objective)}
      </p>

      <div className="setup-layout">
        <section className="card setup-step" aria-labelledby="pick-title">
          <h2 id="pick-title">
            1. Pick {preset.rosterSize} fighters{limit !== null ? `, at most ${limit} displacers` : ''}
          </h2>
          <div className="pool" data-testid="pool">
            {FIGHTERS.map((fighter) => {
              const picked = draft.roster.includes(fighter.type);
              return (
                <button
                  type="button"
                  key={fighter.type}
                  className={`pool-token${picked ? ' picked' : ''}`}
                  data-fighter={fighter.type}
                  data-displacer={fighter.displacer}
                  aria-label={fighter.name}
                  aria-pressed={picked}
                  aria-describedby={`help-${fighter.type}`}
                  onClick={() => change(addFighter(draft, fighter.type, preset))}
                >
                  <Token token={freshToken(fighter.type)} />
                  <span className="pool-text">
                    <strong>{fighter.name}</strong>
                    <span id={`help-${fighter.type}`} className="help" data-help={fighter.type}>
                      {fighter.displacer && <span className="tag">Displacer</span>} {fighter.summary}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="tray roster-tray" aria-label="Your roster" role="group" data-testid="roster" data-count={draft.roster.length}>
            {Array.from({ length: preset.rosterSize }, (_, index) => {
              const type = draft.roster[index];
              return type ? (
                <button type="button" key={type} className="tray-token" data-fighter={type} aria-label={`Remove ${fighterName(type)}`} onClick={() => setDraft(removeFighter(draft, type))}>
                  <Token token={freshToken(type)} />
                </button>
              ) : (
                <span key={`empty-${index}`} className="empty-slot" aria-hidden="true" />
              );
            })}
          </div>
          <p className="help">
            Your roster: {draft.roster.length} of {preset.rosterSize}. Tap a token in your roster to put it back.
          </p>
        </section>

        <section className="card setup-step" aria-labelledby="traps-title">
          <h2 id="traps-title">
            2. Hide <span data-testid="trap-count">{preset.setupTrapsPerPlayer}</span> traps: tap cells
          </h2>
          <p className="help">An enemy fighter that enters your trap loses its charge, or is locked if it has none.</p>
          <Board
            testId="setup-board"
            board={prepared.board}
            human={HUMAN}
            fighters={[]}
            ownTraps={new Set(draft.traps)}
            onCellClick={(cell) => change(toggleTrap(draft, cell, preset))}
          />
          <p data-testid="setup-traps" className="help">
            Your traps: {draft.traps.length === 0 ? 'none yet' : draft.traps.join(', ')}
          </p>
        </section>
      </div>

      {refusals.length > 0 && (
        <div role="alert" data-testid="setup-refusal" className="refusal">
          {refusals.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      )}
      <div className="button-row setup-buttons">
        <button type="button" className="primary" data-testid="start-setup" onClick={start}>
          Start with this setup
        </button>
        <button type="button" data-testid="default-setup" onClick={() => onStart(defaultHumanSetup(prepared.seed, preset))}>
          Use default setup
        </button>
      </div>
      <p className="help">The bot chooses its own fighters and traps in secret.</p>
    </main>
  );
}
