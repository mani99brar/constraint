import type { FighterId } from '@okiya/rules';
import { FaceDownToken, Token } from './Token';
import type { TokenState } from './tokens';

export interface OwnTrayProps {
  readonly tokens: readonly TokenState[];
  readonly selected: FighterId | null;
  readonly playable: ReadonlySet<FighterId>;
  readonly disabled: boolean;
  readonly onSelect: (fighter: FighterId) => void;
}

/** The player's unplaced tokens under the board (PRD T2): tap one, then a glowing cell. Hidden once empty. */
export function OwnTray({ tokens, selected, playable, disabled, onSelect }: OwnTrayProps) {
  if (tokens.length === 0) return null;
  return (
    <section className="tray own-tray" aria-label="Your tray" data-testid="own-tray" data-count={tokens.length}>
      {tokens.map((token) => (
        <button
          type="button"
          key={token.id}
          className={`tray-token${token.id === selected ? ' selected' : ''}`}
          data-fighter={token.id}
          data-playable={playable.has(token.id) || undefined}
          aria-label={token.label}
          aria-pressed={token.id === selected}
          aria-disabled={disabled || undefined}
          onClick={() => {
            if (!disabled) onSelect(token.id);
          }}
        >
          <Token token={token} />
        </button>
      ))}
    </section>
  );
}

/** The bot's unplaced tokens above the board, face down: only their number shows (PRD T2, I4). Hidden once empty. */
export function BotTray({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <section className="tray bot-tray" aria-label={`Bot's tray: ${count} face-down token${count === 1 ? '' : 's'}`} data-testid="bot-tray" data-count={count}>
      {Array.from({ length: count }, (_, index) => (
        <FaceDownToken key={index} />
      ))}
    </section>
  );
}
