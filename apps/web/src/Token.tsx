import { FighterEmblem, LockIcon, ShieldIcon, TokenBack } from './art';
import { FACE_DOWN_LABEL, type TokenState } from './tokens';

/**
 * A round fighter token (PRD T5): emblem, name (initials when small), a charge pip, and lock and
 * protection badges. Its words are in the accessible name of the cell or tray button around it.
 */
export function Token({ token }: { token: TokenState }) {
  return (
    <span
      className={`token ${token.own ? 'own' : 'bot'}${token.charged ? '' : ' spent'}${token.locked ? ' locked' : ''}${token.protected ? ' protected' : ''}`}
      data-testid="token"
      data-fighter={token.id}
      data-owner={token.own ? 'you' : 'bot'}
      data-rim={token.own ? 'solid' : 'notched'}
      data-charge={token.charged ? 1 : 0}
      data-locked={token.locked}
      data-protected={token.protected}
      data-label={token.label}
      title={token.label}
      aria-hidden="true"
    >
      <span className="token-face">
        <FighterEmblem type={token.type} />
        <span className="token-name">{token.name}</span>
        <span className="token-initials">{token.initials}</span>
      </span>
      <span className={`token-charge${token.charged ? ' full' : ''}`} />
      {token.locked && (
        <span className="token-badge lock">
          <LockIcon />
        </span>
      )}
      {token.protected && (
        <span className="token-badge shield">
          <ShieldIcon />
        </span>
      )}
    </span>
  );
}

/** One of the bot's unplaced tokens, face down: it never says which fighter it is (PRD I4). */
export function FaceDownToken() {
  return (
    <span className="token bot face-down" role="img" aria-label={FACE_DOWN_LABEL} data-testid="face-down-token" data-rim="notched">
      <TokenBack />
    </span>
  );
}
