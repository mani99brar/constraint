import { MenuIcon } from './art';

/** The slim top bar (PRD U2): the menu button, and nothing else. */
export function TopBar({ onMenu }: { onMenu: (opener: HTMLElement) => void }) {
  return (
    <header className="top-bar" data-testid="top-bar">
      <button type="button" className="menu-button" data-testid="menu-button" aria-haspopup="dialog" onClick={(event) => onMenu(event.currentTarget)}>
        <MenuIcon />
        <span className="menu-text">Menu</span>
      </button>
    </header>
  );
}
