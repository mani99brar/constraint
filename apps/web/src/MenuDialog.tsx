import { useRef } from 'react';
import { Dialog } from './Dialog';
import { UpdateNotice } from './UpdateNotice';
import { paletteAfterKey } from './home';
import { RadioSwitch } from './RadioSwitch';
import { PALETTES, THEMES, type PaletteId } from './theme';

/** The three dots of a theme's button: its ground, its first player and its second. */
const SWATCHES = Object.fromEntries(PALETTES.map(({ id }) => [id, [THEMES[id].dark.ground, THEMES[id].dark.p1, THEMES[id].dark.p2]])) as unknown as Record<PaletteId, readonly string[]>;
import type { Settings } from './settings';
import type { HapticsPlayer } from './haptics';

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
  /** "Menu" during a game, "Settings" on the title screen. */
  readonly title: string;
  readonly settings: Settings;
  readonly onSettings: (settings: Settings) => void;
  readonly onClose: () => void;
  readonly returnFocusTo: HTMLElement | null;
  /** Present during a game: How to Play opens over the menu. */
  readonly onHowTo?: ((opener: HTMLElement) => void) | undefined;
  /** Present during a game: back to the title screen; the saved game is kept. */
  readonly onQuit?: (() => void) | undefined;
  /** Present on the home screen: sets the results by difficulty back to zero. */
  readonly onResetResults?: (() => void) | undefined;
  /** Whether the reset is enabled: once a bot game was counted. */
  readonly canReset?: boolean;
  /** Haptics, to hide their switch on a device that has none. */
  readonly haptics?: HapticsPlayer | undefined;
  /** A newer build is being served: offer a reload. */
  readonly updateReady?: boolean | undefined;
}

/**
 * The menu (PRD U4, E3, E5, U5): resume, How to Play, the colour theme, the highlight, tile-name and sound
 * settings, and quit to title; on the home screen, as Settings, it also holds the reset of the results.
 */
export function MenuDialog({ title, settings, onSettings, onClose, returnFocusTo, onHowTo, onQuit, onResetResults, canReset = false, haptics, updateReady = false }: MenuDialogProps) {
  const first = useRef<HTMLButtonElement>(null);
  return (
    <Dialog titleId="menu-title" className="menu-dialog" testId="menu" onClose={onClose} returnFocusTo={returnFocusTo} initialFocus={first}>
      <header className="dialog-head">
        <h2 id="menu-title">{title}</h2>
      </header>
      <div className="menu-items">
        {updateReady && <UpdateNotice />}
        <button ref={first} type="button" className="primary" data-testid="menu-resume" onClick={onClose}>
          {onQuit ? 'Resume' : 'Close'}
        </button>
        {onHowTo && (
          <button type="button" data-testid="menu-how-to-play" onClick={(event) => onHowTo(event.currentTarget)}>
            How to play
          </button>
        )}
        <section aria-label="Settings" className="menu-settings" data-testid="menu-settings">
          <div className="setting">
            <span className="setting-label" id="theme-label" aria-hidden="true">
              Theme
            </span>
            <RadioSwitch
              label="Theme"
              testId="setting-palette"
              options={PALETTES}
              value={settings.palette}
              afterKey={paletteAfterKey}
              columns={2}
              swatches={SWATCHES}
              onChange={(palette) => onSettings({ ...settings, palette })}
            />
            <span className="help">The look of the table, the tiles and both players. The neon themes are always dark; Walnut, Sea glass and Clear follow your device's light or dark setting.</span>
          </div>
          <Switch
            label="Highlight legal tiles"
            testId="setting-highlights"
            on={settings.highlights}
            hint="The tiles you may take glow on your turn. A refused take is explained either way."
            onToggle={() => onSettings({ ...settings, highlights: !settings.highlights })}
          />
          <Switch
            label="Tile names"
            testId="setting-tile-names"
            on={settings.tileNames}
            hint="Shows every tile's name on it. Otherwise a name shows on hover, on focus or when you hold a tile."
            onToggle={() => onSettings({ ...settings, tileNames: !settings.tileNames })}
          />
          <Switch
            label="Countdown"
            testId="setting-countdown"
            on={settings.countdown}
            hint="A short 3, 2, 1 before a new game starts. A tap or Enter starts at once."
            onToggle={() => onSettings({ ...settings, countdown: !settings.countdown })}
          />
          <Switch
            label="Scene motion"
            testId="setting-scene-motion"
            on={settings.sceneMotion}
            hint="Waves, clouds, swaying pines and the pulsing sun on the tiles. Turn off to keep the scenes still and save battery."
            onToggle={() => onSettings({ ...settings, sceneMotion: !settings.sceneMotion })}
          />
          <Switch
            label="Terrain backdrop"
            testId="setting-backdrop"
            on={settings.backdrop}
            hint="A faint scene of the terrain the next take needs, behind the board. Off keeps the plain background."
            onToggle={() => onSettings({ ...settings, backdrop: !settings.backdrop })}
          />
          {haptics?.supported && (
            <Switch
              label="Haptics"
              testId="setting-haptics"
              on={settings.haptics}
              hint="A short buzz for takes, refused takes, the countdown and the result. Off at first if your device asks for reduced motion."
              onToggle={() => onSettings({ ...settings, haptics: !settings.haptics })}
            />
          )}
          <Switch
            label="Sound"
            testId="setting-sound"
            on={settings.sound}
            hint="Short effects for takes, refusals and the result. Everything they signal is also shown."
            onToggle={() => onSettings({ ...settings, sound: !settings.sound })}
          />
        </section>
        {onResetResults && (
          <div className="setting">
            <button type="button" data-testid="reset-results" disabled={!canReset} onClick={onResetResults}>
              Reset results
            </button>
            <span className="help">Sets your wins, losses and draws against the bot back to zero.</span>
          </div>
        )}
        {onQuit && (
          <button type="button" data-testid="menu-quit" onClick={onQuit}>
            Quit to title
            <span className="menu-note">Your game is saved; Continue picks it up.</span>
          </button>
        )}
      </div>
    </Dialog>
  );
}
