# Wave 0 Integrator Receipt

**Agent:** Cursor (Campaign Integrator)  
**Task:** `macbrains-family-wave0-2026-07-31`  
**Date:** 2026-07-31

## PROVEN

1. **Baseline recoverable** — `57b800cd3b889c33a0973c6f7ce9c6ea8698fb72` exists; message `feat(orchestration): add workflow lanes and source-truth integration`.
2. **Tracking corrected** — legacy branch `codex/t3code-workflow-integration-20260730` now tracks `origin/macbrains/integration` (was mismatched to `origin/cursor/f0-worklane-source-truth-7986`).
3. **Canonical integration branch** — `macbrains/integration` @ `57b800cd3` pushed to `origin`.
4. **Family branches + worktrees** created and pushed:
   - `macbrains/integrator-wave0` → `.../t3code-macbrains-integrator-wave0`
   - `macbrains/f2-completion-gate` → `.../t3code-macbrains-f2-completion-gate`
   - `macbrains/f3-agent-topology` → `.../t3code-macbrains-f3-agent-topology`
   - `macbrains/f5-command-center` → `.../t3code-macbrains-f5-command-center`
5. **Unowned dirty WIP preserved** — GitHub auth text-parse edits parked on `macbrains/recovery-g0-auth-wip-20260731` @ `60f10ada6` (not merged into integration).
6. **Primary `main` left untouched** — dirty files in `/Users/nayte/Projects/t3code` were not absorbed.

## ESTIMATED / PARTIAL

1. **Node 24** — machine has Homebrew `node@24` **v24.18.1** and `~/.vite-plus/js_runtime/node/24.18.1`, which satisfy `package.json` engines `^24.13.1`. Exact pin `24.13.1` via nvm not installed this session.
2. **vite-plus hooks** — `core.hooksPath=.vite-hooks/_` is present and hook scripts exist. Commit failure root cause was missing `node_modules` / unresolved `vite-plus` in the editing worktree, not missing hook installation.

## BLOCKED

1. **`pnpm install` / full hook verification** — `FABLE_ADMIT klass=XL verdict=WAIT` at 2026-07-31 (~swap 89%, P=2). Heavy install deferred until ADMIT.
2. Exact `nvm install 24.13.1` deferred for the same admit gate.

## Node establishment recipe (when ADMIT)

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"   # v24.18.1 today
# optional exact pin:
# nvm install 24.13.1 && nvm use 24.13.1
cd /Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-integrator-wave0
pnpm install
pnpm prepare   # effect-tsgo patch && vp config --no-agent
# prove: echo 'test' >/dev/null; git commit should run `vp staged` successfully on a real staged change
```

## Ownership published

- `docs/macbrains/FAMILY_EXECUTION_BOARD.md`
- `docs/macbrains/FAMILY_OWNERSHIP.md`
- `.nvmrc` → `24.13.1`
