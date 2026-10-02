import { BOT_DEPTHS, type BotDepthId } from './difficulty';

export interface DifficultyScreenProps {
  readonly onChoose: (depth: BotDepthId) => void;
  readonly onBack: () => void;
}

/** New game, step one (PRD E2): the bot's strength. Setup follows. */
export function DifficultyScreen({ onChoose, onBack }: DifficultyScreenProps) {
  return (
    <main className="new-game" data-testid="difficulty-screen">
      <header className="match-header">
        <h1>New game</h1>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </header>
      <p className="subtitle">Choose how strong the bot plays. You pick your fighters and traps next.</p>
      <div className="difficulty-list" role="group" aria-label="Bot strength">
        {BOT_DEPTHS.map((depth) => (
          <button type="button" key={depth.id} data-depth={depth.id} className="difficulty" onClick={() => onChoose(depth.id)}>
            <strong>{depth.label}</strong>
            <span className="menu-note">{depth.description}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
