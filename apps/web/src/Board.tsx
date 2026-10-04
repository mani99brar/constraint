import { useRef, useState, type KeyboardEvent } from 'react';
import { cellColumn, cellRow, COLUMNS, ROWS, type CellId } from '@okiya/game';
import { SymbolEmblem, TerrainScene } from './art';
import type { BoardModel, WinningShape } from './boardModel';
import { boardKey, tabStop } from './keyboard';
import { Token } from './Token';

export interface BoardProps {
  readonly model: BoardModel;
  readonly onCellClick: (cell: CellId) => void;
}

/** The centre of a cell in the board's 0–100 drawing space. */
function centre(cell: CellId): readonly [number, number] {
  return [cellColumn(cell) * 25 + 12.5, cellRow(cell) * 25 + 12.5];
}

/**
 * The stroke across the winning shape's four cells (PRD R4): a line from end to end, or a loop round
 * a square. It draws itself in under 400 ms, off under reduced motion (PRD U8).
 */
function WinStroke({ shape }: { shape: WinningShape }) {
  let points = [...shape.cells].sort((a, b) => cellRow(a) - cellRow(b) || cellColumn(a) - cellColumn(b)).map(centre);
  if (shape.by === 'square') points = [points[0]!, points[1]!, points[3]!, points[2]!];
  else points = [points[0]!, points[points.length - 1]!];
  const d = `M${points.map(([x, y]) => `${x} ${y}`).join('L')}${shape.by === 'square' ? 'Z' : ''}`;
  return (
    <svg className="win-stroke" viewBox="0 0 100 100" aria-hidden="true" focusable="false" data-testid="win-stroke" data-by={shape.by} data-cells={shape.cells.join(' ')}>
      <path d={d} className="win-stroke-under" pathLength={1} />
      <path d={d} className="win-stroke-line" pathLength={1} />
    </svg>
  );
}

/**
 * The board as a framed tray of illustrated tiles (PRD U1): every cell a button named by its cell,
 * tile or token (PRD U7), one Tab stop with arrow keys moving between cells, and Enter or Space to
 * take the focused tile. The frame takes the colour of the player to move on that player's side, and the
 * legal tiles glow in it. During the bot's turn taps are ignored; focus still moves.
 */
export function Board({ model, onCellClick }: BoardProps) {
  const [focused, setFocused] = useState<CellId | null>(null);
  const cellRefs = useRef(new Map<CellId, HTMLButtonElement>());
  const stop = tabStop(focused, model.glowing);
  const disabled = !model.acceptsTakes;

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
      <div role="grid" aria-label="Board" aria-disabled={disabled || undefined} className="board" data-testid="board" data-glow-player={model.glowing.length > 0 ? model.active! : undefined}>
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
                      data-taken={token !== null}
                      data-owner={token ?? undefined}
                      data-last={view.last}
                      data-winning={view.winning}
                      aria-disabled={disabled || undefined}
                      aria-label={view.label}
                      onFocus={() => setFocused(cell)}
                      onClick={() => {
                        if (!disabled) onCellClick(cell);
                      }}
                      onKeyDown={(event) => onKeyDown(cell, event)}
                    >
                      {token === null ? (
                        <>
                          <TerrainScene terrain={tile.terrain} />
                          <span className="tile-symbol">
                            <SymbolEmblem symbol={tile.symbol} />
                          </span>
                          <span className="tile-label" aria-hidden="true">
                            <span className="tile-terrain">{tile.terrain}</span>
                            <span className="tile-symbol-name">{tile.symbol}</span>
                          </span>
                        </>
                      ) : (
                        <Token key={cell} player={token} />
                      )}
                      {view.last && <span className="last-mark" aria-hidden="true" />}
                      {view.winning && <span className="winning-mark" aria-hidden="true" />}
                    </button>
                  </div>
                );
              })}
          </div>
        ))}
        {model.winningShape && <WinStroke shape={model.winningShape} />}
      </div>
    </div>
  );
}
