# Wave 0 — Establish control (receipt)

**Agent:** Cursor (Campaign Integrator)  
**Task:** `macbrains-family-wave0-2026-07-31`  
**Date:** 2026-07-31

## PROVEN

| Item | Evidence |
|---|---|
| Baseline `57b800cd3` present and checked out on family tips | `git rev-parse` on integration/f2/f3/f5/integrator worktrees = `57b800cd3b889c33a0973c6f7ce9c6ea8698fb72` |
| Canonical branch `macbrains/integration` exists locally + remotely | `origin/macbrains/integration` @ `57b800cd3` |
| Mismatched tracking corrected | `codex/t3code-workflow-integration-20260730` now tracks `origin/macbrains/integration` (was `origin/cursor/f0-worklane-source-truth-7986`) |
| Unowned sourceControl WIP preserved (not in integration) | `macbrains/recovery-g0-auth-wip-20260731` @ `60f10ada6` |
| Family worktrees created | see `FAMILY_OWNERSHIP.md` paths under `/Users/nayte/Projects/ANE-Lab/worktrees/` |
| Node **24.13.1** installed via nvm | `nvm use 24.13.1` → `v24.13.1`; `.nvmrc` added |
| vite-plus hook runner directories installed | each family worktree has `.vite-hooks/_` + `core.hooksPath=.vite-hooks/_` via `vp config --no-agent` |

## MISSING EVIDENCE / BLOCKED

| Item | Status |
|---|---|
| Full `pnpm install` + hook smoke (`vp staged` on real commit in worktree) | **BLOCKED** — Mac XL RAM admit WAIT (`swap 88.19%`, P=2 warn) at 2026-07-31 22:04:51 |
| Wave 2 visible director demo | not started |
| Primary `main` dirty tree cleanup | intentionally untouched (unowned) |

## POSSIBLY WRONG OR OVERSTATED

- Hook **wiring** is repaired; hook **execution** against staged files is not yet proven in these worktrees without `node_modules`.
- `macbrains/integration` was already present on origin at `57b800cd3` (“Everything up-to-date”); Wave 0 made it the canonical tracked tip and attached family branches.

## EXACT NEXT ACTION

1. When RAM admit returns ADMIT: `nvm use 24.13.1 && pnpm install` in integrator + worker worktrees; smoke one commit through `vp staged`.
2. Launch Workers A/B/C in their worktrees per `FAMILY_OWNERSHIP.md`.
3. Integrator merges only via explicit integration requests.
