import type { Settings } from './settings';

export interface SettingsPanelProps {
  readonly settings: Settings;
  readonly onChange: (settings: Settings) => void;
  readonly compact?: boolean;
}

function Switch({ label, on, hint, onToggle, testId }: { label: string; on: boolean; hint: string; onToggle: () => void; testId: string }) {
  return (
    <div className="setting">
      <button type="button" role="switch" aria-checked={on} className="switch" data-testid={testId} onClick={onToggle}>
        <span className="switch-label">{label}</span>
        <span className="switch-state" aria-hidden="true">
          {on ? 'On' : 'Off'}
        </span>
      </button>
      <span className="help">{hint}</span>
    </div>
  );
}

/** The two remembered settings (PRD E4, E5): legal-move highlights and sound. */
export function SettingsPanel({ settings, onChange, compact = false }: SettingsPanelProps) {
  return (
    <section aria-label="Settings" data-testid="settings" className={`panel settings${compact ? ' compact' : ''}`}>
      <h2>Settings</h2>
      <Switch
        label="Move highlights"
        testId="setting-highlights"
        on={settings.highlights}
        hint="Mark the cells where the selected fighter can act. Illegal moves are explained either way."
        onToggle={() => onChange({ ...settings, highlights: !settings.highlights })}
      />
      <Switch
        label="Sound"
        testId="setting-sound"
        on={settings.sound}
        hint="Short effects for actions, traps and the result. Everything they signal is also shown."
        onToggle={() => onChange({ ...settings, sound: !settings.sound })}
      />
    </section>
  );
}
