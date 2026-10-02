# Working-title Okiya: original tactical game specification

Status: paper-playtest specification v0.2. One open-information paper test has run (`paper-test-01.md`); no implementation yet.

Changes from v0.1 (owner decisions recorded in `paper-test-01.md`, 2026-10-02):
- Trap Checker inspects one chosen adjacent cell that is empty or enemy-occupied, instead of all adjacent cells (§9, §13).
- Lock duration reading confirmed: a locked fighter misses exactly one of its owner's turns (§8.2).

This is an original game designed from scratch, not an update to an existing Okiya implementation or a reproduction of Bruno Cathala's rules. Its central inherited idea is that an action's tile attributes bound the opponent's next legal choices. The working name does not establish rights to the existing Okiya name or branding.

## 1. Design intent

Two players build a hidden winning arrangement on a shared 4×4 board using four unique fighters each. Players predict objectives from public actions, constrain each other's choices, and use limited technical abilities and secret traps to change positions. There is no health, damage, or conventional combat.

Desired experience:
- Predicting the opponent's likely choice and objective.
- Traps and positioning plans that develop over several turns.
- Meaningful choices among deployment, movement, abilities, and recharge.
- Defeat earned through accumulated pressure, while acknowledging that immediate blockade defeat can still result from one mistake.
- Enough public information for deduction, with hidden undeployed identities, traps, and objectives.

There are no combo bonuses. Earlier concepts involving persistent damaged tiles, trap-clearing actions, public objective announcements, and a final-response turn have been removed.

## 2. Authority and scope

Sections marked **Provisional** fill gaps necessary for an executable paper test. They are recommendations, not additional user-approved decisions. Record changes explicitly between test versions; do not silently alter rules during a match.

Confirmed foundation:
- 4×4 board, with a shuffled fixed set of 16 two-attribute tiles.
- Four unique fighters per roster; players select rosters after receiving objectives.
- Undeployed fighter identities and objectives are hidden. Deployed fighters and board actions are public, except secret trap locations.
- Orthogonal one-square normal movement; teleport is an ability exception.
- All abilities begin unlocked with one charge, capped at one.
- One action per turn. Ability activation consumes the action and one charge.
- Limited player-wide recharge actions, each restoring one spent fighter charge.
- Two secretly placed setup traps per player; opposing traps may overlap.
- Trapper alone can place traps during play, adjacent to itself on an empty cell or a cell occupied by an ally.
- Own fighters do not trigger own traps.
- A triggered trap is consumed: remove an available ability charge, otherwise temporarily lock the affected fighter's actions.
- Locked fighters can be displaced by other fighters and still count toward objectives.
- No legal action means defeat, including when a trap lock causes the blockade.
- Objectives win immediately; simultaneous completion is a draw; repeated full states can draw.
- Square is the first test objective, assigned to both players to isolate mechanics from objective balance.

## 3. Components and coordinates

- Rows A–D, top to bottom; columns 1–4, left to right.
- Orthogonal adjacency means one row or one column apart, never diagonal. No wrapping.
- Each cell holds one terrain tile, at most one fighter, and at most one trap from each player (the last limit is provisional).
- Four terrain types: Forest, Water, Mountain, Desert.
- Four symbols: Sun, Moon, Star, Wave.
- Exactly one tile for every terrain/symbol pair: 16 total.
- Terrain tiles remain on the board when fighters leave. They are not consumed by deployment.
- Terrain and symbols have no intrinsic bonuses or movement penalties.
- Each player has a selected roster of four fighters, two setup traps, and a recharge budget.
- Each fighter has an owner, type, location (reserve or cell), charge (0 or 1), and any temporary status.

Recommended initial recharge budget: **three per player**. This is the adopted starting playtest value, not an established balance result.

## 4. Information model

Public:
- Tile attributes, fighter locations, deployed identities, charge counts, locks, and protection.
- Active player, current matching constraint, remaining recharge budgets, and deployed count.
- All deployments, moves, recharges, ability declarations, and resolved trap effects.
- That a Trapper placement action occurred, but not its selected location.

