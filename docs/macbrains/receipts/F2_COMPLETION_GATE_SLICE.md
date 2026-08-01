# F2 Completion Gate — Worker A slice receipt

**Agent:** WorkerA-TruthGate  
**Worktree:** `/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f2-completion-gate`  
**Branch:** `macbrains/f2-completion-gate`  
**Base HEAD at start:** `4d1c3798ee41966ce55e93aa73da2d1053623943`  
**Date:** 2026-07-31  
**Evidence class:** implementation authored; focused tests **not executed** (Mac XL RAM admit WAIT)

## Objective

Make `lane.completion.request` fail unless criteria / checks / verifier / deliverable / UI / completion-report evidence permit it. Required demo: pending criterion rejects → evidence + verifier accept → completion succeeds.

## What landed (this slice)

1. **Contracts (subpath, not root barrel):** `packages/contracts/src/completionGate.ts`
   - Canonical `CheckStatus` vocabulary (H01)
   - `LaneCheck`, `VerifierDecision`, `UiAcceptanceStatus`, `CompletionReportEvidence`, `LaneCompletionEvidence`
   - Package export: `@t3tools/contracts/completionGate`

2. **Pure gate:** `apps/server/src/orchestration/completionGate.ts`
   - `evaluateCompletionGate` — fail-closed reasons for pending/failed criteria, blocking checks, blockers, absent/pending/rejected verifier, missing UI proof when required, missing/empty completion report fields

3. **Decider wiring:** `lane.completion.request` calls the gate after structural preconditions (state/plan/source-truth/deliverable)

4. **Read model substrate:** optional `acceptanceCriteria` / `laneChecks` / `laneCompletionEvidence` on `OrchestrationReadModel`; in-memory projector merges create/import criteria; `ProjectionSnapshotQuery.getCommandReadModel` currently returns empty F2 arrays (fail closed until Integrator populates)

5. **Focused tests authored:**
   - `packages/contracts/src/completionGate.test.ts` (H01 vocabulary)
   - `apps/server/src/orchestration/completionGate.test.ts` (reject → accept demo + blockers/checks)
   - `apps/server/src/orchestration/decider.workLane.test.ts` — deliverable-only now rejected; reject-then-accept through decider

## RAM / test environment

```text
FABLE_ADMIT klass=XL verdict=WAIT why=swap>=85% P=2(warn)
```

No `pnpm install` / `vp test` / heavy build was started. Claims about test *pass* are therefore **UNMEASURED**.

## Integration request (Integrator)

1. Optionally promote `@t3tools/contracts/completionGate` into the root barrel when other packages need it.
2. Populate `getCommandReadModel` from projection tables:
   - acceptance criteria (repository already exists)
   - lane checks (needs persistence once check commands land)
   - lane completion evidence (verifier/UI/report) once F1 receipt store or F2 evidence commands exist
3. Do **not** mark `CAMPAIGN_MANIFEST` F2 `PROVEN` until independent verifier + executed tests on an ADMIT host.
4. Merge order remains: F3 minimal → F2 gate → F5/F6 shell (per FAMILY_OWNERSHIP).

## Demo script (unit / decider fixtures)

```text
Completion request with required criterion status=pending
→ OrchestrationCommandInvariantError … pending

Criterion satisfied + required check passed + verifier accepted + report (+ UI if required)
→ lane.state-changed to completed
```

## Verdict

- Gate logic and decider fail-closed path: **authored** (ESTIMATED correct pending test run)
- Production projection population: **not done** (explicit empty arrays)
- Package PROVEN: **no**
