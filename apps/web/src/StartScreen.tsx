import { useState, type FormEvent } from 'react';
import { PRESETS, SCENARIOS } from '@okiya/content';
import type { PreparedMatch } from '@okiya/rules';
import { BOT_DEPTHS, differenceLines, scenarioDescription, startFromChoice, type BotDepthId, type StartChoice } from './start';

export interface StartScreenProps {
  readonly initial: StartChoice;
  readonly onStart: (prepared: PreparedMatch, depth: BotDepthId) => void;
}

/** Match start (PRD S1, S4, P2): preset, scenario, optional seed and bot depth. */
export function StartScreen({ initial, onStart }: StartScreenProps) {
  const [choice, setChoice] = useState<StartChoice>(initial);
  const [error, setError] = useState<string | null>(null);
  const update = (change: Partial<StartChoice>) => setChoice((current) => ({ ...current, ...change }));

  function start(event: FormEvent) {
    event.preventDefault();
    const result = startFromChoice(choice);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onStart(result.prepared, result.depth);
  }

  return (
    <main className="landing">
      <h1>New match</h1>
      <p className="subtitle">One human against a bot on a 4×4 board of terrain/symbol tiles.</p>
      <form onSubmit={start} className="start-form">
        <fieldset className="choices" data-testid="preset-choices">
          <legend>Rules preset</legend>
          {PRESETS.map((preset) => (
            <label key={preset.id} className="choice" data-preset={preset.id}>
              <input
                type="radio"
                name="preset"
                value={preset.id}
                checked={choice.presetId === preset.id}
                onChange={() => update({ presetId: preset.id })}
              />
              <span className="choice-text">
                <strong>{preset.name}</strong> <code>{preset.id}</code>
                <span className="differences" data-testid={`differences-${preset.id}`}>
                  {differenceLines(preset).join(' ')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="field">
          Scenario
          <select
            name="scenario"
            data-testid="scenario-select"
            value={choice.scenarioId}
            onChange={(event) => update({ scenarioId: event.target.value })}
          >
            <option value="">None: shuffled board, your own setup</option>
            {SCENARIOS.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name} ({scenarioDescription(scenario)})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Seed (optional)
          <input
            name="seed"
            inputMode="numeric"
            value={choice.seedText}
            onChange={(event) => update({ seedText: event.target.value })}
            placeholder="random"
          />
        </label>

        <fieldset className="choices depth" data-testid="depth-choices">
          <legend>Bot strength</legend>
          {BOT_DEPTHS.map((depth) => (
            <label key={depth.id} className="choice" data-depth={depth.id}>
              <input type="radio" name="depth" value={depth.id} checked={choice.depth === depth.id} onChange={() => update({ depth: depth.id })} />
              <span className="choice-text">
                <strong>{depth.label}</strong> <span className="differences">depth {depth.maxDepth}: {depth.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <button type="submit" className="primary">
          Start match
        </button>
      </form>
      {error && (
        <p role="alert" className="refusal">
          {error}
        </p>
      )}
    </main>
  );
}
