import { useEffect, useRef } from 'react';
import { FIGHTERS } from '@okiya/content';
import type { ObjectiveId } from '@okiya/rules';
import { FighterEmblem, SymbolEmblem, TerrainGlyph } from './art';
import { Dialog } from './Dialog';
import { howToSections, MATCHING_EXAMPLE, type HowToSection } from './howto';
import { constraintText } from './text';

export interface HowToPlayProps {
  readonly objective?: ObjectiveId;
  readonly onClose: () => void;
  /** The element that opened the dialog; focus returns to it on close. */
  readonly returnFocusTo: HTMLElement | null;
  /** The section scrolled into view on open, for example the objective from the goal chip. */
  readonly section?: HowToSection['id'] | undefined;
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
            <span className="example-part">
              <TerrainGlyph terrain={tile.terrain} />
              {tile.terrain}
            </span>
            <span className="example-part">
              <SymbolEmblem symbol={tile.symbol} />
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
export function HowToPlay({ objective = 'Square', onClose, returnFocusTo, section }: HowToPlayProps) {
  const close = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (section) body.current?.querySelector(`[data-section="${section}"]`)?.scrollIntoView({ block: 'start' });
  }, [section]);

  return (
    <Dialog titleId="howto-title" className="howto" testId="how-to-play" onClose={onClose} returnFocusTo={returnFocusTo} initialFocus={close}>
      <header className="dialog-head">
        <h2 id="howto-title">How to play</h2>
        <button ref={close} type="button" className="close" aria-label="Close How to play" onClick={onClose}>
          Close
        </button>
      </header>
      <div ref={body} className="dialog-body" tabIndex={0} data-open-section={section}>
        {howToSections(objective).map((part) => (
          <section key={part.id} data-section={part.id} aria-labelledby={`howto-${part.id}`}>
            <h3 id={`howto-${part.id}`}>{part.title}</h3>
            {part.paragraphs.map((text) => (
              <p key={text}>{text}</p>
            ))}
            {part.id === 'matching' && <MatchingExample />}
            {part.id === 'fighters' && (
              <ul className="howto-fighters">
                {FIGHTERS.map((fighter) => (
                  <li key={fighter.type} data-fighter={fighter.type}>
                    <span className="howto-token" aria-hidden="true">
                      <FighterEmblem type={fighter.type} />
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
    </Dialog>
  );
}