Private to each player and the referee:
- Objective; no public progress counter.
- Identities of remaining reserve fighters.
- Own live trap locations.
- Private outcomes of Trap Checker inspections.

Referee-only complete state includes both players' secrets and repetition history. Players know each roster originally contains four fighters, so reserve count is inferable. They do not need reserve identities to know that a deployment may be possible.

Objective progress is derived from the current arrangement, not permanently accumulated. Opponents may infer it through observation.

**Provisional:** roster choices are simultaneous and secret, and both players may select the same fighter types. An objective is revealed at match end for verification.

## 5. Setup

1. Shuffle all 16 distinct tiles into the board and reveal the layout.
2. Assign each player a random hidden objective, before roster selection. For the first controlled test, override randomness and assign Square to both.
3. Each player secretly selects four distinct fighters from the pool in section 9. Fighters start in reserve, each with one charge.
4. Give each player three shared recharge actions and two setup traps.
5. Each secretly places two traps after seeing the board and choosing the roster.
6. Randomly choose the starting player.
7. Starting player must deploy a fighter onto an outside-edge cell. No matching constraint exists before this deployment. Its tile creates the first constraint.

**Provisional setup details:** setup traps may occupy any board cell; a player's two traps must occupy different cells; enemy traps may share those cells. Trap placement is simultaneous/privately committed. Traps can trigger on the opening deployment. For controlled tests use recorded placements and a fixed starter instead of randomization.

## 6. Matching constraint

Store the constraint as a pair of values `(terrain, symbol)`, not a pointer to a cell.

A tile matches when:

`tile.terrain == constraint.terrain OR tile.symbol == constraint.symbol`

A tile can match either or both. The relevant tile depends on the chosen action. Matching is necessary but not sufficient: occupancy, distance, charge, lock, protection, and resource conditions also apply.

The pair remains unchanged until a valid action updates it. Later tile exchanges do not retroactively change the stored pair.

Example: Forest–Moon permits actions whose specified matching tile has Forest or Moon. It does not require both.

## 7. Turn actions

Choose exactly one legal action. No free movement before or after an ability.

### 7.1 Deploy
- Select one reserve fighter and any empty matching cell (except the special opening rule).
- Place the fighter there and reveal its identity and charge.
- Resolve any enemy trap there.
- Set the constraint to the destination's attributes.
- No deployment-zone restriction after the opening.

### 7.2 Move
- Select an unlocked deployed fighter you own.
- Move it one orthogonal square to an empty matching cell.
- Its source tile need not match.
- Resolve destination traps and set the constraint to the destination's attributes.

### 7.3 Recharge (formerly called upgrade)
- Select your unlocked deployed fighter with charge 0 on a matching tile.
- Spend one of your remaining shared recharge actions and restore its charge to 1.
- Set the constraint to that fighter's tile.
- No stat increase, upgrade level, or permanent board marker is created.
- Cannot be used on reserve, locked, or already charged fighters.

### 7.4 Activate ability
- Select your unlocked deployed fighter with charge 1.
- Validate its complete ability conditions in section 9.
- Spend the charge, apply the ability, resolve traps caused by entry, then set the specified constraint.
- A fighter may use its ability on a later turn after its charge is restored.

There is no pass, general in-play trap placement, or trap-clearing action.

## 8. Trap rules

### 8.1 Trigger
A live trap triggers only when an enemy fighter enters its cell by deployment, normal movement, teleport, push, pull, or swap. Own fighters enter and occupy own traps safely, without revealing or consuming them.

A trap does not trigger merely because a fighter remains on its cell, terrain is exchanged beneath it, or an ability targets it without moving it. A trap placed beneath an allied fighter remains dormant until an enemy later enters.

### 8.2 Effect
Finish the positional effect, reveal and remove the triggered trap, then:
- If the entering fighter has charge 1: change it to 0.
- If it has charge 0: apply an action lock.

Charge loss is recoverable by recharge. It is not permanent ability removal.

A locked fighter cannot initiate movement or abilities and cannot be recharged by either the shared recharge action or Upgrader. Another fighter can still push, pull, or swap it. It still contributes to the objective.

