# Paper simulation and agent handoff

Companion specification: `game-spec.md` in this directory.

Purpose: exercise the rules before writing game code. This document supplies a reproducible match, edge-case tests, tracking templates, and instructions for another agent. No match has been simulated yet; expected outcomes below are rule-derived expectations, not observed results.

## 1. Instructions for the receiving agent

1. Read the full game specification first. It is the authority for gameplay; this document is the test protocol.
2. Identify its provisional defaults. Use them for this test unless the owner explicitly changes them.
3. Do not silently add abilities, movement rules, objectives, costs, or victory exceptions.
4. Run the open-information fixture first. It intentionally exposes secrets for debugging, not as the final player experience.
5. Enumerate legal actions and explain the matching gate before every chosen action.
6. Keep a complete referee ledger; never infer charge, lock, or trap state from narrative alone.
7. After a complete action, resolve both objectives, status expiries, next-player blockade, and repetition in specification order.
8. If a contradiction or unresolvable ambiguity appears, stop at that exact state, record it, and ask the owner. Do not quietly repair the rule mid-game.
9. Afterwards, run targeted edge cases and a hidden-information test if separate player contexts are available.
10. Report findings and recommended rule changes separately from the match transcript. Do not implement software as part of this task.

Suggested handoff prompt:

> Read docs/game-spec.md and docs/paper-simulation.md completely. Act as a paper-playtest referee. Run the supplied open-information fixture, tracking every legal action, charge, trap, constraint, status, and terminal check. Use provisional defaults as documented, but label them in your report. Stop and ask if rules contradict. Do not invent missing rules or claim hidden-information validity while seeing both players' secrets. Produce a turn ledger, edge-case results, and evidence-backed balance questions. Do not edit the specification without approval or implement the game.

## 2. Test phases

### Phase A: open-information mechanics test

One referee may reason for both sides. All information is visible. This tests legality, interactions, and rule completeness, not bluffing or deduction. Use the exact fixture below before changing any parameters.

### Phase B: targeted edge cases

Use isolated positions to test resolution and terminal ordering. Reset between cases; these are not necessarily reachable histories. Say explicitly when a fixture is synthetic.

### Phase C: hidden-information play

Use a neutral referee with separate private observations for each player. Player agents must not receive the full referee ledger or the other player's private packet.

A single agent that already read both packets cannot credibly claim an independent hidden-information experiment. It can still do a useful open-information simulation and label that limitation.

Square is assigned to both players in the first test, so objective deduction cannot be evaluated meaningfully yet. Later tests need owner-approved distinct objectives and fresh player contexts.

## 3. Fixed board fixture

Coordinates are row A–D and column 1–4. Each terrain/symbol combination appears once.

| Row | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| A | Forest–Sun | Water–Moon | Mountain–Star | Desert–Wave |
| B | Mountain–Wave | Desert–Sun | Forest–Moon | Water–Star |
| C | Water–Sun | Forest–Star | Desert–Moon | Mountain–Moon |
| D | Desert–Star | Water–Wave | Mountain–Sun | Forest–Wave |

Audit before starting:
- 16 distinct terrain/symbol pairs.
- Each terrain appears four times; each symbol appears four times.
- No fighters deployed.
- No initial constraint.
- Player A starts with mandatory edge deployment.

This is a reproducible layout, not a claimed optimal or balanced board.

## 4. Full referee setup — contains secrets

Do not send this entire section to either player during a hidden-information test.

### Player A
- Objective: Square.
- Roster: Teleporter, Pusher, Trap Checker, Terrain Weaver.
- All four begin in reserve, charge 1 each.
- Shared recharge actions remaining: 3.
- Setup traps: B2 and C3.

### Player B
- Objective: Square.
- Roster: Swapper, Upgrader, Puller, Trapper.
- All four begin in reserve, charge 1 each.
- Shared recharge actions remaining: 3.
- Setup traps: A3 and D2.

There is no Anchor in this fixture; test it separately. These rosters are chosen to cover eight different abilities, not because their matchup is known to be balanced.

Initial trap placements do not overlap in this match. Use a dedicated case for overlap.

### Private packet template

Give each player only:
- Public board and public action history.
- Their own objective and selected roster.
- Their own trap locations.
- Their own private inspection results.
- Current public fighter charges/statuses, recharge budgets, active player, and constraint.

Own traps may later be removed by enemy inspection without the owner being told. Therefore maintain both actual referee trap state and the owner's last-known trap state; a player's belief is not proof a trap is still live. Whether to notify the setter of private disarming is an information-design question for later testing. For v0.1, do not notify them, following the private inspection rule.

## 5. Short optional smoke-test opening

