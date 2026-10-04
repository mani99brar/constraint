import { MenuIcon } from './art';
import { MatchCard } from './MatchCard';
import type { MatchCardModel } from './matchCard';

/**
 * The slim top bar (PRD U2): the menu button, and on a phone the Match card beside it. On wide screens
 * the bar lets its children into the match grid, so the card sits next to the board.
 */
export function TopBar({ card, onMenu }: { card: MatchCardModel; onMenu: (opener: HTMLElement) => void }) {
  return (
    <header className="top-bar" data-testid="top-bar">
      <MatchCard model={card} />
      <button type="button" className="menu-button" data-testid="menu-button" aria-haspopup="dialog" onClick={(event) => onMenu(event.currentTarget)}>
        <MenuIcon />
        <span className="menu-text">Menu</span>
      </button>
    </header>
  );
}
