# F5/F6 Wave 1 — Visible Projects + Agent-Tree Shell

**Worker:** Worker C — Visible T3 Experience  
**Worktree:** `/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f5-command-center`  
**Branch:** `macbrains/f5-command-center`  
**Date:** 2026-07-31

## Delivered

1. **Projects home shell** — sections: needs attention, active, ready for review, ready to use, node activity.
2. **Lane workspace shell** — task, source truth, plan, director, workers/agent tree, worktree, changed files, checks, review, deliverable.
3. **Agent controls** — steer / queue / pause / resume / stop / replace / review / open-result via replaceable adapter.
4. **Replaceable mock adapter** over real contract types (`WorkLaneShell`, `WorkLane`, branded IDs, `OrchestrationProjectShell` fields). No second domain model.

## Ownership boundaries respected

- Did **not** edit application navigation root (`apps/web/src/routes/_chat.index.tsx` etc.).
- Did **not** edit contracts public barrel (`packages/contracts/src/index.ts`).
- Did **not** edit primary `main`.
- New modules live under:
  - `packages/client-runtime/src/commandCenter/`
  - `apps/web/src/components/commandCenter/`

## Adapter rule

- Wave 1: `createMockCommandCenterAdapter()` is allowed for local shell inspection.
- Wave 2 acceptance: mock static seed is **not** evidence. Live projection adapter required.

## Validation

- Focused tests authored:
  - `packages/client-runtime/src/commandCenter/classify.test.ts`
  - `packages/client-runtime/src/commandCenter/mockAdapter.test.ts`
  - `apps/web/src/components/commandCenter/CommandCenterShell.test.ts`
- Test execution on this host: **BLOCKED** by `FABLE_ADMIT klass=XL verdict=WAIT` (swap ≥ 85%). No `pnpm install` / `vp test` run.

## Integration request

See `docs/macbrains/receipts/F5_INTEGRATION_REQUEST.md`.
