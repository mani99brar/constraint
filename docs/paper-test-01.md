# Paper test 01 — open-information mechanics test

Test ID: PT-01. Spec version: game-spec.md v0.1 (paper-playtest spec). Protocol: paper-simulation.md.
Date run: 2026-10-02. Referee: single agent reasoning for both sides with full information.

Information mode: **open** (Phase A) plus synthetic edge cases (Phase B). No hidden-information validity is claimed.

## Declared deviations and owner decisions (2026-10-02)

- **D1 — Trap Checker (owner rule change, replaces spec §9 text).** The owner selects **one** orthogonally adjacent cell; it must be **empty or occupied by an enemy fighter**. Enemy traps there are removed. Inspection remains legal when nothing is found (provisional clause kept). Next constraint: actor's tile. Cells occupied by an ally are not selectable.
- **D2 — Anchor.** Owner confirmed play-as-written. Protection lasts through the end of the opponent's next turn, so "already protected target is illegal" is unreachable with one Anchor per roster. Flagged, not changed.
- **D3 — Lock reading confirmed.** A locked fighter misses exactly one of its owner's turns. Triggered on owner's turn T: expires end of owner's turn T+2. Triggered on opponent's turn T: expires end of owner's turn T+1.
- **D4 — Scope.** Phase A and Phase B only. Phase C not run.

Provisional defaults used unchanged: 3 recharges per player (per-player pool), lock = one own turn, opening edge deployment with traps live, unrestricted setup traps with no same-owner stacking, same types allowed across rosters, Trapper charge-only supply and unchanged constraint, third-occurrence repetition, terminal precedence objective > blockade > repetition.

Conventions: tiles abbreviated terrain F/W/M/D and symbol Su/Mo/St/Wa. Fighters: TP Teleporter, PU Pusher, TC Trap Checker, TW Terrain Weaver, SW Swapper, UP Upgrader, PL Puller, TR Trapper. `A:TP(1)` = A's Teleporter, charge 1; `L` = locked. Legal-action counts use (fighter, cell) for deploys and moves, (actor, target or cell) for abilities, actor for recharge. Smoke-test prefix from paper-simulation.md §5 was used for T1–T5. Repetition signature IDs S1..Sn are start-of-turn states; every one was a first occurrence.

## Fixture

```
     1        2        3        4
A  F-Su     W-Mo     M-St     D-Wa
B  M-Wa     D-Su     F-Mo     W-St
C  W-Su     F-St     D-Mo     M-Mo
D  D-St     W-Wa     M-Su     F-Wa
```
Audit: 16 distinct pairs, each terrain ×4, each symbol ×4. Pass.

A: Square. TP, PU, TC, TW. Traps B2, C3. Budget 3.
B: Square. SW, UP, PL, TR. Traps A3, D2. Budget 3.
Starter: A (fixed).

## Phase A ledger

### T1 — A (opening)
No constraint. Legal (48): any of 4 reserve fighters onto any of 12 edge cells.
Action: deploy TP at A1 (F-Su). Edge ✓. Trap: none. TP revealed (1). Constraint → F-Su.
Objectives: none. Next (B) legal: 24. S1 ×1.

### T2 — B
Constraint F-Su. Legal (24): deploy ×4 reserve → B2, B3, C1, C2, D3, D4 (F or Su).
Action: deploy SW at B2 (D-Su). Gate Su. **A's B2 trap triggers**: SW charge 1→0, no lock, trap consumed and revealed. Constraint → D-Su.
Objectives: none. Next (A) legal: 20. S2 ×1.

### T3 — A
Constraint D-Su. Legal (20): deploy ×3 → A4, C1, C3, D1, D3 (15); TP teleport → same 5 (5); TP moves: A2, B1 ✗ no match.
Action: deploy PU at D3 (M-Su). Gate Su. Trap: none. Constraint → M-Su.
Next (B) legal: 14. S3 ×1.

### T4 — B
Constraint M-Su. Legal (14): deploy ×3 → A3, B1, C1, C4 (12); SW→B1 (1); recharge SW on B2 D-Su ✓ (1).
Action: deploy UP at A3 (M-St). Gate M. **B's own A3 trap: safe, stays live, not revealed.** Constraint → M-St.
Next (A) legal: 16. S4 ×1.

### T5 — A
Constraint M-St. Legal (16): deploy ×2 → B1, B4, C2, C4, D1 (10); TP→B1 (1); TP teleport → 5 (5); PU moves/ability: none.
Action: deploy TW at C2 (F-St). Gate St. Trap: none. Constraint → F-St.
State after prefix: A:TP A1(1) PU D3(1) TW C2(1) TC res(1) · B:SW B2(0) UP A3(1) PL res TR res · budgets 3/3 · live traps A{C3} B{A3,D2}.
Next (B) legal: 10. S5 ×1.

