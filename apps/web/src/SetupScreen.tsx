import { useState } from 'react';
import { FIGHTERS } from '@okiya/content';
import type { PreparedMatch, Setup } from '@okiya/rules';
import { Board } from './Board';
import { HUMAN } from './match';
import { addFighter, defaultHumanSetup, EMPTY_DRAFT, removeFighter, setupRefusals, toggleTrap, type DraftChange, type SetupDraft } from './setup';
import { describeSetupRefusal, fighterName } from './text';

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
    <main className="setup">
      <header className="match-header">
        <h1>Okiya setup</h1>
        <span data-testid="seed">Seed {prepared.seed}</span>
        <span>Preset {preset.id}</span>
        <button type="button" onClick={onLeave}>
          Back
        </button>
      </header>
      <p>
        Your objective: Square. Pick {preset.rosterSize} distinct fighters, then place{' '}
        <span data-testid="trap-count">{preset.setupTrapsPerPlayer}</span> setup traps on distinct cells by clicking the
        board. The bot chooses its own setup in secret.
      </p>
      <div className="layout">
        <Board
          testId="setup-board"
          board={prepared.board}
          human={HUMAN}
          fighters={[]}
          ownTraps={new Set(draft.traps)}
          onCellClick={(cell) => change(toggleTrap(draft, cell, preset))}
        />
        <aside className="side">
          <section aria-label="Fighter pool" data-testid="pool">
            <h2>Fighter pool</h2>
            {FIGHTERS.map((fighter) => (
              <button
                type="button"
                key={fighter.type}
                data-fighter={fighter.type}
                aria-pressed={draft.roster.includes(fighter.type)}
                className={draft.roster.includes(fighter.type) ? 'selected' : ''}
                title={fighter.summary}
                onClick={() => change(addFighter(draft, fighter.type, preset))}
              >
                {fighter.name}
              </button>
            ))}
          </section>
          <section aria-label="Your roster" data-testid="roster">
            <h2>
              Your roster ({draft.roster.length}/{preset.rosterSize})
            </h2>
            {draft.roster.map((type) => (
              <button type="button" key={type} data-fighter={type} onClick={() => setDraft(removeFighter(draft, type))}>
                Remove {fighterName(type)}
              </button>
            ))}
          </section>
          <p data-testid="setup-traps">
            Your traps: {draft.traps.length === 0 ? 'none yet' : draft.traps.join(', ')}
          </p>
          {refusals.length > 0 && (
            <div role="alert" data-testid="setup-refusal" className="refusal">
              {refusals.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </div>
          )}
          <button type="button" onClick={start}>
            Start with this setup
          </button>
          <button type="button" onClick={() => onStart(defaultHumanSetup(prepared.seed, preset))}>
            Use default setup
          </button>
        </aside>
      </div>
    </main>
  );
}
