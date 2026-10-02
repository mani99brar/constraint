import { useEffect, useRef, type KeyboardEvent } from 'react';
import { FIGHTERS } from '@okiya/content';
import type { ObjectiveId } from '@okiya/rules';
import { FOCUSABLE_SELECTOR, restoreFocus, wrapFocus } from './focus';
import { howToSections, MATCHING_EXAMPLE } from './howto';
import { SymbolIcon, TerrainIcon } from './icons';
import { constraintText } from './text';

export interface HowToPlayProps {
  readonly objective?: ObjectiveId;
  readonly onClose: () => void;
  /** The element that opened the dialog; focus returns to it on close. */
  readonly returnFocusTo: HTMLElement | null;
}

/** The matching illustration: one constraint and three tiles, each saying whether it matches and why. */
function MatchingExample() {
  const { constraint, tiles } = MATCHING_EXAMPLE;
  return (
    <figure className="howto-example" data-testid="matching-example">
      <figcaption>
        Constraint: <strong>{constraintText(constraint)}</strong>
      </figcaption>
      <ul>
        {tiles.map((tile) => (
          <li key={`${tile.terrain}-${tile.symbol}`} className={`example-tile terrain-${tile.terrain.toLowerCase()}`}>
            <span className="terrain">
              <TerrainIcon terrain={tile.terrain} />
              {tile.terrain}
            </span>
            <span className="symbol">
              <SymbolIcon symbol={tile.symbol} />
              {tile.symbol}
            </span>
            <strong className="verdict">{tile.matches ? `✓ matches (${tile.why})` : `✗ no match (${tile.why})`}</strong>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * How to Play (PRD E3): a modal dialog that keeps focus inside while open, closes with Escape or
 * its close button, and returns focus to the button that opened it.
 */
export function HowToPlay({ objective = 'Square', onClose, returnFocusTo }: HowToPlayProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    close.current?.focus();
    return () => {
      restoreFocus(returnFocusTo);
    };
  }, [returnFocusTo]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const focusables = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    const next = wrapFocus(focusables, document.activeElement as HTMLElement | null, event.shiftKey);
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        className="dialog howto"
        data-testid="how-to-play"
      >
        <header className="dialog-head">
          <h2 id="howto-title">How to play</h2>
          <button ref={close} type="button" className="close" aria-label="Close How to play" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="dialog-body" tabIndex={0}>
          {howToSections(objective).map((section) => (
            <section key={section.id} data-section={section.id} aria-labelledby={`howto-${section.id}`}>
              <h3 id={`howto-${section.id}`}>{section.title}</h3>
              {section.paragraphs.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {section.id === 'matching' && <MatchingExample />}
              {section.id === 'fighters' && (
                <ul className="howto-fighters">
                  {FIGHTERS.map((fighter) => (
                    <li key={fighter.type} data-fighter={fighter.type}>
                      <span className="token-badge howto-badge" aria-hidden="true">
                        {fighter.abbreviation}
                      </span>
                      <span>
                        <strong>{fighter.name}</strong>
                        {fighter.displacer && <span className="tag">Displacer</span>} {fighter.summary}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <footer className="dialog-foot">
          <button type="button" className="primary" onClick={onClose}>
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}
