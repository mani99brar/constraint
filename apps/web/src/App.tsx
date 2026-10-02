import { useMemo, useState } from 'react';
import type { MatchState, PreparedMatch } from '@okiya/rules';
import { Guide } from './Guide';
import { browserStorage, guideStartsOpen, rememberDismissed } from './guide';
import { createMatch, HUMAN } from './match';
import { MatchScreen } from './MatchScreen';
import { SetupScreen } from './SetupScreen';
import { initialChoice, scenarioSetup, type BotDepthId } from './start';
import { StartScreen } from './StartScreen';

type Screen =
  | { readonly kind: 'landing' }
  | { readonly kind: 'setup'; readonly prepared: PreparedMatch; readonly depth: BotDepthId }
  | { readonly kind: 'match'; readonly state: MatchState; readonly prepared: PreparedMatch; readonly depth: BotDepthId };

/**
 * Landing page: choose the preset, scenario, seed and bot depth, then set up and play. A scenario
 * that fixes the player's roster and traps skips the setup screen (PRD S4). The help button
 * reopens the first-match guide, whose dismissal is remembered (PRD U7).
 */
export function App() {
  const storage = useMemo(browserStorage, []);
  const [guideOpen, setGuideOpen] = useState(() => guideStartsOpen(storage));
  const [initial] = useState(() => initialChoice(window.location.search));
  const [screen, setScreen] = useState<Screen>({ kind: 'landing' });

  function dismissGuide() {
    rememberDismissed(storage);
    setGuideOpen(false);
  }

  function prepared(match: PreparedMatch, depth: BotDepthId) {
    const fixed = scenarioSetup(match.scenario, HUMAN);
    setScreen(fixed ? { kind: 'match', state: createMatch(match, fixed), prepared: match, depth } : { kind: 'setup', prepared: match, depth });
  }

  const leave = () => setScreen({ kind: 'landing' });
  let content;
  if (screen.kind === 'setup') {
    const { prepared: match, depth } = screen;
    content = (
      <SetupScreen
        prepared={match}
        onLeave={leave}
        onStart={(setup) => setScreen({ kind: 'match', state: createMatch(match, setup), prepared: match, depth })}
      />
    );
  } else if (screen.kind === 'match') {
    content = (
      <MatchScreen
        initialState={screen.state}
        depth={screen.depth}
        scenarioName={screen.prepared.scenario?.name ?? null}
        onLeave={leave}
      />
    );
  } else {
    content = <StartScreen initial={initial} onStart={prepared} />;
  }

  return (
    <div className="app">
      <header className="app-bar">
        <span className="brand">
          Okiya <span className="working-title">working title</span>
        </span>
        <button type="button" className="help-button" aria-expanded={guideOpen} aria-controls="guide" onClick={() => setGuideOpen(true)}>
          Help
        </button>
      </header>
      {guideOpen && <Guide objective="Square" onDismiss={dismissGuide} />}
      {content}
    </div>
  );
}
