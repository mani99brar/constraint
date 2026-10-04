export interface ModeScreenProps {
  readonly onVersusBot: () => void;
  readonly onTwoPlayers: () => void;
  readonly onBack: () => void;
}

/** New game (PRD S1): Versus bot, which then asks for a difficulty, or Two players on this device, which starts at once. */
export function ModeScreen({ onVersusBot, onTwoPlayers, onBack }: ModeScreenProps) {
  return (
    <main className="new-game" data-testid="mode-screen">
      <header className="screen-head">
        <h1>New game</h1>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </header>
      <p className="subtitle">Play the bot, or two of you take turns on this device.</p>
      <div className="difficulty-list" role="group" aria-label="Mode">
        <button type="button" data-mode="bot" className="difficulty" onClick={onVersusBot}>
          <strong>Versus bot</strong>
          <span className="menu-note">You against the bot at Easy, Normal or Hard.</span>
        </button>
        <button type="button" data-mode="two-player" className="difficulty" onClick={onTwoPlayers}>
          <strong>Two players</strong>
          <span className="menu-note">Player 1 and Player 2 take turns on this device.</span>
        </button>
      </div>
    </main>
  );
}
