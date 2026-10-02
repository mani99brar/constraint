import { useRef, useState, type KeyboardEvent } from 'react';
import { cellColumn, cellRow, COLUMNS, ROWS, type CellId } from '@okiya/game';
import { SymbolEmblem, TerrainScene } from './art';
import type { BoardModel } from './boardModel';
import { boardKey, tabStop } from './keyboard';
import { Token } from './Token';

export interface BoardProps {
  readonly model: BoardModel;
  readonly onCellClick: (cell: CellId) => void;
}

/**
 * The board as a framed tray of illustrated tiles (PRD U1): every cell a button named by its cell,
 * tile or token (PRD U7), one Tab stop with arrow keys moving between cells, and Enter or Space to
 * take the focused tile. During the bot's turn taps are ignored; focus still moves.
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
    <div className="board-frame" data-testid="board-frame">
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
      <div role="grid" aria-label="Board" aria-disabled={disabled || undefined} className="board" data-testid="board">
        {ROWS.map((row) => (
          <div role="row" key={row} className="board-row">
            {model.cells
              .filter((view) => view.cell.startsWith(row))
              .map((view) => {
                const { cell, tile, owner } = view;
                const classes = ['cell', owner === null ? `terrain-${tile.terrain.toLowerCase()}` : 'taken'];
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
                      data-taken={owner !== null}
                      data-owner={owner ?? undefined}
                      data-player={view.token ?? undefined}
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
                      {owner === null ? (
                        <>
                          <TerrainScene terrain={tile.terrain} />
                          <span className="tile-symbol">
                            <SymbolEmblem symbol={tile.symbol} />
                          </span>
                          <span className="tile-label" aria-hidden="true">
                            <span className="tile-terrain">{tile.terrain}</span>
                            <span className="tile-symbol-name">{tile.symbol}</span>
                          </span>
                          {view.glow && <span className="glow-dot" aria-hidden="true" />}
                        </>
                      ) : (
                        <Token owner={owner} />
                      )}
                      {view.last && <span className="last-mark" aria-hidden="true" />}
                      {view.winning && <span className="winning-mark" aria-hidden="true" />}
                    </button>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
