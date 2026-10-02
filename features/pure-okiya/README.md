# pure-okiya

The sixth feature: Constraint becomes Okiya's rules (`docs/game-spec.md` v1.0). Players take a tile matching the last tile and place a token, and win by a line, a square or a blockade. The game is played on the tabletop interface against an Easy, Normal or perfect Hard bot.

- `bot` owns `packages/bot/src`: the three strengths behind `chooseTake`.
- `web` owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`: the client on `@okiya/game`, with the fighter game removed.

The engine `@okiya/game` and the thin bot were put on the base first. A review sidecar reviews the lanes every five minutes. After the merge, a cleanup deletes the old packages.

Launch from its own checkout: `workflow launch pure-okiya --repo ~/dev/okiya-pure --dry-run`, then `--live --automatic`.