**Provisional duration:** lock through the end of the affected owner's next turn. If triggered on its owner's current turn, it persists through that owner's following turn. If triggered on the opponent's turn, it covers the owner's upcoming turn. Reapplying a lock extends to the later expiry, rather than stacking durations. Confirmed reading: a locked fighter misses exactly one of its owner's turns; triggered on the owner's turn T, it expires at the end of the owner's turn T+2; triggered on the opponent's turn T, at the end of the owner's turn T+1. Tune only between tests.

Because an actor spends its ability charge before moving, a Teleporter or Swapper entering an enemy trap normally arrives with charge 0 and is locked.

### 8.3 Multiple traps and exchanges
- Enemy traps may overlap; each affects only the other player's fighters.
- **Provisional:** at most one live trap per owner per cell; different owners' traps are independent.
- Resolve all entries from a swap after exchanging positions, then apply both trap effects before checking victory.
- Removing an enemy trap does not remove a friendly trap in the same cell.
- A trap affects the entrant once. There is no persistent tile penalty and no special clearing action afterward.

## 9. Fighter pool

Each player selects four distinct types. All displacement is orthogonal and stays within the board. Pushing, pulling, and swapping may target allies or enemies. You cannot voluntarily activate an opponent's fighter.

### Teleporter
- Destination: any empty matching cell other than its current cell.
- Move the actor directly there; no intermediate cells are entered or checked for traps.
- Next constraint: destination tile.

### Pusher
- Target: an orthogonally adjacent fighter whose tile matches.
- The cell one square beyond the target, directly away from the actor, must be in bounds and empty.
- Move the target into that cell; actor stays still.
- Next constraint: target's destination tile, which need not match the old constraint.

### Swapper
- Target: an orthogonally adjacent fighter whose tile matches.
- Exchange actor and target positions.
- Next constraint: actor's destination tile.
- Resolve traps for both entering fighters.

### Upgrader
- Actor's tile must match.
- Target: an orthogonally adjacent allied fighter with charge 0 that is not locked.
- Spend actor's charge; restore target's charge to 1.
- Cannot target itself or exceed the one-charge cap.
- Next constraint: actor's tile.
- Uses no shared recharge resource; it transfers a charge rather than creating one.

### Trap Checker
- Actor's tile must match.
- Choose one in-bounds orthogonally adjacent cell that is empty or occupied by an enemy fighter. Cells occupied by an ally cannot be chosen.
- Inspect that cell and remove the enemy traps found there. Friendly traps in the same cell stay.
- Inspection results are private to the owner; the activation and spent charge are public.
- Next constraint: actor's tile.
- **Provisional:** inspection is legal even when no trap is present. Otherwise failed legality could reveal a hidden trap for free.

### Puller
- Target: a fighter exactly two cells away along a row or column, on a matching tile.
- The intervening cell must be empty.
- Move the target into the intervening cell; actor stays still.
- Next constraint: target's destination tile.

### Anchor
- Actor's tile must match.
- Target: itself or an orthogonally adjacent ally.
- Protect the target from enemy-forced push, pull, or swap through the end of the opponent's next turn.
- Friendly displacement, voluntary movement, traps, and terrain exchange remain allowed.
- Next constraint: actor's tile.
- **Provisional:** protection follows the fighter, cannot stack, and selecting an already protected target is illegal. Locks do not remove existing protection.

### Terrain Weaver
- Actor's current tile must match.
- Choose an orthogonally adjacent cell, occupied or empty.
- Exchange the two terrain tiles only. Fighters and traps remain in their cells.
- Next constraint: the new terrain/symbol pair beneath the actor.
- No fighter has entered a cell, so no traps trigger.

### Trapper
- Actor's tile must match.
- Choose an orthogonally adjacent cell that is empty or occupied by an ally.
- Secretly place one own trap there. Cannot place beneath an enemy or stack another own trap.
- Next constraint: unchanged, preserving the agreed trap-placement exception.
- **Provisional:** the destination need not match; the actor matching is the activation gate. The charge pays for the new trap, with no additional trap inventory. A later recharge can therefore enable another trap, but charge creation is bounded by shared recharge resources.
- Public declaration identifies the actor and charge expenditure, not the trap's location.

## 10. Objectives

