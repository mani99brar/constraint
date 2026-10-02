import { TokenMark } from './art';

/**
 * A round player token (PRD U1): yours solid-rimmed with a ring, the bot's notch-rimmed with a
 * diamond, in two colours, so colour is never the only signal. Its words are in the cell's name.
 */
export function Token({ owner }: { owner: 'you' | 'bot' }) {
  return (
    <span className={`token ${owner === 'you' ? 'own' : 'bot'}`} data-testid="token" data-owner={owner} data-rim={owner === 'you' ? 'solid' : 'notched'} aria-hidden="true">
      <TokenMark owner={owner} />
    </span>
  );
}
