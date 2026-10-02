import type { Preset } from '@okiya/rules';
import { BASE_PRESET, differenceLines } from './start';

/** The active preset and how it differs from `spec-v0.2` (PRD P2). */
export function PresetBadge({ preset }: { preset: Preset }) {
  return (
    <span className="preset-badge" data-testid="preset" data-preset={preset.id}>
      Preset {preset.id}
      {preset.id !== BASE_PRESET.id && <span className="differences"> · {differenceLines(preset).join(' ')}</span>}
    </span>
  );
}
