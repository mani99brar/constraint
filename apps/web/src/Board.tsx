import { useRef, useState, type KeyboardEvent } from 'react';
import { ALL_CELLS, cellColumn, cellRow, isEdgeCell, ROWS, type Board as BoardTiles, type CellId, type FighterState, type PlayerId } from '@okiya/rules';
import type { RecentAction } from './events';
import { LockIcon, ShieldIcon, SymbolIcon, TerrainIcon, TrapIcon } from './icons';
import { boardKey, tabStop } from './keyboard';
import { cellAccessibleName, fighterAbbreviation, fighterName, sideName } from './text';

export interface BoardProps {
  readonly testId: string;
  readonly board: BoardTiles;
  readonly human: PlayerId;
  readonly fighters: readonly FighterState[];
  readonly ownTraps: ReadonlySet<CellId>;
  readonly highlighted?: ReadonlySet<CellId>;
  readonly selected?: string | undefined;
  /** The last action's cells and trap callouts (PRD U6). */
  readonly recent?: RecentAction | null;
  /** Own traps the bot's Trap Checker inspected; they may have been removed. */
  readonly inspectedTraps?: ReadonlySet<CellId>;
  /** True while the bot moves: clicks are ignored, focus still moves. */
  readonly disabled?: boolean;
  readonly onCellClick: (cell: CellId) => void;
}

/**
 * The 4×4 board: every cell a button named by its cell, tile, fighter and own trap (PRD U1, U3),
 * one Tab stop with arrow keys moving focus between cells, and Enter or Space to choose a cell.
 */
export function Board(props: BoardProps) {
  const { testId, board, human, fighters, ownTraps, highlighted, selected, recent, inspectedTraps, disabled, onCellClick } = props;
  const [focused, setFocused] = useState<CellId | null>(null);
  const cellRefs = useRef(new Map<CellId, HTMLButtonElement>());
  const stop = tabStop(focused, highlighted ?? []);

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
    <div role="grid" aria-label="Board" aria-disabled={disabled || undefined} className="board" data-testid={testId}>
      {ROWS.map((row) => (
        <div role="row" key={row} className="board-row">
          {ALL_CELLS.filter((cell) => cell.startsWith(row)).map((cell) => {
            const tile = board[cell];
            const fighter = fighters.find((candidate) => candidate.cell === cell);
            const isHighlighted = highlighted?.has(cell) ?? false;
            const ownTrap = ownTraps.has(cell);
            const inspected = ownTrap && (inspectedTraps?.has(cell) ?? false);
            const isRecent = recent?.cells.has(cell) ?? false;
            const callouts = recent?.callouts.filter((callout) => callout.cell === cell) ?? [];
            const own = fighter?.owner === human;
            return (
              <button
                type="button"
                key={cell}
                role="gridcell"
                ref={(element) => {
                  if (element) cellRefs.current.set(cell, element);
                  else cellRefs.current.delete(cell);
                }}
                tabIndex={cell === stop ? 0 : -1}
                className={`cell terrain-${tile.terrain.toLowerCase()}${isHighlighted ? ' highlighted' : ''}${
                  fighter && fighter.id === selected ? ' selected' : ''
                }${isRecent ? ' recent' : ''}`}
                data-cell={cell}
                data-row={cellRow(cell)}
                data-column={cellColumn(cell)}
                data-terrain={tile.terrain}
                data-symbol={tile.symbol}
                data-edge={isEdgeCell(cell)}
                data-highlighted={isHighlighted}
                data-occupied={fighter !== undefined}
                data-owner={fighter?.owner}
                data-own-trap={ownTrap}
                data-recent={isRecent}
                data-recent-turn={isRecent ? recent?.turn : undefined}
                data-recent-player={isRecent ? recent?.player : undefined}
                aria-disabled={disabled || undefined}
                aria-label={cellAccessibleName(cell, tile, fighter, human, ownTrap, inspected)}
                aria-selected={fighter !== undefined && fighter.id === selected}
                onFocus={() => setFocused(cell)}
                onClick={() => {
                  if (!disabled) onCellClick(cell);
                }}
                onKeyDown={(event) => onKeyDown(cell, event)}
              >
                <span className="cell-head">
                  <span className="cell-id">{cell}</span>
                  <span className="symbol">
                    <SymbolIcon symbol={tile.symbol} />
                    {tile.symbol}
                  </span>
                </span>
                {fighter && (
                  <span className={`token ${own ? 'own' : 'enemy'}`} data-fighter={fighter.id} data-charge={fighter.charge}>
                    <span className="token-badge" data-shape={own ? 'circle' : 'diamond'}>
                      <span className="token-code">{fighterAbbreviation(fighter.type)}</span>
                    </span>
                    <span className="token-side">
                      {sideName(fighter.owner, human)}
                      <span className="token-name">{fighterName(fighter.type)}</span>
                      <span className="token-status">
                      <span className={`charge-dot ${fighter.charge === 1 ? 'full' : 'empty'}`} title={fighter.charge === 1 ? 'charged' : 'spent'} />
                      {fighter.lock && (
                        <span className="status-icon" title="locked">
                          <LockIcon />
                        </span>
                      )}
                      {fighter.protection && (
                        <span className="status-icon" title="protected">
                          <ShieldIcon />
                        </span>
                      )}
                      </span>
                    </span>
                  </span>
                )}
                {ownTrap && (
                  <span className={`trap${inspected ? ' inspected' : ''}`}>
                    <TrapIcon />
                    {inspected ? 'trap?' : 'trap'}
                  </span>
                )}
                {callouts.map((callout, index) => (
                  <span key={index} className="callout" data-testid="trap-callout" data-callout-cell={cell} title={callout.text}>
                    {callout.short}
                  </span>
                ))}
                <span className="terrain">
                  <TerrainIcon terrain={tile.terrain} />
                  {tile.terrain}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