### T6 — B
Constraint F-St. Legal (10): deploy PL/TR → B3, B4, D1, D4 (8); SW→B3, UP→B3 (2); recharge SW: B2 D-Su ✗; UP ability: tile matches St but no charge-0 adjacent ally.
Rationale (open): UP A3 + SW B2 sit on the A2/A3/B2/B3 square; B3 adds a third.
Action: deploy TR at B3 (F-Mo). Gate F. Trap: none. Constraint → F-Mo.
Next (A) legal: 16. S6 ×1.

### T7 — A
Constraint F-Mo. Legal (16): deploy TC → A2, C3, C4, D4 (4); moves TP→A2, TW→C3, PU→C3, PU→D4 (4); TP teleport → A2, C3, C4, D4 (4); TW weave (C2 F-St matches F) with B2/C1/C3/D2 (4); PU ability: no adjacent fighter.
Threat: B deploys PL at A2 next turn (W-Mo) and completes A2/A3/B2/B3 if the constraint carries W or Mo. Any A action except occupying A2 either leaves Mo (e.g. deploy TC at C3 → D-Mo loses at once) or merely delays.
Action: move TP A1→A2 (W-Mo). Gate Mo. Trap: none. Constraint → W-Mo.
Next (B) legal: 10. S7 ×1.

### T8 — B
Constraint W-Mo. Legal (10): deploy PL → B4, C1, C3, C4, D2 (5); TR→B4, TR→C3 (2); SW/UP moves: none; recharge SW ✗ (D-Su); UP ability ✗ (M-St); TR ability (B3 F-Mo matches Mo): place at B2 (ally, no own trap), B4, C3 (3).
Threat: A's C2/D3 pair aims at C2/C3/D2/D3. Deploying into C3 blocks it durably (PU at D3 cannot push C3 north while TR holds B3).
Action (open-info: B knowingly accepts A's C3 trap): deploy PL at C3 (D-Mo). Gate D and Mo. **A's C3 trap triggers**: PL 1→0, no lock, consumed. Constraint → D-Mo.
Objectives: B has 4 deployed (A3, B2, B3, C3) — not a square. Next (A) legal: 6. S8 ×1.
Live traps now: A{}, B{A3 (under UP), D2}.

### T9 — A
Constraint D-Mo. Legal (6): deploy TC → A4, C4, D1 (3); TP teleport → A4, C4, D1 (3); moves: none match; PU ability: PL at C3 matches D but B3 behind it is occupied; TW weave ✗ (F-St); recharge: none at 0.
Rationale: build C1/C2/D1/D2 (TW at C2). D1 keeps TP's block on A2 and TP's charge.
Action: deploy TC at D1 (D-St). Gate D. Trap: none. Constraint → D-St.
Objectives: A has 4 deployed (A2, C2, D1, D3) — no. Next (B) legal: 4. S9 ×1.

### T10 — B
Constraint D-St. Legal (4): no reserve; UP→A4, TR→B4 (2); recharge SW (B2 D-Su ✓), recharge PL (C3 D-Mo ✓) (2); UP ability: no charge-0 adjacent ally; PL ability: charge 0.
Threat: A needs C1 and D2. TP (charged) teleports to C1 on any W/Su constraint; PU walks D3→D2 on any W/Wa constraint. Recharging SW (→D-Su) loses: A teleports to C1, then every B reply hands over W or Wa. UP→A4 (→D-Wa) lets PU→D2 at once. TR→B4 (→W-St) lets either.
Action: recharge PL at C3. Budget B 3→2. PL 0→1. Constraint → D-Mo.
Next (A) legal: 4 (nothing progresses). S10 ×1.

### T11 — A
Constraint D-Mo. Legal (4): TP teleport → A4, C4 (2); TC ability (D1 D-St matches D) on C1 or D2 (2, deviation D1: single empty/enemy cell); moves: none; PU ability: B3 blocked; TW ✗; recharge: none.
Action: TC inspects D2. TC 1→0. **Finds and removes B's D2 trap** (private to A; B not notified). Constraint → D-St (actor's tile).
Next (B) legal: 3. S11 ×1. Live traps: A{}, B{A3}.

