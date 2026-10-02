# tabletop-ui

The fifth feature: a presentation rewrite that makes Constraint look and play like a finished tabletop game (`docs/prd.md` §5.9). The board is the whole interface, with a piece tray, actions on the tokens, a minimal top bar, event toasts and illustrated tiles, and every developer panel removed.

- `web` owns `apps/web/src`, `apps/web/index.html` and `tests/e2e`. One lane: only the client changes.

A review sidecar reviews the lane every five minutes.

Launch: `workflow launch tabletop-ui --dry-run`, then `--live --automatic` (see the operator notes in `CLAUDE.md`).
