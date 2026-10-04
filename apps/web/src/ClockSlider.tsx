import type { Player } from '@okiya/game';
import { CLOCK_OPTIONS, clockChoiceAt, clockChoiceWords, clockMinutes, type ClockChoice } from './clock';

/**
 * One player's clock on the home screen's play panel: a slider from off to five minutes in whole minutes,
 * with the chosen time shown beside it. Arrow keys, Home and End move it, as on any slider.
 */
export function ClockSlider({ player, value, onChange }: { player: Player; value: ClockChoice; onChange: (choice: ClockChoice) => void }) {
  const number = player === 'A' ? 1 : 2;
  const label = CLOCK_OPTIONS.find((option) => option.id === value)!.label;
  return (
    <div className="clock-slider" data-testid={`clock-control-${player}`} data-value={value}>
      <input
        type="range"
        min={0}
        max={5}
        step={1}
        value={clockMinutes(value)}
        aria-label={`Player ${number} clock`}
        aria-valuetext={clockChoiceWords(value)}
        data-testid={`clock-slider-${player}`}
        onChange={(event) => onChange(clockChoiceAt(Number(event.currentTarget.value)))}
      />
      <output className={`clock-value${value === 'off' ? ' off' : ''}`} data-testid={`clock-value-${player}`} aria-hidden="true">
        {label}
      </output>
    </div>
  );
}