### T12 — B
Constraint D-St. Legal (3): UP→A4, TR→B4, recharge SW. PL ability: two-away targets are C1 (empty) and A3 (ally UP, blocked by TR at B3) → none.
All three options hand A progress (see T10). Recharge SW → D-Su loses by force (A: TP→C1, then B cannot avoid W/Wa). TR→B4 → W-St loses the same way. UP→A4 → D-Wa allows only PU→D2, after which B can still deny W/Su.
Action: move UP A3→A4 (D-Wa). Gate D. UP leaves B's own A3 trap live beneath an empty cell. Constraint → D-Wa.
Next (A) legal: 8. S12 ×1.

### T13 — A
Constraint D-Wa. Legal (8): moves TW→D2, TC→D2, PU→D2, PU→D4 (4); TP teleport → B1, D2, D4 (3); recharge TC on D1 D-St ✓ (1); PU ability: B3 blocked; TW ✗.
Action: move PU D3→D2 (W-Wa). Gate Wa. Trap: none (removed T11). Constraint → W-Wa.
Threat now: TP teleport to C1 on any W/Su constraint wins (C1/C2/D1/D2). Next (B) legal: 3. S13 ×1.

### T14 — B
Constraint W-Wa. Legal (3): SW→B1 (M-Wa), UP→B4 (W-St), TR→B4 (W-St). PL: C4/D3 ✗; recharge SW ✗; abilities none.
Both B4 moves hand over W and lose at once. **Effectively one legal non-losing action.**
Action: move SW B2→B1 (M-Wa). Gate Wa. Constraint → M-Wa.
Next (A) legal: 6. S14 ×1.

### T15 — A
Constraint M-Wa. Legal (6): TP→A3 (M-St, B trap), PU→D3 (2); TP teleport → A3, C4, D3, D4 (4); TW/TC/PU abilities ✗; recharge: none.
Every option either hands B a W/Su constraint (SW then blocks C1) or costs TP's charge; teleporting onto A3 would lock TP (charge spent first). Walking into A3 costs the charge only.
Action (open-info: A knows the A3 trap): move TP A2→A3 (M-St). Gate M. **B's A3 trap triggers**: TP 1→0, no lock, consumed. Constraint → M-St.
Next (B) legal: 5. S15 ×1. Live traps: none.

### T16 — B
Constraint M-St. Legal (5): UP→B4, TR→B4, PL→C4, PL→D3 (4); recharge SW (B1 M-Wa ✓) (1). Abilities: UP ✗ (D-Wa), TR ✗ (F-Mo), PL: TP at A3 matches St but B3 occupied; SW charge 0.
Action: recharge SW at B1. Budget B 2→1. SW 0→1. Constraint → M-Wa.
Next (A) legal: 2. S16 ×1.

### T17 — A
Constraint M-Wa. Legal (2): PU→D3 (M-Su); recharge TP (A3 M-St ✓). TP/TW/TC moves ✗; TC recharge ✗ (D-St); abilities ✗.
Action: recharge TP at A3. Budget A 3→2. TP 0→1. Constraint → M-St.
Next (B) legal: 4. S17 ×1.

### T18 — B
Constraint M-St. Legal (4): UP→B4, TR→B4, PL→C4, PL→D3. No recharge (all charged). SW swap: no adjacent fighter. PL pull: A3 blocked.
B4 moves give W (TP→C1 wins); PL→D3 gives Su (same). Only PL→C4 is safe. **One non-losing action.**
Action: move PL C3→C4 (M-Mo). Gate M. Constraint → M-Mo.
Next (A) legal: 6. S18 ×1.

### T19 — A
Constraint M-Mo. Legal (6): moves TP→A2 (W-Mo), TW→C3 (D-Mo), PU→D3 (M-Su) (3); TP teleport → A2, C3, D3 (3); PU/TW/TC abilities ✗; recharge TC ✗ (D-St).
Standoff: A wants a W/Su constraint on its own turn (TP→C1); B wants A to hand over W/Su so SW can take C1. Any W/Su-giving move lets SW block C1. TW→C3 is the only move that neither spends TP's charge nor gives W/Su, at the cost of leaving the C1/C2/D1/D2 shape (new target C2/C3/D2/D3).
Action: move TW C2→C3 (D-Mo). Gate Mo. Constraint → D-Mo.
Next (B) legal: 5. S19 ×1.

### T20 — B
Constraint D-Mo. Legal (5): SW→B2 (D-Su), TR→B2 (2); TR ability (B3 F-Mo matches Mo): trap at B2 or B4 (2); PL pull UP (A4 D-Wa matches D, B4 empty) into B4 (1). UP ability: no charge-0 ally adjacent. SW swap: none.
Every move or pull hands over Su or W. Trapper placement keeps the constraint.
Action: TR places a trap at B2 (secret). TR 1→0. Constraint unchanged D-Mo. Public: "B's Trapper activated".
Next (A) legal: 8. S20 ×1. Live traps: B{B2}.