These are legal example actions with expected consequences, not required strategic choices or evidence of a played match. Either use this prefix or start freely, and record which choice you made.

1. **A deploys Teleporter at A1 (Forest–Sun).**
   - Edge cell, so opening is legal.
   - No trap there.
   - Constraint becomes Forest–Sun.
2. **B deploys Swapper at B2 (Desert–Sun).**
   - Matches Sun.
   - A's B2 trap triggers and is consumed.
   - Swapper's charge changes from 1 to 0; no lock is applied.
   - Constraint becomes Desert–Sun.
3. **A deploys Pusher at D3 (Mountain–Sun).**
   - Matches Sun.
   - No trap there.
   - Constraint becomes Mountain–Sun.
4. **B deploys Upgrader at A3 (Mountain–Star).**
   - Matches Mountain.
   - B's own A3 trap is safe and remains live.
   - Constraint becomes Mountain–Star.
5. **A deploys Terrain Weaver at C2 (Forest–Star).**
   - Matches Star.
   - No trap there.
   - Constraint becomes Forest–Star.

After this prefix neither side has four deployed fighters, so neither can have completed Square. Audit all state before continuing. Player B acts next.

## 6. Turn worksheet

For every turn, record:

```text
Turn / active player:
Current constraint:
Public board (fighter IDs and tile attributes):
Reserves: full referee identities; player-facing counts only:
Fighter charges:
Shared recharge budgets:
Locks and exact expiry turns:
Protection and exact expiry turns:
Live traps (referee only):
Private observations/beliefs (if hidden test):

Legal actions:
- Deploy: list matching empty cells and eligible reserve fighters.
- Move: each unlocked actor -> legal empty orthogonal destinations.
- Recharge: eligible actor, budget availability.
- Abilities: actor, target(s), matching tile, costs, next constraint.

Chosen action:
Why legal:
Player rationale using only permitted knowledge:
Cost paid:
Positional/terrain changes:
Traps triggered or disarmed:
Charge/status changes:
Resulting constraint:
A objective satisfied? B objective satisfied?
Expiring statuses:
Next player's legal-action count / blockade result:
Canonical repetition signature / occurrence count:
Outcome or next turn:
```

For compact board notation use `A:TP(1)` for A's charged Teleporter and `B:SW(0,L)` for B's uncharged, locked Swapper. Do not let abbreviated display replace the detailed ledger.

For action counts, distinguish actor/target choices even if some produce the same resulting state. Record any count convention used consistently.

## 7. Choosing moves during the test

Use this priority guide, not a promise of optimal play:
1. Seek a legal immediate objective win.
2. Avoid completing only the opponent's objective.
3. If no immediate win, identify opponent threats and available disruption.
4. Consider natural blockade opportunities and risks.
5. Improve the arrangement without ignoring the constraint you hand over.
6. Consider charge expenditure and trap risk.

Open-information decisions can use all secrets but must be marked as such. Hidden-information decisions must not use unseen roster identities, actual enemy traps, or hidden objective assignments.

Do not deliberately make illegal or obviously losing moves merely to show an ability. Use synthetic tests for ability coverage instead.

## 8. Targeted edge-case checklist

For each case provide: starting state, proposed action, expected outcome, actual walkthrough result, and pass/fail/blocked. A test is not passed merely because it appears in this list.

### Matching and ordinary actions
1. A tile matches terrain only: legal if all other conditions hold.
2. A tile matches symbol only: legal if all other conditions hold.
3. Neither matches: reject without spending resources or ending the turn.
4. Diagonal normal movement: reject.
5. Source does not match but normal-move destination does: allowed.
6. No matching empty tile, but a matching legal recharge exists: not a blockade.
7. Matching empty cell exists, but no reserve and no fighter can reach it: check all other actions; do not assume deployment is possible.
8. Invalid ability target: do not spend its charge.

### Charges and support
9. Upgrader with charge 1 adjacent to an unlocked ally at charge 0 transfers its charge: total charge does not increase.
10. Upgrader cannot recharge itself, a charged ally, a nonadjacent ally, or a locked ally.
11. Shared recharge consumes one budget unit and cannot exceed charge 1.
12. A fighter at charge 0 may still move normally.

