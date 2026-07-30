# F0 Verifier Receipt

- Verifier: independent F0 read-only verification (cloud subagent)
- Worktree: `/workspace/.worktrees/f0-worklane-source-truth`
- Branch: `cursor/f0-worklane-source-truth-7986`
- HEAD (committed): `1e03d7198ae186c48dc065e3c9dcdeaa90003086`
- Base: `origin/macbrains/agent-workflow-overhaul` @ same SHA (empty committed diff)
- F0 implementation: **uncommitted working tree** (modified + untracked); not yet committed
- Recorded: 2026-07-30
- PR: **none opened** (task contract / `pullRequestRequiresTaskAuthorization`; verifier must not open one)

## VERDICT: PASS_WITH_GAPS

Foundation contracts, decider gates, in-memory projection replay, migration 035, shell decode/reducer, and focused tests are coherent and green. Several F0-scoped acceptance rows remain only partially proven (schema/scaffolding or command-level only) versus the matrix’s stronger required proof (real Git, restart, UI, SQL rebuild).

## Source truth refresh

| Check | Result |
|---|---|
| `git status` | Clean vs remote tip; large unstaged/untracked F0 diff |
| HEAD | `1e03d719` — `docs: finalize durable implementation handoff` |
| `diff --stat origin/macbrains/agent-workflow-overhaul...HEAD` | empty (all F0 work is working-tree only) |
| Working tree vs HEAD | ~41 modified + 17 untracked (contracts, decider, projector, 035, client-runtime, docs) |

### Key files inspected

- `packages/contracts/src/workLane.ts`, `sourceTruth.ts`
- `apps/server/src/orchestration/decider.ts`, `workLaneTransitions.ts`, `commandInvariants.ts`
- `apps/server/src/orchestration/projector.ts`
- `apps/server/src/orchestration/Layers/ProjectionPipeline.ts` (workLanes projector)
- `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts` (lane shell/detail)
- `apps/server/src/persistence/Migrations/035_WorkLanesAndSourceTruth.ts` (+ test)
- `packages/client-runtime/src/state/shellReducer.ts`, `workLanes.ts`
- Tests: `workLane.test.ts`, `decider.workLane.test.ts`, `projector.workLane.test.ts`, `035_*.test.ts`, `shellReducer.test.ts`

## Confirmations (item 5–6)

| Claim | Status | Evidence |
|---|---|---|
| No false historical completion in migration | **CONFIRMED** | Import always `completedAt: null`; idle→queued, active→recovery-required, archived→queued; test asserts zero completed rows; idempotent re-run |
| `completion.request` rejected | **CONFIRMED** | Decider always fails with `completion gate reserved until F2`; multi-state test |
| Substantial needs worktree | **CONFIRMED** | `execution.start` refuses substantial + null worktree; bounded-readonly allowed with source-truth |
| Exclusive ownership | **CONFIRMED** | `requireWorktreeExclusive` on `execution.start`; second lane same path rejected |
| Shell compact | **CONFIRMED** | `WorkLaneShell` / `toWorkLaneShell` omit `taskContract`; projector + contract tests; shell summary only |
| No PR | **CONFIRMED** | Verifier did not open a PR; campaign requires task authorization |

## FINDINGS

### Must-fix

**None found.** No clear F0-scope code bugs requiring a fix before this receipt. Focused suite is green. Gaps below are incomplete acceptance proof or deferred enforcement, not broken implementations of the confirmed gates.

### Accepted gaps (not must-fix in this pass)

1. **A01–A06 largely scaffolding:** `SourceTruthRevision` carries the fields; execution only requires a revision **id** (+ worktree for substantial). No completeness gate for root/branch/HEAD/dirty/remotes/ops/instructions/manifests/tests/ownership; no real-worktree preflight receipt; `activeGitOperation` / `unknownsThatChangeAction` / conflict events do not block transitions; no generated/vendored ownership enforcement; remotes only via optional `RepositoryIdentity`, not a dedicated remotes list.
2. **Read model does not retain revision bodies** — only `lane.sourceTruthRevisionId`. Stronger A04/A06 gates need revision storage on the read model or equivalent (larger than a one-line fix).
3. **B01** structural lane aggregate + migration independence proven; **restart / provider-replacement** test missing.
4. **B07** block/unblock tested; **cancel / supersede / recovery.request** implemented in decider but **not covered** by `decider.workLane.test.ts`; UI controls out of F0.
5. **C01** F0 portion is “refuse substantial execution without worktree path”; **does not create/attach** isolated worktrees (F4 / real Git).
6. **P05** in-memory projector double-replay determinism proven; **SQL ProjectionPipeline wipe/rebuild-from-events** for work lanes not tested. Migration also dual-writes projection rows (event + projection insert) — fine for bootstrap, not a full rebuild proof.
7. **Exclusive ownership checked only at `execution.start`**, not at create/meta-update — two non-terminal lanes can share a path until execute (acceptable for F0; fuller ownership is F4).
8. **Campaign/ledger status `IMPLEMENTED`** while acceptance matrix rows remain `NOT_STARTED` — correct until evidence is linked; do not treat as `PROVEN`.
9. **All F0 code is uncommitted** — verifier evaluated the working tree; a later commit must re-run focused tests before package handoff claims final SHA.