### T21 — A
Constraint D-Mo. Legal (8): TP→A2 (1); TP teleport → A2, B2 (2); TW weave (C3 D-Mo ✓) with B3/C2/C4/D3 (4); recharge TC (D1 D-St ✓) (1). PU ability: TC at D1 matches D but push goes off-board; TC charge 0.
Recharge TC hands over D-St, under which every B action hands back W or Su (checked: SW→B2 Su, TR→B2 Su, TR→B4 W, UP→B4 W, PL→B4 W, PL pull UP W).
Action: recharge TC at D1. Budget A 2→1. TC 0→1. Constraint → D-St.
Next (B) legal: 6. S21 ×1.

### T22 — B
Constraint D-St. Legal (6): SW→B2, TR→B2, TR→B4, UP→B4, PL→B4 (5); PL pull UP into B4 (1). Recharge TR ✗ (F-Mo). UP ability: no target.
All six give W or Su, but A is no longer one move from a square (C2 is empty), so B picks the move that builds A3/A4/B3/B4.
Action: move PL C4→B4 (W-St). Gate St. Constraint → W-St.
Next (A) legal: 8. S22 ×1.

### T23 — A
Constraint W-St. Legal (8): moves TP→A2, TW→C2, TC→C1, PU→C2 (4); TP teleport → A2, C1, C2 (3); TC inspect C1 (1). PU ability: none valid.
Action: TP teleports A3→C2 (F-St). Gate St. TP 1→0. Trap: none. Constraint → F-St.
A now holds C2, C3, D1, D2; needs PU→D3 (M/Su) then TC→D2 (W/Wa). Next (B) legal: 4. S23 ×1.

### T24 — B
Constraint F-St. Legal (4): SW→A1 (F-Su), UP→A3 (M-St), TR→A3 (M-St) (3); recharge TR (B3 F-Mo ✓) (1). PL: C4 ✗; abilities ✗.
B holds A4, B3, B4; A3 is empty. TR→A3 makes three of A3/A4/B3/B4 with B3 the hole and SW two moves from it. It hands over M (PU→D3), judged acceptable because A then still needs W/Wa.
Action: move TR B3→A3 (M-St). Gate St. Trap: none (A3 trap consumed T15). Constraint → M-St.
Next (A) legal: 6. S24 ×1.

### T25 — A
Constraint M-St. Legal (6): TW→C4, TW→D3, PU→D3 (3); recharge TP (C2 F-St ✓) (1); TC inspect C1 (1); PU push TP north onto B2 (legal, self-harm) (1).
Action: move PU D2→D3 (M-Su). Gate M. Constraint → M-Su. A needs TC D1→D2 on W/Wa.
(Alternative recharge TP → F-St would have denied SW→B2 next turn; not chosen, flagged in findings.)
Next (B) legal: 5. S25 ×1.

### T26 — B
Constraint M-Su. Legal (5): SW→A1, SW→B2, SW→C1 (3); PL→C4 (1); recharge TR (A3 M-St ✓) (1). SW→C1 gives W and loses to TC→D2.
Action: move SW B1→B2 (D-Su). Gate Su. Own trap at B2: safe, stays live. Constraint → D-Su.
**Triple threat on B3**: SW walks in on F/Mo, PL (B4) pulls SW in on D/Su (B2's tile), SW swaps with any A blocker on that blocker's tile.
Next (A) legal: 9. S26 ×1.

### T27 — A
Constraint D-Su. Legal (9): TP→C1, TC→C1 (2); TW weave with B3/C2/C4/D3 (4); TC inspect C1, D2 (2); PU push TW north to B3 (1). TP teleport ✗ (charge 0); recharge ✗.
Check of every option: results in W-Su, W-Su, F-Mo, F-St, M-Mo, M-Su, D-St, D-St, F-Mo. Each contains F, Mo, D or Su, so SW walks or is pulled into B3; the push blocks B3 physically but sets F-Mo, under which SW swaps the blocker out. **No non-losing action exists** (open-information verdict).
Action: PU (D3) pushes TW (C3 D-Mo, matches D) north to B3. PU 1→0. Trap: none. Constraint → F-Mo (destination tile, which does not match D-Su — case 31 exercised).
Next (B) legal: 5. S27 ×1.

### T28 — B
Constraint F-Mo. Legal (5): SW→A2 (1); SW swap with TW at B3 (F-Mo ✓) or with TP at C2 (F-St ✓) (2); TR→A2 (1); PL→C4 (1).
Action: SW (B2, charge 1) swaps with TW (B3). SW 1→0. Positions: SW→B3, TW→B2. Traps: TW enters B2 → **B's B2 trap triggers**, TW 1→0, no lock, consumed; SW enters B3 → none. Constraint → F-Mo (actor's destination).
Objectives: **B occupies A3 (TR), A4 (UP), B3 (SW), B4 (PL) = square. A: no. B wins.**

