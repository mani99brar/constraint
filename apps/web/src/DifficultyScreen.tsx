import { DIFFICULTY_OPTIONS, type Difficulty } from './difficulty';

export interface DifficultyScreenProps {
  readonly onChoose: (difficulty: Difficulty) => void;
  readonly onBack: () => void;
}

/** Versus bot (PRD S1): the bot's strength, then the board at once. */
export function DifficultyScreen({ onChoose, onBack }: DifficultyScreenProps) {
  return (
    <main className="new-game" data-testid="difficulty-screen">
      <header className="screen-head">
        <h1>Versus bot</h1>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </header>
      <p className="subtitle">Choose how strong the bot plays. You are Player 1; the board is dealt at once, and either of you may start.</p>
      <div className="difficulty-list" role="group" aria-label="Bot strength">
        {DIFFICULTY_OPTIONS.map((option) => (
          <button type="button" key={option.id} data-difficulty={option.id} className="difficulty" onClick={() => onChoose(option.id)}>
            <strong>{option.label}</strong>
            <span className="menu-note">{option.description}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