### Traps
13. Own fighter enters own trap: no revelation, consumption, or penalty.
14. Enemy at charge 1 enters: trap consumed, charge becomes 0, no lock.
15. Enemy at charge 0 enters: trap consumed, lock applied with explicit expiry.
16. Teleporter spends its charge and lands on an enemy trap: lock, not merely charge loss.
17. Swapper exchanges two fighters onto separate hostile traps: resolve both entries before checking objectives.
18. Opposing traps overlap: entering fighter triggers only its enemy-owned trap.
19. Push an enemy onto your trap: trigger normally.
20. A trapped/locked fighter still counts toward Square.
21. Another fighter displaces a locked fighter: allowed if otherwise legal.
22. Trapper places beneath an ally: no immediate trigger.
23. Trapper cannot place beneath an enemy or stack a second friendly trap.
24. Trapper placement leaves the constraint unchanged and conceals destination.
25. Trap Checker disarms adjacent enemy traps but leaves friendly traps intact.
26. Trap Checker finds nothing: still spends its charge and action legally.
27. A setup trap on the opening cell triggers on deployment.
28. Lock leaves no legal action at the owner's next turn: owner loses rather than skipping.

### Displacement, protection, and terrain
29. Push destination is occupied or off-board: reject.
30. Pull has no empty intervening cell: reject.
31. Push/Pull target tile matches, destination does not: still legal; destination sets the new constraint.
32. Anchor blocks enemy Push/Pull/Swap on protected target.
33. Anchor does not prevent allied displacement or trap effects.
34. Anchor expires after the opponent's next turn.
35. Terrain Weaver exchanges attributes only: fighters and traps stay at coordinates.
36. Terrain exchange does not trigger a trap beneath a stationary fighter.
37. Terrain Weaver sets the constraint from the new tile beneath itself.

### Endings and repetition
38. Acting player alone completes Square: immediate win; no final-response turn.
39. Acting player completes only opponent's Square by displacement: opponent wins.
40. Both objectives satisfied after the entire action: draw. If unreachable for Square under a legal history, label a direct state-based terminal test as synthetic rather than claiming a reachable simultaneous win.
41. Objective completion and next-player blockade coexist: objective result has priority.
42. Both players have no legal action in a constructed state: active player loses; blockade is not a simultaneous draw rule.
43. Same fighter positions with different charges, terrain, traps, or constraint: not identical repetition states.
44. Third occurrence of the full canonical state: draw, unless higher-priority terminal checks already ended the match.
45. Lock/protection expiry normalization: equivalent remaining duration compares equal even at different absolute turn numbers.

## 9. Canonical state for repetition

Construct a deterministic serialized record at start-of-turn boundaries:

```text
activePlayer
constraint = terrain + symbol, or opening marker
terrainByCell in A1..D4 order
fighters sorted by owner then type:
  owner, type, reserve/cell, charge, remainingLockDuration, remainingProtectionDuration
remainingRechargeBudget for each owner
liveTraps sorted by owner then cell
objectives for each owner
```

For temporary effects, represent remaining duration relative to turn boundaries and ownership so that different expiry schedules are not collapsed incorrectly. Do not include the absolute turn number, narration, or move history. Retain inspection history separately for player observations.

Store the complete signature privately. For public logging, use a neutral identifier and occurrence count without revealing secret contents.

## 10. Stopping conditions

Stop a match when the specification declares an objective win, blockade defeat, simultaneous-objective draw, or repetition draw.

For effort control, the referee may stop after **80 total player actions** without a terminal result. Report `unfinished — paper-test safety limit`, not a draw. Preserve the complete state for continuation.

Stop immediately on a rule contradiction. Record the exact state, disputed rules, candidate interpretations, and what owner decision is needed.

## 11. Evidence to collect

- Total turns and terminal cause.
- Legal-action counts each turn, especially turns with only one option.
- Turns of deployment versus movement, recharge, and abilities.
- Each fighter's deployments and ability activations.
- Shared recharge expenditure and Upgrader transfers.
- Trap activations split by charge loss versus lock; beneficial or frustrating consequences.
- Trap Checker hits/misses and Trapper placements.
- How often a player knowingly gave the opponent a useful matching constraint.
- Whether a decisive trap was inferable from visible behavior or effectively a blind guess.
- Earliest credible threat and whether the defender had meaningful responses.
- Whether last-turn defeat followed a visible multi-turn setup or an opaque abrupt restriction.

A single match cannot establish balance. Compare repeated trials with starters swapped, alternative rosters, and new shuffled layouts. Tune one variable at a time.

## 12. Report template

```text
Test ID and spec version:
Information mode: open / properly isolated hidden / other
Fixture and any declared deviations:
Provisional defaults used:
Outcome and action count:
Turn ledger:
Final full referee state:
Edge-case results:
Rule contradictions or ambiguities:
Observed tactical interactions:
Balance concerns with turn references:
Untested interactions and confidence limits:
Recommended changes (not applied):
Next test:
```

Keep hidden referee state and player-facing reports separate if participants will continue playing. Preserve the baseline rules and distinguish factual walkthrough results from strategic opinions.
