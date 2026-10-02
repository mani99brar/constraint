import type { Preset } from '@okiya/rules';
import { presetRows } from './text';

/** Rules reference (PRD I3): spec §6–§9 in brief, and the active preset's values. */
export function RulesPanel({ preset }: { preset: Preset }) {
  return (
    <section aria-label="Rules" data-testid="rules" data-preset={preset.id}>
      <h2>Rules</h2>
      <ul>
        <li>Matching (§6): the chosen tile must share the constraint's terrain or its symbol.</li>
        <li>
          Actions (§7): deploy a reserve fighter on an empty matching cell; move one step to an empty matching cell;
          recharge a spent fighter on a matching tile; or spend a charge on its ability.
        </li>
        <li>
          Traps (§8): an enemy entering a trapped cell loses its charge, or is locked if it has none. Your own traps
          never affect you.
        </li>
        <li>Fighters (§9): see each fighter's summary in the setup pool. You win with all four in one 2×2 square.</li>
      </ul>
      <dl className="preset-values">
        {presetRows(preset).map((row) => (
          <div key={row.label} data-rule={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
