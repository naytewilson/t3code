# F0 Advisor Receipt

- Advisor: independent read-only architecture review (cloud subagent)
- Worktree: /workspace/.worktrees/f0-worklane-source-truth
- Branch: cursor/f0-worklane-source-truth-7986 @ 1e03d719
- Verdict: APPROVE_WITH_CONSTRAINTS
- Recorded: 2026-07-30

## Constraints applied

1. First-class aggregateKind `lane` on existing event store/engine/receipts; dual projector surfaces (in-memory projector.ts + SQL ProjectionPipeline) and ProjectionSnapshotQuery/REQUIRED_SNAPSHOT_PROJECTORS.
2. Contracts split: workLane.ts / sourceTruth.ts + IDs in baseSchemas; thin orchestration unions; no second barrel.
3. F0 TaskContract + minimal AcceptanceCriterion; reserved assignment/deliverable/plan/blocker IDs; legacyExecutorRef only.
4. WorkLaneClassification: substantial | bounded-readonly | tiny-reversible; gates use classification.
5. SourceTruthRevision is lane-owned append-only lineage (not separate aggregateKind); ArtifactReference is opaque F0 ref only.
6. Explicit transition matrix including block/unblock/resumeState, recovery.request, completion.request rejected, completion.invalidate only from completed; ownership among non-terminal includes failed/blocked/recovery-required.
7. Shell: WorkLaneShell + lanes default []; lane-upserted/lane-removed stream events + shellReducer; HTTP GET lane detail + WS subscribe; workLanes capability flag.
8. Migration 035: empty projection tables; append lane.imported events (event-first); stable WorkLaneId from ThreadId string; environmentId from persisted environment-id file or deferred bootstrap stamp; never completed.
9. Preserve importedThreadId / primaryThreadId linkage; client-runtime decode only; no UI; no PR.

## Risks acknowledged

Shell/reconnect skew, REQUIRED_SNAPSHOT_PROJECTORS lag, import classification edge cases, environmentId at migrate time, ArtifactReference scope creep, exclusive worktree false negatives, shared choke-point files.
