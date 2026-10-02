import { useState } from 'react';
import { FIGHTERS } from '@okiya/content';
import type { PreparedMatch, Setup } from '@okiya/rules';
import { Board } from './Board';
import { objectiveSummary } from './guide';
import { HUMAN } from './match';
import { addFighter, defaultHumanSetup, EMPTY_DRAFT, removeFighter, setupRefusals, toggleTrap, type DraftChange, type SetupDraft } from './setup';
import { describeSetupRefusal, fighterName } from './text';
import { PresetBadge } from './PresetBadge';

export interface SetupScreenProps {
  readonly prepared: PreparedMatch;
  readonly onStart: (setup: Setup) => void;
  readonly onLeave: () => void;
}

/** Setup (spec §5, PRD S2): the revealed board, the secret roster and the setup traps. */
export function SetupScreen({ prepared, onStart, onLeave }: SetupScreenProps) {
  const { preset } = prepared;
  const [draft, setDraft] = useState<SetupDraft>(EMPTY_DRAFT);
  const [refusals, setRefusals] = useState<string[]>([]);
  const objective = preset.objectivePool[0] ?? 'Square';

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

  const limit = preset.variants.displacerLimit;

  return (
    <main className="setup">
      <header className="match-header">
        <h1>Setup</h1>
        <span data-testid="seed">Seed {prepared.seed}</span>
        <PresetBadge preset={preset} />
        <button type="button" onClick={onLeave}>
          Back
        </button>
      </header>
      <p className="objective" data-testid="objective">
        <strong>Your objective: {objective}.</strong> {objectiveSummary(objective)}
      </p>
      <ol className="setup-steps">
        <li>
          Pick {preset.rosterSize} distinct fighters from the pool
          {limit !== null ? `, at most ${limit} of them displacers` : ''}.
        </li>
        <li>
          Place <span data-testid="trap-count">{preset.setupTrapsPerPlayer}</span> setup traps on distinct cells by choosing
          them on the board. Enemy fighters entering them lose their charge.
        </li>
        <li>The bot chooses its own setup in secret.</li>
      </ol>
      <div className="layout">
        <div className="play">
          <Board
            testId="setup-board"
            board={prepared.board}
            human={HUMAN}
            fighters={[]}
            ownTraps={new Set(draft.traps)}
            onCellClick={(cell) => change(toggleTrap(draft, cell, preset))}
          />
          <p data-testid="setup-traps">Your traps: {draft.traps.length === 0 ? 'none yet' : draft.traps.join(', ')}</p>
        </div>
        <aside className="side">
          <section aria-label="Fighter pool" data-testid="pool" className="panel">
            <h2>Fighter pool</h2>
            <ul className="fighter-list">
              {FIGHTERS.map((fighter) => (
                <li key={fighter.type} className={draft.roster.includes(fighter.type) ? 'chosen' : ''}>
                  <button
                    type="button"
                    data-fighter={fighter.type}
                    data-displacer={fighter.displacer}
                    aria-pressed={draft.roster.includes(fighter.type)}
                    aria-describedby={`help-${fighter.type}`}
                    className={draft.roster.includes(fighter.type) ? 'selected' : ''}
                    onClick={() => change(addFighter(draft, fighter.type, preset))}
                  >
                    {fighter.name}
                  </button>
                  <span id={`help-${fighter.type}`} className="help" data-help={fighter.type}>
                    {fighter.displacer && <span className="tag">Displacer</span>} {fighter.summary}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Your roster" data-testid="roster" className="panel">
            <h2>
              Your roster ({draft.roster.length}/{preset.rosterSize})
            </h2>
            {draft.roster.length === 0 && <p className="muted">Choose fighters from the pool.</p>}
            {draft.roster.map((type) => (
              <button type="button" key={type} data-fighter={type} onClick={() => setDraft(removeFighter(draft, type))}>
                Remove {fighterName(type)}
              </button>
            ))}
          </section>
          {refusals.length > 0 && (
            <div role="alert" data-testid="setup-refusal" className="refusal">
              {refusals.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </div>
          )}
          <div className="button-row">
            <button type="button" className="primary" onClick={start}>
              Start with this setup
            </button>
            <button type="button" onClick={() => onStart(defaultHumanSetup(prepared.seed, preset))}>
              Use default setup
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
