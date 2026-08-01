# MacBrains Family Ownership — Wave 0 baseline

**Authority:** Nayte family execution board (2026-07-31).  
**Integrator worktree:** `/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-integrator-wave0`  
**Canonical integration branch:** `macbrains/integration` @ `57b800cd3b889c33a0973c6f7ce9c6ea8698fb72`  
**Evidence class:** paths/SHAs below are **PROVEN** on-disk at Wave 0 closeout; product behavior remains **UNMEASURED** until Wave 2 demo.

## Milestone (Wave 2 acceptance target)

> A visible director in T3 spawning one real worker, controlling it, sending the result to one real verifier, and being prevented from claiming completion until the evidence is valid.

Until that demo works, do not call the new workflow usable.

## Active lanes (Wave 0 / Wave 1)

| Role | Package | Branch | Worktree | May edit |
|---|---|---|---|---|
| Campaign Integrator | Wave 0 control + shared merges | `macbrains/integrator-wave0` → merges into `macbrains/integration` | `.../t3code-macbrains-integrator-wave0` | campaign docs, ownership, merge integration only |
| Integration tip (read/merge) | — | `macbrains/integration` | `.../t3code-macbrains-integration` | Integrator only |
| Worker A — Truth Gate | **F2** | `macbrains/f2-completion-gate` | `.../t3code-macbrains-f2-completion-gate` | completion-gate modules + focused F2 tests |
| Worker B — Director runtime | **F3** (+ needed P0 spawn wiring) | `macbrains/f3-agent-topology` | `.../t3code-macbrains-f3-agent-topology` | assignment/topology + provider spawn modules |
| Worker C — Visible T3 | **F5** + first useful **F6** | `macbrains/f5-command-center` | `.../t3code-macbrains-f5-command-center` | Projects/lane/agent-tree UI + replaceable mock adapters |
| Recovery parking (do not edit for features) | G0 WIP preserve | `macbrains/recovery-g0-auth-wip-20260731` @ `60f10ada6` | `.../t3code-macbrains-recovery-g0-auth-wip` | none — parked only |

Primary checkout `/Users/nayte/Projects/t3code` on `main` is **off-limits** for family implementation. It currently carries unrelated dirty work — do not absorb it.

## Shared-file rule (Integrator only casually)

Workers must **not** casually edit:

- central contract exports (`packages/contracts` public barrels);
- RPC-group registration;
- migration registration;
- server-layer assembly;
- `docs/macbrains/CAMPAIGN_MANIFEST.json`;
- `docs/macbrains/ACCEPTANCE_MATRIX.md` evidence links (workers propose; Integrator lands);
- application navigation root.

Workers own **new focused modules** and file an explicit integration request to the Integrator.

## Dependency note (board override)

Manifest historically lists `F2` depending on `F1`. The family board starts **F2 / F3 / F5** now for the visible vertical slice. Workers must not invent a second domain model; UI mocks must be replaceable adapters over the same contracts. If F1 substrate is missing for a F2 type, Worker A adds the minimal typed evidence surface inside F2 ownership and requests Integrator merge — do not stall Wave 1 on a full F1 campaign.

## Toolchain pins

- Node: **24.13.1** (`.nvmrc`); engines `^24.13.1`. Activate with `nvm use` before install/test.
- Commit hooks: `core.hooksPath=.vite-hooks/_` repaired via `vp config --no-agent` in each family worktree. `pnpm install` / `prepare` still required before `vp staged` can run in that worktree (**blocked while Mac XL RAM admit is WAIT**).
- No Python for ANVIL/node implementation.
- No hidden subagents; no shared worktrees between active editors.

## Required closeout report (every worker)

```text
PROVEN
MISSING EVIDENCE
FILES CHANGED
TESTS RUN
RECEIPTS AND ARTIFACTS
POSSIBLY WRONG OR OVERSTATED
EXACT NEXT ACTION
INTEGRATION REQUIREMENTS
```

Every `PROVEN` claim must identify exact commit and test environment.

## Worker launch packets

### Worker A — F2 Truth Gate

**Worktree:** `t3code-macbrains-f2-completion-gate`  
**Demo:** completion rejected while criterion pending → tests/evidence + verifier accept → completion succeeds.  
**Do not:** mark complete from agent narrative; edit shared barrels without Integrator.

### Worker B — F3 Director / worker runtime

**Worktree:** `t3code-macbrains-f3-agent-topology`  
**Demo:** one real director provider session spawns one real worker in the lane worktree; result returns; survives reconnect.  
**Do not:** simulated workers or state-only transitions.

### Worker C — F5/F6 Visible surfaces

**Worktree:** `t3code-macbrains-f5-command-center`  
**Demo:** Projects home + lane screen + agent tree + steer/pause/replace/review controls bound to replaceable adapters (later real F2/F3).  
**Do not:** fake static demo data for acceptance; second domain model in the mock layer.

## Integrator merge order (Wave 2)

1. F3 assignment/spawn contracts (minimal).
2. F2 completion gate.
3. F5/F6 visible shell wired to real projections.
4. Combined vertical-slice demo on `macbrains/integration`.
