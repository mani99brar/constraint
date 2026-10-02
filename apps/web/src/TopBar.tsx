import type { PlayerView } from '@okiya/rules';
import { MenuIcon, SymbolEmblem, TerrainGlyph } from './art';
import type { TopBarModel } from './topbar';

export interface TopBarProps {
  readonly model: TopBarModel;
  readonly view: Pick<PlayerView, 'activePlayer' | 'turn' | 'constraint' | 'recharges'>;
  readonly onGoal: (opener: HTMLElement) => void;
  readonly onMenu: (opener: HTMLElement) => void;
}

/** The slim top bar (PRD T4, U5): whose turn, the constraint as two emblems, recharge pips, the goal chip and the menu. */
export function TopBar({ model, view, onGoal, onMenu }: TopBarProps) {
  const { constraint } = model;
  return (
    <header className="top-bar" data-testid="top-bar">
      <p
        className={`turn${model.humanTurn ? ' yours' : ''}${model.botThinking ? ' thinking' : ''}`}
        data-testid="turn"
        data-active={view.activePlayer}
        data-turn={view.turn}
        aria-live="polite"
      >
        {model.botThinking && <span className="spinner" aria-hidden="true" />}
        {model.turnText}
      </p>
      <div
        className="constraint"
        role="group"
        aria-label={model.constraintLabel}
        data-testid="constraint"
        data-terrain={view.constraint?.terrain}
        data-symbol={view.constraint?.symbol}
        data-opening={constraint === null || undefined}
      >
        {constraint ? (
          constraint.map((emblem) => (
            <span key={emblem.kind} className={`constraint-emblem ${emblem.kind}`} data-testid={`constraint-${emblem.kind}`}>
              {emblem.kind === 'terrain' ? <TerrainGlyph terrain={emblem.terrain} /> : <SymbolEmblem symbol={emblem.symbol} />}
              <span className="emblem-name">{emblem.name}</span>
            </span>
          ))
        ) : (
          <span className="constraint-opening">{model.constraintLabel}</span>
        )}
      </div>
      <div className="recharges" data-testid="recharges" data-a={view.recharges.A} data-b={view.recharges.B}>
        {model.recharges.map((side) => (
          <span key={side.player} className="pip-row" role="img" aria-label={side.label} data-side={side.side} data-left={side.left}>
            <span className="pip-side" aria-hidden="true">
              {side.side}
            </span>
            {side.pips.map((on, index) => (
              <span key={index} className={`pip${on ? ' on' : ''}`} aria-hidden="true" />
            ))}
          </span>
        ))}
      </div>
      <div className="top-bar-buttons">
        <button type="button" className="goal-chip" data-testid="goal-chip" onClick={(event) => onGoal(event.currentTarget)}>
          {model.goal.label}
        </button>
        <button type="button" className="menu-button" data-testid="menu-button" aria-haspopup="dialog" onClick={(event) => onMenu(event.currentTarget)}>
          <MenuIcon />
          <span className="menu-text">Menu</span>
        </button>
      </div>
    </header>
  );
}