## ACCEPTANCE ROWS PROVEN

Proven here means **F0 foundation proof via current focused tests/source**, not full matrix required-proof where that proof is UI/e2e/real-Git.

| Row | Proven slice |
|---|---|
| **B02** | Documented transition matrix + disallowed jumps; decider uses matrix; happy-path + negative transition tests |
| **B03** | Substantial without worktree refused; missing source-truth revision refused before execution |
| **B04** | `lane.completion.request` always rejected (F2 gate); cannot complete via that command |
| **B05** | `completion.invalidate` from constructed `completed` → `recovery-required` |
| **B06** | Migration fixtures: never completed; idle/active/archived mapping; idempotent |
| **B07** (partial) | block/unblock + resumeState restore |
| **C01** (F0 portion) | Substantial execution requires worktree path |
| **C03** (F0 portion) | Second worktree-owning lane cannot `execution.start` on same path |
| **A03** (partial) | Preflight record + supersession updates `sourceTruthRevisionId` / `previousRevisionId` |
| **P05** (partial) | In-memory projector replay of lane events is deterministic |

Also covered (supporting, not matrix IDs): contract roundtrip/invalid decode; shell default `lanes: []`; shellReducer lane-upserted/removed; compact shell shape.

## ACCEPTANCE ROWS STILL MISSING

| Row | Missing for F0 / matrix |
|---|---|
| **A01** | Real preflight receipt from exact worktree; completeness of recorded authorities before edits |
| **A02** | Conflict vs narrative authority that **blocks** unsafe transition |
| **A03** | UI revision history; actual refresh producer (request event only) |
| **A04** | Temp-repo integration; decider block on active merge/rebase/cherry-pick/bisect/revert |
| **A05** | Generated/vendored boundary respect beyond schema roles |
| **A06** | Unknowns→typed blockers; irrelevant unknowns do not halt (decider behavior) |
| **B01** | Restart + provider replacement persistence test |
| **B07** | Cancel/supersede/recovery command tests; UI controls |
| **C01** | Real Git create/attach isolated worktree by default |
| **P05** | SQL projection rebuild-from-canonical-events for work lanes |

UI / e2e / provider-adapter / completion-gate rows outside F0 remain out of scope (do not mark proven from this scaffolding).

## COMMAND RECEIPTS

```text
$ git status
  On branch cursor/f0-worklane-source-truth-7986
  up to date with origin/macbrains/agent-workflow-overhaul
  modified: 41 files (unstaged); untracked: F0 implementation + receipts

$ git rev-parse HEAD
  1e03d7198ae186c48dc065e3c9dcdeaa90003086

$ git diff --stat origin/macbrains/agent-workflow-overhaul...HEAD
  (empty)

$ git diff --stat HEAD
  41 files changed, 2291 insertions(+), 87 deletions(-)
  (+ untracked: workLane/sourceTruth, 035 migration, decider/projector tests, workLanes.ts, …)

$ export PATH="$HOME/.nvm/versions/node/v24.18.1/bin:$HOME/.local/bin:$PATH"
$ cd /workspace/.worktrees/f0-worklane-source-truth
$ npx vitest run \
    packages/contracts/src/workLane.test.ts \
    apps/server/src/orchestration/decider.workLane.test.ts \
    apps/server/src/orchestration/projector.workLane.test.ts \
    apps/server/src/persistence/Migrations/035_WorkLanesAndSourceTruth.test.ts \
    packages/client-runtime/src/state/shellReducer.test.ts \
    --config vite.config.ts
  Test Files  5 passed (5)
  Tests       33 passed (33)
  Duration    ~1.21s
  EXIT 0
```

## Fixes applied

**None.** No must-fix F0 bugs identified; no code changes by verifier. Receipt only.

## Next safe action

1. Commit F0 working tree with conventional message after any owner polish.
2. Optionally add focused tests for cancel/supersede/recovery and/or SQL rebuild (closes B07/P05 gaps without UI).
3. Leave A01–A06 enforcement that needs revision bodies / real Git for follow-on packages (F4 / preflight reactor), or expand read model deliberately before claiming those rows PROVEN.
4. Do **not** open a PR unless explicitly authorized.
5. Do **not** set acceptance matrix rows to PROVEN until evidence links point at the final commit SHA.
