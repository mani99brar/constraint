import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cellColumn, cellRow, COLUMNS, ROWS, type CellId } from '@okiya/game';
import { SymbolEmblem, TerrainScene } from './art';
import type { BoardModel, WinningShape } from './boardModel';
import { liftOrder } from './end';
import { boardKey, tabStop } from './keyboard';
import { createLongPress } from './longPress';
import { Token } from './Token';

export interface BoardProps {
  readonly model: BoardModel;
  readonly onCellClick: (cell: CellId) => void;
}

/** The gap between tiles and the board's padding, as a share of a tile (PRD U1); styles.css uses the same. */
export const GAP_RATIO = 0.12;

/** A cell's centre in the board's 0–100 drawing space, before the real cells are measured. */
function laidOutCentre(cell: CellId): readonly [number, number] {
  // The board is padding, four tiles and three gaps, the padding equal to a gap: 4 + 5 × GAP_RATIO tiles wide.
  const at = (index: number) => ((GAP_RATIO + 0.5 + index * (1 + GAP_RATIO)) / (4 + 5 * GAP_RATIO)) * 100;
  return [at(cellColumn(cell)), at(cellRow(cell))];
}

/**
 * The stroke through the winning shape's four tokens (PRD R4, U10): a line from end to end, or a loop
 * round a square, through the centres of the real cells. It is drawn as part of the end sequence.
 */
function WinStroke({ shape, centres }: { shape: WinningShape; centres: ReadonlyMap<CellId, readonly [number, number]> | null }) {
  const ordered = liftOrder(shape.by, shape.cells).map((cell) => centres?.get(cell) ?? laidOutCentre(cell));
  const points = shape.by === 'square' ? ordered : [ordered[0]!, ordered[ordered.length - 1]!];
  const d = `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}${shape.by === 'square' ? 'Z' : ''}`;
  return (
    <svg
      className="win-stroke"
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      data-testid="win-stroke"
      data-end="stroke"
      data-by={shape.by}
      data-cells={shape.cells.join(' ')}
    >
      <path d={d} className="win-stroke-under" pathLength={1} />
      <path d={d} className="win-stroke-line" pathLength={1} />
    </svg>
  );
}

/**
 * The board as a wooden frame of separate raised tiles (PRD U1): every cell a button named by its cell,
 * tile or token (PRD U7), one Tab stop with arrow keys moving between cells, and Enter or Space to take
 * the focused tile. With highlights on, the legal tiles lift and carry a wash of the mover's colour while
 * the other free tiles fade back (PRD R2). A tile's name shows on hover, focus or a long press, or on every
 * tile with the Tile names setting (PRD I1, E3). At the end the cells play the end sequence (PRD U10),
 * which any tap or key skips. During the bot's turn taps are ignored; focus still moves.
 */
