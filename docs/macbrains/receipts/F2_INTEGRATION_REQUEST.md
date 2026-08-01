# Integration request — F2 completion gate (Worker A → Integrator)

**From:** Worker A — Truth Gate (`macbrains/f2-completion-gate`)  
**To:** Campaign Integrator  
**Priority:** Wave 1 / Wave 2 vertical slice (merge after minimal F3 spawn contracts per FAMILY_OWNERSHIP)

## Ask

1. **Merge** F2 completion-gate modules when Independently verified:
   - `packages/contracts/src/completionGate.ts` (+ `package.json` subpath `./completionGate`)
   - `packages/contracts/src/orchestration.ts` optional read-model keys
   - `apps/server/src/orchestration/completionGate.ts` (+ tests)
   - decider / projector / ProjectionSnapshotQuery empty-array placeholders
2. **Wire** `ProjectionSnapshotQuery.getCommandReadModel` to load real:
   - `acceptanceCriteria` from `projection_lane_acceptance_criteria`
   - `laneChecks` / `laneCompletionEvidence` once persistence exists (may stay empty until check/evidence commands)
3. **Root barrel:** only if another package needs root import; subpath is sufficient for server today.
4. **Do not** flip CAMPAIGN_MANIFEST F2 / ACCEPTANCE_MATRIX H\* to PROVEN from this request alone.

## Shared surfaces touched (review carefully)

| Path | Why |
|---|---|
| `packages/contracts/src/orchestration.ts` | optional F2 evidence keys on command read model |
| `packages/contracts/package.json` | subpath export |
| `apps/server/.../ProjectionSnapshotQuery.ts` | placeholder empty arrays for new keys |

## Validation required before marking proven

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.1/bin:$PATH"
# only when ram-preflight --xl returns ADMIT
vp test run packages/contracts/src/completionGate.test.ts
vp test run apps/server/src/orchestration/completionGate.test.ts
vp test run apps/server/src/orchestration/decider.workLane.test.ts
```