## Outcome
**B wins by Square on action 28.** No blockade, no lock, no repetition occurred.

## Final referee state
Constraint F-Mo. A: TP C2(0), TW B2(0), TC D1(1), PU D3(0); budget 1. B: SW B3(0), UP A4(1), TR A3(0), PL B4(1); budget 1. Live traps: none. Terrain unchanged from fixture (no weave was activated).

## Phase A evidence
| Metric | Value |
|---|---|
| Actions | 28 (A 14, B 14) |
| Legal-action counts T1–T28 | 48, 24, 20, 14, 16, 10, 16, 10, 6, 4, 4, 3, 8, 3, 6, 5, 2, 4, 6, 5, 8, 6, 8, 4, 6, 5, 9, 5 |
| Median after deployment (T9–T28) | 5.5; turns with one non-losing option: T14, T18, T27 (none) |
| Deploys / moves / recharges / abilities | 8 / 11 / 4 / 5 |
| Abilities used | TC inspect (T11, hit), TR place (T20), TP teleport (T23), PU push (T27), SW swap (T28) |
| Never activated | TW weave, UP transfer, PL pull |
| Recharges spent | A 2 (TP, TC), B 2 (PL, SW); all four were tempo plays |
| Trap triggers | 4 (T2, T8, T15, T28): all charge loss, zero locks |
| Trap Checker | 1 inspection, 1 hit (D2) |
| Constraint handed over knowingly useful | T22 (forced), T24 (judged), T25 (misjudged) |

## Phase B — targeted edge cases

All positions use the fixture tiles. "Match" = from the match ledger; "Synthetic" = constructed, not necessarily reachable. Each entry: state → action → expected → walkthrough → result.

### Matching and ordinary actions
1. **Terrain-only match.** Match T12: constraint D-St, UP A3→A4 (D-Wa). Only D matches. Legal. **Pass.**
2. **Symbol-only match.** Match T7: constraint F-Mo, TP A1→A2 (W-Mo). Only Mo matches. Legal. **Pass.**
3. **Neither matches.** Match T13 state, proposed TP A2→A1 (F-Su) under D-Wa. Rejected at validation; no charge, budget or turn consumed; A chooses again. **Pass.**
4. **Diagonal move.** Synthetic: constraint W-Mo, PU at D3 proposes C2. Not orthogonal; rejected before matching is even checked. **Pass.**
5. **Source non-matching, destination matching.** Match T14: SW on B2 (D-Su) under W-Wa moves to B1 (M-Wa). Legal. **Pass.**
6. **No empty matching tile, but a recharge exists.** Synthetic: constraint D-St; D1 (A:TC charge 0), B2 (B:SW), C3 (B:PL), A3 (B:TR) — all four D/St tiles occupied; A's others on non-matching tiles with no matching empty neighbour; A has no reserve. Enumeration: deploys 0, moves 0, abilities 0, recharge TC on D1 ✓ (budget ≥1). Not a blockade; A must recharge. **Pass.**
7. **Matching empty cell, no reserve, unreachable.** Match T17: constraint M-Wa; C4, D4 empty and matching; A has no reserve; TP charge 0; no fighter adjacent to them. Deploy count 0; legal set was {PU→D3, recharge TP}. Enumeration did not assume deployment. **Pass.**
8. **Invalid ability target.** Match T9 state: PU (D3) proposes pushing PL (C3) north; B3 occupied. Rejected; PU keeps charge; turn not advanced. **Pass.**

### Charges and support
9. **Upgrader transfer.** Synthetic: constraint M-St; B:UP at A3 (1), B:SW at A2 (0, unlocked). UP activates: UP 1→0, SW 0→1; total B charge unchanged; constraint → A3 M-St; budget untouched. **Pass.**
10. **Upgrader illegal targets.** Same position: self ✗; TR at B3 with charge 1 ✗ (cap); PL at C3 (not adjacent) ✗; SW locked ✗. All rejected without cost. **Pass.**
11. **Shared recharge.** Match T10: budget 3→2, PL 0→1. Proposed recharge of a charge-1 fighter (T18, all charged): rejected. **Pass.**
12. **Charge 0 may move.** Match T14: SW (charge 0) moves B2→B1. Also T24: TR (0) moves B3→A3. **Pass.**

