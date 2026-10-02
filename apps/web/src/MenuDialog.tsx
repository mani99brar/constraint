import { useRef } from 'react';
import { Dialog } from './Dialog';
import type { Settings } from './settings';

function Switch({ label, on, hint, onToggle, testId }: { label: string; on: boolean; hint: string; onToggle: () => void; testId: string }) {
  return (
    <div className="setting">
      <button type="button" role="switch" aria-checked={on} className="switch" data-testid={testId} onClick={onToggle}>
        <span className="switch-label">{label}</span>
        <span className="switch-track" aria-hidden="true">
          <span className="switch-state">{on ? 'On' : 'Off'}</span>
        </span>
      </button>
      <span className="help">{hint}</span>
    </div>
  );
}

export interface MenuDialogProps {
  /** "Menu" during a match, "Settings" on the title screen. */
  readonly title: string;
  readonly settings: Settings;
  readonly onSettings: (settings: Settings) => void;
  readonly onClose: () => void;
  readonly returnFocusTo: HTMLElement | null;
  /** Present during a match: How to Play opens over the menu. */
  readonly onHowTo?: ((opener: HTMLElement) => void) | undefined;
  /** Present during a match: back to the title screen; the saved match is kept. */
  readonly onQuit?: (() => void) | undefined;
}

/** The menu (PRD T4): resume, How to Play, the highlight and sound settings, and quit to title. */
export function MenuDialog({ title, settings, onSettings, onClose, returnFocusTo, onHowTo, onQuit }: MenuDialogProps) {
  const first = useRef<HTMLButtonElement>(null);
  return (
    <Dialog titleId="menu-title" className="menu-dialog" testId="menu" onClose={onClose} returnFocusTo={returnFocusTo} initialFocus={first}>
      <header className="dialog-head">
        <h2 id="menu-title">{title}</h2>
      </header>
      <div className="menu-items">
        <button ref={first} type="button" className="primary" data-testid="menu-resume" onClick={onClose}>
          {onQuit ? 'Resume' : 'Close'}
        </button>
        {onHowTo && (
          <button type="button" data-testid="menu-how-to-play" onClick={(event) => onHowTo(event.currentTarget)}>
            How to play
          </button>
        )}
        <section aria-label="Settings" className="menu-settings" data-testid="menu-settings">
          <Switch
            label="Move highlights"
            testId="setting-highlights"
            on={settings.highlights}
            hint="Cells and tokens glow where you can act. Illegal moves are explained either way."
            onToggle={() => onSettings({ ...settings, highlights: !settings.highlights })}
          />
          <Switch
            label="Sound"
            testId="setting-sound"
            on={settings.sound}
            hint="Short effects for actions, traps and the result. Everything they signal is also shown."
            onToggle={() => onSettings({ ...settings, sound: !settings.sound })}
          />
        </section>
        {onQuit && (
          <button type="button" data-testid="menu-quit" onClick={onQuit}>
            Quit to title
            <span className="menu-note">Your match is saved; Continue picks it up.</span>
          </button>
        )}
      </div>
    </Dialog>
  );
}
