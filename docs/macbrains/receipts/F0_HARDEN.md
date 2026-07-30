# F0 Harden Receipt

- Branch: `cursor/f0-worklane-source-truth-7986`
- SHA: `c3e5be231ae14d3ea7978a71e228eeb7613b5cc0`
- Commit: `fix(orchestration): harden work-lane foundation before pull`
- Safe to pull: **yes** after green push of this harden commit

## Check receipts

```text
vp run --filter @t3tools/contracts typecheck  # pass
vp run --filter t3 typecheck                  # pass
vp run --filter @t3tools/client-runtime typecheck  # pass
npx vitest run \
  packages/contracts/src/workLane.test.ts \
  apps/server/src/orchestration/decider.workLane.test.ts \
  apps/server/src/orchestration/projector.workLane.test.ts \
  apps/server/src/persistence/Migrations/035_WorkLanesAndSourceTruth.test.ts \
  packages/client-runtime/src/state/shellReducer.test.ts \
  apps/server/src/ws.laneResume.test.ts \
  --config vite.config.ts
# 6 files / 46 tests passed
```

## Fixed (P0/P1)

- Narrowed worktree ownership to active/recovery states (imports may share paths while queued).
- Exclusivity enforced on meta.update path changes (owning states) and completion.invalidate re-entry.
- Migration requires ServerConfig environment id (no `unknown-environment`); skips archived; seeds `projection.work-lanes` cursor.
- Shell SQL uses denormalized columns + current revision join (`superseded_at IS NULL`; not full `lane_json` / all revisions).
- `execution.start` allowed from planned|testing|reviewing|deliverable-ready.
- Duplicate source-truth revision ids rejected; terminal lanes reject mutations.
- `objectiveDerivation` defaults to `UNKNOWN`.
- `blockerId` / `supersedingLaneId` persisted on state-changed; criteria `laneId` validated.
- Compact preflight gate fields on lane (`sourceTruthActiveGitOperation`, `sourceTruthOwnershipOverlap`).
- `subscribeLane` resume gap → snapshot; shell lane upsert allowlist.
- Projection upserts are sequence-monotonic.

## Deferred P2 / known limits (not blockers for pull)

- Unbounded source-truth revision body retention until F1 artifact/receipt store.
- Full SQL wipe + rebuild-from-events for work lanes remains R1.
- Path comparison does not realpath / collapse `..` segments.
- Exclusive ownership is not claimed in queued…planned soft states (intentional).
- Historical superseded revision ids not in command RM (duplicate check covers current lane pointers).