### First test: Square
Win when all four of your fighters occupy the four cells of any adjacent 2×2 square. There are nine possible squares.

- All four fighters must be deployed and participate.
- Charge counts, locks, terrain, and symbols do not affect completion.
- Objectives are never announced during play.
- Check both players after every fully resolved action, regardless of whose turn it was.
- A forced move can complete the opponent's objective and cause your immediate loss.
- Both complete simultaneously: draw.

Future candidate objectives such as Line or Rectangle are not active rules. Do not randomly mix them into the first test. The eventual game can randomly assign from a validated objective pool; the initial one-objective pool is a mechanics test, not a test of hidden-objective deduction.

## 11. Resolution and terminal ordering

Maintain explicit turn numbers and scheduled status expiries.

At the start of a non-opening turn:
1. Enumerate legal deployments, movements, recharges, and abilities.
2. If none exist, the active player loses immediately. An available empty matching tile is not sufficient if no reserve fighter remains; an occupied matching tile may still enable an ability or recharge.
3. No passing or waiting for a lock to expire is allowed.

For a selected action:
1. Validate against pre-action state, including all private-state checks by the referee.
2. If invalid, reject without spending resources or advancing the turn.
3. Spend action costs.
4. Apply positions, terrain changes, recharge, protection, inspection, or trap placement.
5. Resolve all triggered traps and resulting charge loss/locks.
6. Update the matching constraint according to the action.
7. Check both objectives: both = draw; one = that player's win.
8. If continuing, expire statuses scheduled for the end of this turn.
9. Hand over to the other player.
10. Check that player's legal actions; none = their defeat.
11. If continuing, register the resulting start-of-turn state for repetition.

**Provisional terminal precedence:** objective resolution precedes blockade; blockade precedes repetition. These explicit priorities are necessary for edge cases and should be tested.

## 12. Repetition draw

**Provisional threshold:** automatic draw on the third occurrence of the same full start-of-turn gameplay state. Occurrences need not be consecutive. Similar-looking fighter positions alone are insufficient.

Include:
- Active player and stored constraint.
- Terrain arrangement.
- Fighter types, owners, locations/reserve membership, and charges.
- Remaining shared recharge resources.
- Live trap owners and cells, including hidden traps.
- Locks/protection represented by equivalent remaining duration, not absolute turn numbers.
- Assigned objectives.

Ignore narration, absolute turn counter, and history itself. Referee records a canonical signature privately; do not reveal hidden state to explain a repetition check. Private inspection memory can be logged separately; for this prototype it is not part of mechanical repetition identity.

No arbitrary match timer or turn cap is a game rule. A paper-test safety limit may stop an experiment as unfinished, not manufacture a winner or draw.

## 13. Prototype defaults requiring validation

These are runnable starting decisions, not demonstrated balance:
- Three shared recharge actions per player.
- One-own-turn lock duration and its exact timing.
- Opening edge deployment and traps triggering on it.
- Unrestricted setup trap locations, with no same-owner stacking.
- Same fighter types allowed across opposing rosters.
- Trap Checker inspecting and disarming one chosen adjacent empty or enemy-occupied cell, including legal empty inspections.
- Trapper's charge-only supply and unchanged constraint.
- Anchor protection duration and restriction against already protected targets.
- Third-full-state repetition threshold and terminal precedence.

Risks to investigate:
- Opening trap placement may reward blind guessing rather than deduction.
- Four fighters on 16 cells may create too many or too few legal moves under matching.
- Trap Checker or Trapper may dominate certain layouts.
- Anchor may make a formation too easy to preserve, although objective completion itself is immediate.
- Upgrader transfers may be unhelpful, or enable dominant ability sequences.
- Teleport's charge-before-trap timing may be harsher than ordinary movement.
- Forced displacement and terrain exchange may create abrupt blockades.
- Square-only tests do not establish balance across different objectives.
- Secret traps require a trusted referee or an eventual commitment/verification mechanism.

## 14. Next step

Use `paper-simulation.md` for a reproducible open-information test, then repeat with player-specific observations. Record evidence and proposed revisions; do not claim balance from a single game. Implementation should follow only after the rules survive these tests.