### Traps
13. **Own trap, own fighter.** Match T4 (UP deploys onto B's A3 trap) and T26 (SW moves onto B's B2 trap): no reveal, no consumption, no penalty. **Pass.**
14. **Enemy at charge 1.** Match T2, T8, T15, T28: trap consumed, charge → 0, no lock. **Pass.**
15. **Enemy at charge 0.** Synthetic: B's turn 30; B:PL pulls A:TC (charge 0) onto a B trap. Trap consumed; lock applied; owner A; triggered on opponent's turn → expires end of A's turn 31. Ledger entry "TC L until end of A-31". **Pass.**
16. **Teleporter onto enemy trap.** Synthetic: A's turn 30, constraint W-Su; A:TP (1) teleports to C1 holding a B trap. Charge spent first (1→0), then trap: charge already 0 → **lock**, expires end of A's turn 32 (D3). TP misses exactly A-32. **Pass** (and confirms the spec's harsher-than-walking note).
17. **Swap onto two hostile traps.** Synthetic: B:SW (1) at B3 standing on B's own dormant trap; A:PU (1) at C3 standing on A's own dormant trap; constraint D-Mo (C3 matches). SW activates (1→0), positions exchange, then both entries resolve: SW enters C3 → A's trap: charge 0 → lock (B's own turn, expires end of B's turn after next); PU enters B3 → B's trap: 1→0, no lock. Both traps consumed, then objectives checked. Order inside the pair did not matter. **Pass.** Note: this is the only way two traps fire in one action, and it needs both players to have stacked a trap under their own fighter.
18. **Overlapping traps.** Synthetic: A trap and B trap both at C1. A:TC enters C1 → only B's trap triggers and is removed; A's trap stays live and hidden. **Pass.**
19. **Push enemy onto your trap.** Synthetic: A:PU at B1, B:SW at B2 (D-Su matching), A trap at B3 empty. Push → SW enters B3 → A's trap triggers on SW. Constraint → B3 F-Mo. **Pass.**
20. **Locked fighter counts.** Synthetic: A holds C1, C2, D1; A:PU locked at D2. Square check reads positions only → A wins. **Pass.**
21. **Displacing a locked fighter.** Synthetic: B:PL pulls locked A:TC (D1→? two-away rule) — use PL at B1, TC locked at D1, C1 empty, D1 D-St matching: pull legal, TC moves to C1, lock persists. **Pass.**
22. **Trapper under ally.** Synthetic (T20 variant): TR at B3 places at B4 while B:PL stands there: legal, dormant, no trigger. **Pass.**
23. **Trapper illegal cells.** T20 state: A3 (enemy TP) ✗; C3 (enemy TW) ✗; a cell already holding a live B trap ✗. Rejected, no charge spent. **Pass.**
24. **Trapper keeps constraint, hides cell.** Match T20: constraint stayed D-Mo; public log records activation only. **Pass.**
25. **Trap Checker spares friendly traps (D1 rule).** Synthetic: A:TC at D1 selects C1 holding both an A trap and a B trap → B's removed, A's stays. Also: TC may not select D2 if A's own fighter stands there (ally-occupied cells excluded under D1). **Pass.**
26. **Trap Checker finds nothing.** Synthetic: T11 state, TC selects C1 (no trap): charge spent, action consumed, constraint → D-St; private result "none". **Pass.**
27. **Setup trap on the opening cell.** Synthetic: B trap at A1; A opens with TP at A1 → trap triggers on deployment, TP 1→0. Opening remains legal. **Pass.**
28. **Lock causes blockade.** Synthetic: A's turn; constraint M-Mo; A's fighters: TP at C4 (M-Mo, locked), TW at A1 (0), TC at D2 (0), PU at B4 (1); every empty M/Mo neighbour of TW/TC/PU absent; PU's adjacent fighters not on M/Mo tiles; recharge needs a charge-0 fighter on an M/Mo tile (none; TP is locked and charged). Legal set empty → **A loses immediately; no skip.** **Pass.** (Blockade is recorded as the terminal cause, with the lock as the proximate reason.)

### Displacement, protection, and terrain
29. **Push destination occupied or off-board.** Match T9 (B3 occupied) and T21 (TC at D1 pushed west, off-board): both rejected, no cost. **Pass.**
30. **Pull with occupied intervening cell.** Match T18: PL at C3 targeting TP at A3 (matching St) with TR on B3: rejected. **Pass.**
31. **Target matches, destination does not.** Match T27: TW on C3 (D-Mo, matches D) pushed to B3 (F-Mo, no D/Su). Legal; constraint became F-Mo. **Pass.** This non-matching hand-over is what enabled B's winning swap.
32. **Anchor blocks enemy displacement.** Synthetic: A:Anchor at C2 (F-St, constraint matches) protects A:TC at D2 (end of B's next turn). B:SW adjacent at D3 proposes swap with TC (W-Wa matching): rejected, SW keeps charge. B:PL at B2 proposes pulling TC into C2 — C2 occupied anyway; variant with C2 empty: rejected. **Pass.**
33. **Anchor allows allied displacement and traps.** Same: A:PU at D1 pushes protected TC east to D3 (if empty, matching): legal; TC enters a B trap at D3 → triggers normally. **Pass.**
34. **Anchor expiry.** Anchor used on A's turn 30 → protection expires at step 8 of B's turn 31. On A's turn 32 the target is unprotected, so Anchor could re-target it; the "already protected" clause never fires (D2). **Pass**, with the dead clause noted.
35. **Terrain Weaver moves attributes only.** Synthetic: A:TW at C3 (D-Mo, constraint D-St) exchanges with B3 holding B:TR and a hidden B trap. After: C3 = F-Mo, B3 = D-Mo; TR still at B3; trap still at B3. **Pass.**
36. **No trigger beneath a stationary fighter.** Same case: TR is B's own; variant with A:TP standing on B3 over a B trap is impossible (entry would have fired it). Rule holds vacuously for live enemy traps; for the owner's own trap nothing fires. **Pass** (see finding F8).
37. **Weaver constraint.** Same case: constraint → the new pair beneath TW = F-Mo, not the old D-Mo and not the stored D-St. **Pass.**

### Endings and repetition
38. **Acting player completes own square.** Match T28: immediate win, no final-response turn. **Pass.**
39. **Displacement completes only the opponent's square.** Synthetic: A holds A1, A2, B1; A:PU stands at B3; B:SW at B2 with constraint matching B3 (F-Mo). SW swaps with PU: PU enters B2, SW enters B3. A now holds A1/A2/B1/B2 → **A wins on B's action.** **Pass.**
40. **Simultaneous completion → draw.** Synthetic, not claimed reachable: A holds A1, A2, B1 and a stray at B3; B holds B4, C3, C4 and SW at B2; constraint matches B3 (F-Mo). SW swaps with the stray: A gets A1/A2/B1/B2, B gets B3/B4/C3/C4. Both squares satisfied after the single action → **draw.** **Pass (synthetic).**
41. **Objective plus next-player blockade.** Synthetic: case 40 variant where only B completes and A would have no legal action afterwards: step 7 ends the game with B's win before step 10 runs. **Pass.**
42. **Both players blockaded.** Synthetic: case 28 state where B also has no legal action: only the active player (A) is checked and loses; B's situation never evaluated. **Pass.**
43. **Same positions, different hidden state.** Match: S10 (D-Mo, PL charge 1, budget 2) vs. the S8 position (D-Mo, PL charge 0, budget 3, D2 trap live): same fighter cells, different signature; also S16 vs S14 differ by SW charge and budget. Not repetitions. **Pass.**
44. **Third occurrence → draw.** Synthetic cycle: A's fighter shuttles C4 (M-Mo) ⇄ C3 (D-Mo) and B's shuttles A2 (W-Mo) ⇄ B3 (F-Mo); every hop matches Mo, so the constraint always carries Mo and nothing else changes (no charges, traps or budgets). The start-of-turn state X recurs at actions n, n+4, n+8 → draw on the third registration, provided no objective or blockade fired first. Four actions is the shortest possible period. **Pass (synthetic).**
45. **Duration normalisation.** Synthetic: lock on A:TP triggered on B's turn 9 (expires end A-10) and a lock triggered on A's turn 20 by teleport (expires end A-22). At the start of A-10 the first has "this turn" remaining; at the start of A-22 the second also has "this turn" remaining → equal in the signature. At the start of B-21 the second shows "owner's next turn" remaining, which differs. **Pass.**

Summary: 45/45 walkthroughs consistent with the specification plus D1–D3. No case was blocked. Cases 15–17, 21, 28, 32–37, 39–42, 44–45 are synthetic.

## Rule contradictions or ambiguities
No contradiction stopped play. Items below are observations, not repairs.

- **R1 Trap Checker (D1).** The single-cell rule worked cleanly. The spec text (§9, §13) still describes all-adjacent inspection and needs updating by the owner.
- **R2 Anchor dead clause (D2).** "Already protected target is illegal" is unreachable under the one-opponent-turn duration.
- **R3 Near-pass actions.** Recharge (T10, T16, T17, T21), Trapper placement (T20) and Trap Checker inspection (T11) all let a player act without changing the position, and recharge changes the constraint only to the actor's own tile. The spec says there is no pass, but these functioned as paid passes. Not an ambiguity, but worth a design decision.
- **R4 Puller on allies.** Pulling an ally is "friendly displacement" and is legal; it moves an ally one cell using the *ally's* tile as the gate, which is independent of the destination tile. This gave B a second entry mode into B3 at T26. Confirm this is intended.
- **R5 Push hand-over.** A push sets the constraint from a destination that need not match (§9 Pusher). At T27 that handed B exactly the tile its Swapper needed. The rule is clear; the interaction is sharp.
- **R6 Hidden trap removal.** Under D1 and the no-notify rule, B never learned its D2 trap was gone. Fine for open play; a hidden test must track "owner belief" separately as paper-simulation.md §4 says.

## Observed tactical interactions
- **F1 Three-plus-one squares are near-unstoppable.** With three fighters in a square, the hole can be entered by walking (hole's two attributes), by a Puller pulling the fourth fighter (the fourth's tile attributes), or by a Swapper swapping with a blocker (the blocker's tile attributes). At T26 B covered F, Mo, D, Su and any blocker's tile; every one of A's nine actions lost. The constraint gate stops a single entry mode, not a multi-mode threat.
- **F2 Blockers decide the midgame.** Occupying a hole (T7 TP→A2, T8 PL→C3) was the strongest defensive move both times, and only displacement abilities can undo it. A's roster had one displacer (Pusher, geometry-limited); B's had two (Swapper, Puller). This asymmetry, not trap play, decided the game.
- **F3 Constraint standoff.** From T14 to T22 both players mostly chose moves to *avoid* handing over an attribute. Players spent four recharges and one Trapper charge purely for tempo. Turns with one non-losing option: T14, T18; zero: T27.
- **F4 Traps were mild.** Four triggers, all charge-loss, no lock; none affected an objective. Two of the three stepped-on traps were entered knowingly in open play, so no inference about deduction versus guessing is possible.
- **F5 Options collapse after deployment.** Legal counts fell from 10–24 during deployment to a median of 5.5 afterwards, with several turns at 2–4.
- **F6 Teleporter paid twice.** TP lost its charge to a trap (T15), needed a recharge (T17), and then its one teleport (T23) did not create a threat before B's square closed.
- **F7 Unused tools.** Terrain Weaver, Upgrader and Puller never activated; Upgrader never had an adjacent uncharged ally when it had a charge.
- **F8 Trap geometry.** An enemy trap can never lie beneath your own fighter, so Trap Checker's own-cell exclusion and case 36 are vacuous. Only self-stacked traps (Trapper under ally, or standing on a setup trap) produce the Swapper double-trigger of case 17.

## Balance concerns (with turn references)
- B1 Displacement count per roster (F2, T26–T28). Suggest testing rosters with equal displacer counts.
- B2 Multi-mode completion threats (F1, T26). Consider whether a hole adjacent to a Puller/Swapper should be answerable at all.
- B3 Paid-pass actions (R3, T10–T21) stretch the game into tempo play; three recharges per player were nearly exhausted by T21.
- B4 Trap effect vs. objective (F4). Traps never interact with Square; charge loss was rarely decisive.
- B5 Low branching after deployment (F5), including two forced turns.

## Untested interactions and confidence limits
Single open-information game with the referee playing both sides. Anchor only synthetic. No lock ever occurred in play, so lock timing (D3) is validated only by walkthrough. No repetition reached. Hidden-information behaviour (bluffing, trap deduction, Trap Checker value when traps are unknown) untested. The T8 and T15 trap entries were open-information choices and say nothing about hidden play. Starter advantage untested (one game, A started, A lost).

## Recommended changes (not applied)
1. Update §9 Trap Checker text to the single-cell rule (D1) and remove the own-cell clause.
2. Decide whether Anchor should protect through the owner's following turn as well, or delete the "already protected" clause.
3. Decide on Puller targeting allies (R4) and on push hand-over (R5); both are rule-consistent but produce the F1 pattern.
4. Consider making a trap on a square cell matter to the objective (e.g. a locked fighter does not count while locked), or accept traps as a charge tax.
5. Re-run with starters swapped and rosters balanced for displacers before changing any numeric default.

## Next test
Same fixture, B starts, rosters swapped between players; then a shuffled board. Then Phase C with two isolated player agents.
