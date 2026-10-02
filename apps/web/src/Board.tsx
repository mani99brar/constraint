import { useRef, useState, type KeyboardEvent } from 'react';
import {
  ALL_CELLS,
  cellColumn,
  cellRow,
  COLUMNS,
  isEdgeCell,
  ROWS,
  type Board as BoardTiles,
  type CellId,
  type FighterId,
  type FighterState,
  type PlayerId,
} from '@okiya/rules';
import { SymbolEmblem, TerrainScene, TrapIcon } from './art';
import type { LastMove } from './events';
import { boardKey, tabStop } from './keyboard';
import type { PieceButton, PieceMode } from './pieceActions';
import { INSPECTED_TRAP, cellAccessibleName, tokenState } from './tokens';
import { Token } from './Token';

/** The buttons beside the selected token (PRD T3). */
export interface TokenActions {
  readonly cell: CellId;
  readonly buttons: readonly PieceButton[];
  readonly mode: PieceMode;
  readonly onPress: (button: PieceButton) => void;
}

export interface BoardProps {
  readonly testId: string;
  readonly board: BoardTiles;
  readonly human: PlayerId;
  readonly fighters: readonly FighterState[];
  readonly ownTraps: ReadonlySet<CellId>;
  /** Own traps the bot's Trap Checker inspected; they may have been removed. */
  readonly inspectedTraps?: ReadonlySet<CellId>;
  /** The cells where the selected token can act; empty with highlights off. */
  readonly glowing?: ReadonlySet<CellId>;
  /** Tokens that can act now, marked while highlights are on. */
  readonly playable?: ReadonlySet<FighterId>;
  readonly selected?: FighterId | null;
  readonly lastMove?: LastMove | null;
  readonly actions?: TokenActions | null;
  /** True while the bot moves: taps are ignored, focus still moves. */
  readonly disabled?: boolean;
  readonly onCellClick: (cell: CellId) => void;
}

/**
 * The board as a framed tray of illustrated tiles (PRD T6): every cell a button named by its
 * cell, tile, token and own trap (PRD U3), one Tab stop with arrow keys moving between cells,
 * and Enter or Space to tap a cell.
 */
export function Board(props: BoardProps) {
  const { testId, board, human, fighters, ownTraps, inspectedTraps, glowing, playable, selected, lastMove, actions, disabled, onCellClick } = props;
  const [focused, setFocused] = useState<CellId | null>(null);
  const cellRefs = useRef(new Map<CellId, HTMLButtonElement>());
  const stop = tabStop(focused, glowing ?? []);

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
    <div className="board-frame" data-testid={`${testId}-frame`}>
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
      <div role="grid" aria-label="Board" aria-disabled={disabled || undefined} className="board" data-testid={testId}>
        {ROWS.map((row) => (
          <div role="row" key={row} className="board-row">
            {ALL_CELLS.filter((cell) => cell.startsWith(row)).map((cell) => {
              const tile = board[cell];
              const fighter = fighters.find((candidate) => candidate.cell === cell);
              const glow = glowing?.has(cell) ?? false;
              const ownTrap = ownTraps.has(cell);
              const inspected = ownTrap && (inspectedTraps?.has(cell) ?? false);
              const recent = lastMove?.cells.has(cell) ?? false;
              const isSelected = fighter !== undefined && fighter.id === selected;
              const canAct = fighter !== undefined && (playable?.has(fighter.id) ?? false);
              const cellActions = actions && actions.cell === cell && actions.buttons.length > 0 ? actions : null;
              return (
                <div role="gridcell" key={cell} className="cell-slot" data-slot={cell}>
                  <button
                    type="button"
                    ref={(element) => {
                      if (element) cellRefs.current.set(cell, element);
                      else cellRefs.current.delete(cell);
                    }}
                    tabIndex={cell === stop ? 0 : -1}
                    className={`cell terrain-${tile.terrain.toLowerCase()}${glow ? ' glow' : ''}${isSelected ? ' selected' : ''}${recent ? ' recent' : ''}`}
                    data-cell={cell}
                    data-row={cellRow(cell)}
                    data-column={cellColumn(cell)}
                    data-terrain={tile.terrain}
                    data-symbol={tile.symbol}
                    data-edge={isEdgeCell(cell)}
                    data-glow={glow}
                    data-occupied={fighter !== undefined}
                    data-owner={fighter?.owner}
                    data-playable={canAct || undefined}
                    data-own-trap={ownTrap}
                    data-inspected={inspected || undefined}
                    data-recent={recent}
                    data-recent-player={recent ? lastMove?.player : undefined}
                    aria-disabled={disabled || undefined}
                    aria-label={cellAccessibleName(cell, tile, fighter, human, ownTrap, inspected)}
                    aria-pressed={fighter?.owner === human ? isSelected : undefined}
                    onFocus={() => setFocused(cell)}
                    onClick={() => {
                      if (!disabled) onCellClick(cell);
                    }}
                    onKeyDown={(event) => onKeyDown(cell, event)}
                  >
                    <TerrainScene terrain={tile.terrain} />
                    <span className="tile-symbol">
                      <SymbolEmblem symbol={tile.symbol} />
                    </span>
                    <span className="tile-label" aria-hidden="true">
                      <span className="tile-terrain">{tile.terrain}</span>
                      <span className="tile-symbol-name">{tile.symbol}</span>
                    </span>
                    {ownTrap && (
                      <span className={`trap-marker${inspected ? ' inspected' : ''}`} data-testid="trap-marker" title={inspected ? `Your trap, ${INSPECTED_TRAP}` : 'Your trap'}>
                        <TrapIcon />
                        {inspected && <span className="trap-query">?</span>}
                      </span>
                    )}
                    {fighter && <Token token={tokenState(fighter, human)} />}
                    {glow && !fighter && <span className="glow-dot" aria-hidden="true" />}
                    {recent && <span className="recent-mark" aria-hidden="true" />}
                  </button>
                  {cellActions && (
                    <span className={`token-actions row-${cellRow(cell)} column-${cellColumn(cell)}`} data-testid="token-actions">
                      {cellActions.buttons.map((button) => (
                        <button
                          type="button"
                          key={button.kind}
                          className={`token-action ${button.kind}`}
                          data-kind={button.kind}
                          aria-label={button.label}
                          aria-pressed={button.kind === 'ability' ? cellActions.mode === 'ability' : undefined}
                          onClick={() => cellActions.onPress(button)}
                        >
                          {button.text}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
