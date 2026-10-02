import { ALL_CELLS, isEdgeCell, type Board as BoardTiles, type CellId, type FighterState, type PlayerId } from '@okiya/rules';
import { cellAccessibleName, fighterName, sideName, symbolIcon } from './text';

export interface BoardProps {
  readonly testId: string;
  readonly board: BoardTiles;
  readonly human: PlayerId;
  readonly fighters: readonly FighterState[];
  readonly ownTraps: ReadonlySet<CellId>;
  readonly highlighted?: ReadonlySet<CellId>;
  readonly selected?: string | undefined;
  readonly onCellClick: (cell: CellId) => void;
}

/** The 4×4 board: every cell a button named by its cell, tile, fighter and own trap (PRD U1, U3). */
export function Board({ testId, board, human, fighters, ownTraps, highlighted, selected, onCellClick }: BoardProps) {
  return (
    <div role="grid" aria-label="Board" className="board" data-testid={testId}>
      {ALL_CELLS.map((cell) => {
        const tile = board[cell];
        const fighter = fighters.find((candidate) => candidate.cell === cell);
        const isHighlighted = highlighted?.has(cell) ?? false;
        const ownTrap = ownTraps.has(cell);
        return (
          <button
            type="button"
            key={cell}
            role="gridcell"
            className={`cell terrain-${tile.terrain.toLowerCase()}${isHighlighted ? ' highlighted' : ''}${
              fighter && fighter.id === selected ? ' selected' : ''
            }`}
            data-cell={cell}
            data-terrain={tile.terrain}
            data-symbol={tile.symbol}
            data-edge={isEdgeCell(cell)}
            data-highlighted={isHighlighted}
            data-occupied={fighter !== undefined}
            data-owner={fighter?.owner}
            data-own-trap={ownTrap}
            aria-label={cellAccessibleName(cell, tile, fighter, human, ownTrap)}
            onClick={() => onCellClick(cell)}
          >
            <span className="cell-id">{cell}</span>
            <span className="tile">
              {tile.terrain} {symbolIcon(tile.symbol)} {tile.symbol}
            </span>
            {fighter && (
              <span className={`token ${fighter.owner === human ? 'own' : 'enemy'}`}>
                {sideName(fighter.owner, human)}: {fighterName(fighter.type)} ({fighter.charge})
                {fighter.lock ? ' 🔒' : ''}
                {fighter.protection ? ' 🛡' : ''}
              </span>
            )}
            {ownTrap && <span className="trap">your trap</span>}
          </button>
        );
      })}
    </div>
  );
}
