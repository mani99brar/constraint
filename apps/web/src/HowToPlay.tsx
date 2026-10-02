import { useRef } from 'react';
import { ALL_CELLS } from '@okiya/game';
import { SymbolEmblem, TerrainGlyph, TokenMark } from './art';
import { Dialog } from './Dialog';
import { howToSections, MATCHING_EXAMPLE, type Diagram } from './howto';
import { tileName } from './text';

export interface HowToPlayProps {
  readonly onClose: () => void;
  /** The element that opened the dialog; focus returns to it on close. */
  readonly returnFocusTo: HTMLElement | null;
}

/** The matching illustration: one last tile and three tiles, each saying whether it matches and why. */
function MatchingExample() {
  const { lastTile, tiles } = MATCHING_EXAMPLE;
  return (
    <figure className="howto-example" data-testid="matching-example">
      <figcaption>
        Last tile: <strong>{tileName(lastTile)}</strong>
      </figcaption>
      <ul>
        {tiles.map((tile) => (
          <li key={tileName(tile)} className={`example-tile terrain-${tile.terrain.toLowerCase()}`}>
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

/** A small 4×4 board: tokens, glowing edge tiles, a winning shape, the last take or tiles that do not match. */
function MiniBoard({ diagram }: { diagram: Diagram }) {
  return (
    <figure className="diagram" data-testid={`diagram-${diagram.id}`}>
      <div className="mini-board" role="img" aria-label={diagram.caption}>
        {ALL_CELLS.map((cell) => {
          const view = diagram.cells[cell];
          return (
            <span key={cell} className={`mini-cell${view?.mark ? ` ${view.mark}` : ''}`} data-cell={cell} data-mark={view?.mark} data-token={view?.token}>
              {view?.token && (
                <span className={`mini-token ${view.token === 'you' ? 'own' : 'bot'}`}>
                  <TokenMark owner={view.token} />
                </span>
              )}
              {view?.mark === 'dead' && <span className="mini-cross">×</span>}
            </span>
          );
        })}
      </div>
      <figcaption>{diagram.caption}</figcaption>
    </figure>
  );
}

/**
 * How to Play (PRD E2): a modal dialog that keeps focus inside while open, closes with Escape or
 * its close button, and returns focus to the button that opened it.
 */
export function HowToPlay({ onClose, returnFocusTo }: HowToPlayProps) {
  const close = useRef<HTMLButtonElement>(null);
  return (
    <Dialog titleId="howto-title" className="howto" testId="how-to-play" onClose={onClose} returnFocusTo={returnFocusTo} initialFocus={close}>
      <header className="dialog-head">
        <h2 id="howto-title">How to play</h2>
        <button ref={close} type="button" className="close" aria-label="Close How to play" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="dialog-body" tabIndex={0}>
        {howToSections().map((part) => (
          <section key={part.id} data-section={part.id} aria-labelledby={`howto-${part.id}`}>
            <h3 id={`howto-${part.id}`}>{part.title}</h3>
            {part.paragraphs.map((text) => (
              <p key={text}>{text}</p>
            ))}
            {part.id === 'taking' && <MatchingExample />}
            {part.diagrams.length > 0 && (
              <div className="diagrams">
                {part.diagrams.map((diagram) => (
                  <MiniBoard key={diagram.id} diagram={diagram} />
                ))}
              </div>
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