export function Board({ model, onCellClick }: BoardProps) {
  const [focused, setFocused] = useState<CellId | null>(null);
  const [peek, setPeek] = useState<CellId | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [centres, setCentres] = useState<ReadonlyMap<CellId, readonly [number, number]> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<CellId, HTMLButtonElement>());
  const press = useMemo(() => createLongPress<CellId>(setPeek), []);
  const stop = tabStop(focused, model.glowing);
  const disabled = !model.acceptsTakes;
  const ended = model.end !== null;
  const shape = model.winningShape;

  useEffect(() => press.cancel, [press]);

  useEffect(() => {
    // Any tap or key during the end sequence skips it to its final frame; the tap itself still lands.
    if (!ended) return;
    const skip = () => setSkipped(true);
    const gestures = ['pointerdown', 'keydown'] as const;
    for (const gesture of gestures) window.addEventListener(gesture, skip, true);
    return () => {
      for (const gesture of gestures) window.removeEventListener(gesture, skip, true);
    };
  }, [ended]);

  useLayoutEffect(() => {
    // The stroke runs through the centres of the real cells, measured once the shape is on the board.
    const element = boardRef.current;
    if (!shape || !element) return;
    const measure = () => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const found = new Map<CellId, readonly [number, number]>();
      for (const cell of shape.cells) {
        const slot = cellRefs.current.get(cell)?.parentElement?.getBoundingClientRect();
        if (slot) found.set(cell, [((slot.left + slot.width / 2 - box.left) / box.width) * 100, ((slot.top + slot.height / 2 - box.top) / box.height) * 100]);
      }
      setCentres(found);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [shape]);

  function onKeyDown(cell: CellId, event: KeyboardEvent<HTMLButtonElement>) {
    const intent = boardKey(cell, event.key);
    if (!intent) return;
    event.preventDefault();
    if (intent.kind === 'focus') {
      setFocused(intent.cell);
      cellRefs.current.get(intent.cell)?.focus();
    } else if (!disabled) {
      onCellClick(intent.cell);
    }
  }

  return (
    <div className="board-frame" data-testid="board-frame" data-active={model.active ?? undefined}>
      <div className="frame-labels frame-columns" aria-hidden="true">
        {COLUMNS.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="frame-labels frame-rows" aria-hidden="true">
        {ROWS.map((row) => (
          <span key={row}>{row}</span>
        ))}
      </div>
      <div
        ref={boardRef}
        role="grid"
        aria-label="Board"
        aria-disabled={disabled || undefined}
        className="board"
        data-testid="board"
        data-glow-player={model.wash ?? undefined}
        data-names={model.names}
        data-end-kind={model.end?.kind}
        data-end-skipped={ended ? skipped : undefined}
      >
        {ROWS.map((row) => (
          <div role="row" key={row} className="board-row">
            {model.cells
              .filter((view) => view.cell.startsWith(row))
              .map((view) => {
                const { cell, tile, token } = view;
                const classes = ['cell', token === null ? `terrain-${tile.terrain.toLowerCase()}` : 'taken'];
                if (view.glow) classes.push('glow');
                if (view.last) classes.push('last');
                if (view.winning) classes.push('winning');
                return (
                  <div role="gridcell" key={cell} className="cell-slot">
                    <button
                      type="button"
                      ref={(element) => {
                        if (element) cellRefs.current.set(cell, element);
                        else cellRefs.current.delete(cell);
                      }}
                      tabIndex={cell === stop ? 0 : -1}
                      className={classes.join(' ')}
                      data-cell={cell}
                      data-row={cellRow(cell)}
                      data-column={cellColumn(cell)}
                      data-terrain={tile.terrain}
                      data-symbol={tile.symbol}
                      data-edge={view.edge}
                      data-glow={view.glow}
                      data-faded={view.faded}
                      data-taken={token !== null}
                      data-owner={token ?? undefined}
                      data-last={view.last}
                      data-winning={view.winning}
                      data-end={view.end ?? undefined}
                      data-lift-order={view.liftOrder ?? undefined}
                      data-peek={peek === cell || undefined}
                      aria-disabled={disabled || undefined}
                      aria-label={view.label}
                      onFocus={() => setFocused(cell)}
                      onPointerDown={() => {
                        setPeek(null);
                        press.start(cell);
                      }}
                      onPointerUp={press.cancel}
                      onPointerLeave={press.cancel}
                      onPointerCancel={press.cancel}
                      onContextMenu={(event) => event.preventDefault()}
                      onClick={() => {
                        if (!press.takeClick()) return;
                        if (!disabled) onCellClick(cell);
                      }}
                      onKeyDown={(event) => onKeyDown(cell, event)}
                    >
                      <span className="tile-face">
                        {token === null ? (
                          <>
                            <TerrainScene terrain={tile.terrain} />
                            <span className="tile-symbol">
                              <SymbolEmblem symbol={tile.symbol} />
                            </span>
                          </>
                        ) : (
                          <Token key={cell} player={token} />
                        )}
                      </span>
                      {token === null && (
                        <span className="tile-name" aria-hidden="true" data-testid="tile-name">
                          <span>{tile.terrain}–</span>
                          <span>{tile.symbol}</span>
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        ))}
        {shape && <WinStroke shape={shape} centres={centres} />}
      </div>
    </div>
  );
}
