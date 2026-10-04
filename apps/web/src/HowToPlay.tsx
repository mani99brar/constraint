import { useRef, useState } from 'react';
import { TileArt, TokenMark } from './art';
import { Dialog } from './Dialog';
import { diagramCells, diagramMover, howToPages, MATCHING_EXAMPLE, type Diagram } from './howto';
import { tileName } from './text';

export interface HowToPlayProps {
  readonly onClose: () => void;
  /** The element that opened the dialog; focus returns to it on close. */
  readonly returnFocusTo: HTMLElement | null;
}

/** The matching illustration: the last tile and three tiles, each drawn with its art and saying whether it matches and why. */
function MatchingExample() {
  const { lastTile, tiles } = MATCHING_EXAMPLE;
  return (
    <figure className="howto-example" data-testid="matching-example">
      <figcaption>
        <TileArt terrain={lastTile.terrain} symbol={lastTile.symbol} className="example-art" />
        <span>
          To match: <strong>{tileName(lastTile)}</strong>
        </span>
      </figcaption>
      <ul>
        {tiles.map((tile) => (
          <li key={tileName(tile)} className="example-tile">
            <TileArt terrain={tile.terrain} symbol={tile.symbol} className="example-art" />
            <span className="example-name">{tileName(tile)}</span>
            <strong className="verdict">{tile.matches ? `✓ matches (${tile.why})` : `✗ no match (${tile.why})`}</strong>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** A small 4×4 board of a real game, drawn with the tile art: tokens, glowing tiles, a winning shape, the last take or tiles that do not match. */
function MiniBoard({ diagram }: { diagram: Diagram }) {
  return (
    <figure className="diagram" data-testid={`diagram-${diagram.id}`}>
      <div className="mini-board" role="img" aria-label={diagram.caption} data-glow-player={diagramMover(diagram)}>
        {diagramCells(diagram).map(({ cell, tile, token, mark }) => (
          <span key={cell} className={`mini-cell${mark ? ` ${mark}` : ''}`} data-cell={cell} data-mark={mark ?? undefined} data-token={token ?? undefined}>
            {token ? (
              <span className={`mini-token p${token === 'A' ? 1 : 2}`}>
                <TokenMark player={token} />
              </span>
            ) : (
              <TileArt terrain={tile.terrain} symbol={tile.symbol} />
            )}
          </span>
        ))}
      </div>
      <figcaption>{diagram.caption}</figcaption>
    </figure>
  );
}

/**
 * How to Play (PRD E2): a modal dialog of short pages, with Back and Next, that keeps focus inside
 * while open, closes with Escape or its close button, and returns focus to the button that opened it.
 */
export function HowToPlay({ onClose, returnFocusTo }: HowToPlayProps) {
  const close = useRef<HTMLButtonElement>(null);
  const pages = howToPages();
  const [index, setIndex] = useState(0);
  const page = pages[index]!;
  const lastPage = index === pages.length - 1;
  return (
    <Dialog titleId="howto-title" className="howto" testId="how-to-play" onClose={onClose} returnFocusTo={returnFocusTo} initialFocus={close}>
      <header className="dialog-head">
        <h2 id="howto-title">How to play</h2>
        <button ref={close} type="button" className="close" aria-label="Close How to play" onClick={onClose}>
          Close
        </button>
      </header>
      <section key={page.id} className="dialog-body howto-page" tabIndex={0} data-section={page.id} data-page={index + 1} aria-labelledby={`howto-${page.id}`}>
        <h3 id={`howto-${page.id}`}>{page.title}</h3>
        {page.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
        <div className="diagrams">
          {page.id === 'taking' && <MatchingExample />}
          {page.diagrams.map((diagram) => (
            <MiniBoard key={diagram.id} diagram={diagram} />
          ))}
        </div>
      </section>
      <footer className="dialog-foot howto-foot">
        <button type="button" data-testid="howto-back" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Back
        </button>
        <p className="page-count" data-testid="howto-page" aria-live="polite">
          Page {index + 1} of {pages.length}
        </p>
        {lastPage ? (
          <button type="button" className="primary" data-testid="howto-done" onClick={onClose}>
            Got it
          </button>
        ) : (
          <button type="button" className="primary" data-testid="howto-next" onClick={() => setIndex(index + 1)}>
            Next
          </button>
        )}
      </footer>
    </Dialog>
  );
}
