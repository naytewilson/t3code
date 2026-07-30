import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  AcceptanceCriterionId,
  AgentAssignmentId,
  BlockerId,
  CommandId,
  DeliverableId,
  EnvironmentId,
  IsoDateTime,
  NonNegativeInt,
  PlanRevisionId,
  ProjectId,
  ReceiptId,
  RuntimeSessionId,
  SourceTruthRevisionId,
  ThreadId,
  TrimmedNonEmptyString,
  WorkLaneId,
} from "./baseSchemas.ts";
import { RepositoryIdentity } from "./environment.ts";
import { ClaimLabel, SourceTruthRevision, SourceTruthRevisionShellSummary } from "./sourceTruth.ts";

export const WorkLaneState = Schema.Literals([
  "queued",
  "preflight",
  "oriented",
  "planned",
  "executing",
  "testing",
  "reviewing",
  "deliverable-ready",
  "completed",
  "blocked",
  "failed",
  "cancelled",
  "superseded",
  "recovery-required",
]);
export type WorkLaneState = typeof WorkLaneState.Type;

export const WorkPriority = Schema.Literals(["low", "normal", "high", "urgent"]);
export type WorkPriority = typeof WorkPriority.Type;

export const WorkLaneClassification = Schema.Literals([
  "substantial",
  "bounded-readonly",
  "tiny-reversible",
]);
export type WorkLaneClassification = typeof WorkLaneClassification.Type;

export const WORK_LANE_TERMINAL_STATES = [
  "completed",
  "cancelled",
  "superseded",
] as const satisfies ReadonlyArray<WorkLaneState>;

/** States that still own a worktree for exclusive-ownership checks. */
export const WORK_LANE_WORKTREE_OWNING_STATES = [
  "queued",
  "preflight",
  "oriented",
  "planned",
  "executing",
  "testing",
  "reviewing",
  "deliverable-ready",
  "blocked",
  "failed",
  "recovery-required",
] as const satisfies ReadonlyArray<WorkLaneState>;

export const WORK_LANE_NORMAL_TRANSITIONS: Readonly<
  Record<WorkLaneState, ReadonlyArray<WorkLaneState>>
> = {
  queued: ["preflight"],
  preflight: ["oriented", "blocked", "cancelled"],
  oriented: ["planned", "blocked", "cancelled"],
  planned: ["executing", "blocked", "cancelled"],
  executing: ["testing", "blocked", "failed", "recovery-required", "cancelled"],
  testing: ["executing", "reviewing", "blocked", "failed", "recovery-required"],
  reviewing: [
    "executing",
    "testing",
    "deliverable-ready",
    "blocked",
    "failed",
    "recovery-required",
  ],
  "deliverable-ready": ["completed", "executing", "testing", "reviewing", "blocked"],
  completed: ["recovery-required"],
  blocked: [], // unblock restores resumeState via command path
  failed: ["recovery-required", "preflight"],
  cancelled: [],
  superseded: [],
  "recovery-required": ["preflight"],
};

export function isWorkLaneTerminalState(state: WorkLaneState): boolean {
  return (WORK_LANE_TERMINAL_STATES as ReadonlyArray<string>).includes(state);
}

export function isWorkLaneWorktreeOwningState(state: WorkLaneState): boolean {
  return (WORK_LANE_WORKTREE_OWNING_STATES as ReadonlyArray<string>).includes(state);
}

export function isAllowedWorkLaneTransition(from: WorkLaneState, to: WorkLaneState): boolean {
  return WORK_LANE_NORMAL_TRANSITIONS[from].includes(to);
}

export const ConstraintKind = Schema.Literals([
  "scope",
  "safety",
  "compatibility",
  "performance",
  "security",
  "policy",
  "other",
]);
export type ConstraintKind = typeof ConstraintKind.Type;

export const TaskConstraint = Schema.Struct({
  kind: ConstraintKind,
  summary: TrimmedNonEmptyString,
});
export type TaskConstraint = typeof TaskConstraint.Type;

export const AuthorizedAction = Schema.Literals([
  "read",
  "edit",
  "test",
  "commit",
  "push",
  "open-pr",
  "install-deps",
  "run-migration",
  "other",
]);
export type AuthorizedAction = typeof AuthorizedAction.Type;

export const ProhibitedAction = Schema.Literals([
  "force-push",
  "delete-branch",
  "touch-live-userdata",
  "kill-by-pattern",
  "open-unapproved-pr",
  "mutate-historical-events",
  "other",
]);
export type ProhibitedAction = typeof ProhibitedAction.Type;

export const TaskContract = Schema.Struct({
  objective: TrimmedNonEmptyString,
  constraints: Schema.Array(TaskConstraint).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  nonGoals: Schema.Array(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  deliverableRequirement: Schema.Literals(["required", "none"]),
  requiresPullRequest: Schema.Boolean,
  requiresUserVisibleSurface: Schema.Boolean,
  authorizedActions: Schema.Array(AuthorizedAction).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  prohibitedActions: Schema.Array(ProhibitedAction).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  completionReportRequired: Schema.Literal(true).pipe(
    Schema.withDecodingDefault(Effect.succeed(true as const)),
  ),
  objectiveDerivation: ClaimLabel.pipe(
    Schema.withDecodingDefault(Effect.succeed("PROVEN" as const)),
  ),
});
export type TaskContract = typeof TaskContract.Type;

export const AcceptanceCriterionCategory = Schema.Literals([
  "foundation",
  "correctness",
  "reproducibility",
  "test",
  "delivery",
  "performance",
  "security",
]);
export type AcceptanceCriterionCategory = typeof AcceptanceCriterionCategory.Type;

export const CriterionStatus = Schema.Literals([
  "pending",
  "in-progress",
  "satisfied",
  "failed",
  "waived",
]);
export type CriterionStatus = typeof CriterionStatus.Type;

export const AcceptanceCriterion = Schema.Struct({
  id: AcceptanceCriterionId,
  laneId: WorkLaneId,
  description: TrimmedNonEmptyString,
  category: AcceptanceCriterionCategory,
  required: Schema.Boolean,
  status: CriterionStatus.pipe(Schema.withDecodingDefault(Effect.succeed("pending" as const))),
  supportingReceiptIds: Schema.Array(ReceiptId).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});
export type AcceptanceCriterion = typeof AcceptanceCriterion.Type;

/**
 * Forward-compatible executor association for migrated threads.
 * Not a full AgentAssignment aggregate (F3).
 */
export const LegacyExecutorRef = Schema.Struct({
  threadId: ThreadId,
  runtimeSessionId: Schema.optional(Schema.NullOr(RuntimeSessionId)),
  providerName: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  sessionStatus: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
});
export type LegacyExecutorRef = typeof LegacyExecutorRef.Type;

export const GitRef = Schema.Struct({
  name: TrimmedNonEmptyString,
  sha: Schema.NullOr(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
});
export type GitRef = typeof GitRef.Type;

export const WorkLane = Schema.Struct({
  id: WorkLaneId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  taskContract: TaskContract,
  state: WorkLaneState,
  priority: WorkPriority.pipe(Schema.withDecodingDefault(Effect.succeed("normal" as const))),
  classification: WorkLaneClassification.pipe(
    Schema.withDecodingDefault(Effect.succeed("substantial" as const)),
  ),
  environmentId: EnvironmentId,
  repositoryIdentity: Schema.NullOr(RepositoryIdentity).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  baseRef: Schema.NullOr(GitRef).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  branch: Schema.NullOr(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  ownerAssignmentId: Schema.NullOr(AgentAssignmentId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  advisorAssignmentIds: Schema.Array(AgentAssignmentId).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  verifierAssignmentIds: Schema.Array(AgentAssignmentId).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  sourceTruthRevisionId: Schema.NullOr(SourceTruthRevisionId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  activePlanRevisionId: Schema.NullOr(PlanRevisionId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  acceptanceCriterionIds: Schema.Array(AcceptanceCriterionId).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  requiredReceiptKinds: Schema.Array(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  deliverableIds: Schema.Array(DeliverableId).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  blockerIds: Schema.Array(BlockerId).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  primaryThreadId: Schema.NullOr(ThreadId).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  importedThreadId: Schema.NullOr(ThreadId).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  threadIds: Schema.Array(ThreadId).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  legacyExecutorRef: Schema.NullOr(LegacyExecutorRef).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  resumeState: Schema.NullOr(WorkLaneState).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  completedAt: Schema.NullOr(IsoDateTime).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
});
export type WorkLane = typeof WorkLane.Type;

/** Compact command-center / shell record — no full task contract or source-truth body. */
export const WorkLaneShell = Schema.Struct({
  id: WorkLaneId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  state: WorkLaneState,
  priority: WorkPriority,
  classification: WorkLaneClassification,
  environmentId: EnvironmentId,
  branch: Schema.NullOr(TrimmedNonEmptyString),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  sourceTruthRevisionId: Schema.NullOr(SourceTruthRevisionId),
  sourceTruthSummary: Schema.NullOr(SourceTruthRevisionShellSummary).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  primaryThreadId: Schema.NullOr(ThreadId),
  importedThreadId: Schema.NullOr(ThreadId),
  objectiveSummary: TrimmedNonEmptyString,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  completedAt: Schema.NullOr(IsoDateTime),
});
export type WorkLaneShell = typeof WorkLaneShell.Type;

export const WorkLaneDetail = Schema.Struct({
  lane: WorkLane,
  acceptanceCriteria: Schema.Array(AcceptanceCriterion).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  sourceTruthRevisions: Schema.Array(SourceTruthRevision).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});
export type WorkLaneDetail = typeof WorkLaneDetail.Type;

export const WorkLaneDetailSnapshot = Schema.Struct({
  snapshotSequence: NonNegativeInt,
  detail: WorkLaneDetail,
});
export type WorkLaneDetailSnapshot = typeof WorkLaneDetailSnapshot.Type;

export function toWorkLaneShell(
  lane: WorkLane,
  sourceTruthSummary: SourceTruthRevisionShellSummary | null = null,
): WorkLaneShell {
  return {
    id: lane.id,
    projectId: lane.projectId,
    title: lane.title,
    state: lane.state,
    priority: lane.priority,
    classification: lane.classification,
    environmentId: lane.environmentId,
    branch: lane.branch,
    worktreePath: lane.worktreePath,
    sourceTruthRevisionId: lane.sourceTruthRevisionId,
    sourceTruthSummary,
    primaryThreadId: lane.primaryThreadId,
    importedThreadId: lane.importedThreadId,
    objectiveSummary: lane.taskContract.objective,
    createdAt: lane.createdAt,
    updatedAt: lane.updatedAt,
    completedAt: lane.completedAt,
  };
}

/** Stable imported WorkLaneId derived from a legacy ThreadId (distinct brand). */
export function importedWorkLaneIdForThread(threadId: ThreadId): WorkLaneId {
  return WorkLaneId.make(`lane:import:${threadId}`);
}

// --- Commands ---

export const LaneCreateCommand = Schema.Struct({
  type: Schema.Literal("lane.create"),
  commandId: CommandId,
  laneId: WorkLaneId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  taskContract: TaskContract,
  priority: WorkPriority.pipe(Schema.withDecodingDefault(Effect.succeed("normal" as const))),
  classification: WorkLaneClassification.pipe(
    Schema.withDecodingDefault(Effect.succeed("substantial" as const)),
  ),
  environmentId: EnvironmentId,
  repositoryIdentity: Schema.optional(Schema.NullOr(RepositoryIdentity)),
  baseRef: Schema.optional(Schema.NullOr(GitRef)),
  branch: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  worktreePath: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  primaryThreadId: Schema.optional(Schema.NullOr(ThreadId)),
  acceptanceCriteria: Schema.optional(Schema.Array(AcceptanceCriterion)),
  createdAt: IsoDateTime,
});

export const LaneTaskContractUpdateCommand = Schema.Struct({
  type: Schema.Literal("lane.task-contract.update"),
  commandId: CommandId,
  laneId: WorkLaneId,
  taskContract: TaskContract,
  updatedAt: IsoDateTime,
});

export const LanePreflightRequestCommand = Schema.Struct({
  type: Schema.Literal("lane.preflight.request"),
  commandId: CommandId,
  laneId: WorkLaneId,
  requestedAt: IsoDateTime,
});

export const LaneOrientationRecordCommand = Schema.Struct({
  type: Schema.Literal("lane.orientation.record"),
  commandId: CommandId,
  laneId: WorkLaneId,
  recordedAt: IsoDateTime,
});

export const LanePlanProposeCommand = Schema.Struct({
  type: Schema.Literal("lane.plan.propose"),
  commandId: CommandId,
  laneId: WorkLaneId,
  planRevisionId: PlanRevisionId,
  proposedAt: IsoDateTime,
});

export const LanePlanActivateCommand = Schema.Struct({
  type: Schema.Literal("lane.plan.activate"),
  commandId: CommandId,
  laneId: WorkLaneId,
  planRevisionId: PlanRevisionId,
  activatedAt: IsoDateTime,
});

export const LaneExecutionStartCommand = Schema.Struct({
  type: Schema.Literal("lane.execution.start"),
  commandId: CommandId,
  laneId: WorkLaneId,
  startedAt: IsoDateTime,
});

export const LaneTestingStartCommand = Schema.Struct({
  type: Schema.Literal("lane.testing.start"),
  commandId: CommandId,
  laneId: WorkLaneId,
  startedAt: IsoDateTime,
});

export const LaneReviewRequestCommand = Schema.Struct({
  type: Schema.Literal("lane.review.request"),
  commandId: CommandId,
  laneId: WorkLaneId,
  requestedAt: IsoDateTime,
});

export const LaneDeliverableRegisterCommand = Schema.Struct({
  type: Schema.Literal("lane.deliverable.register"),
  commandId: CommandId,
  laneId: WorkLaneId,
  deliverableId: DeliverableId,
  registeredAt: IsoDateTime,
});

export const LaneCompletionRequestCommand = Schema.Struct({
  type: Schema.Literal("lane.completion.request"),
  commandId: CommandId,
  laneId: WorkLaneId,
  requestedAt: IsoDateTime,
});

export const LaneBlockCommand = Schema.Struct({
  type: Schema.Literal("lane.block"),
  commandId: CommandId,
  laneId: WorkLaneId,
  blockerId: Schema.optional(BlockerId),
  reason: Schema.optional(TrimmedNonEmptyString),
  blockedAt: IsoDateTime,
});

export const LaneUnblockCommand = Schema.Struct({
  type: Schema.Literal("lane.unblock"),
  commandId: CommandId,
  laneId: WorkLaneId,
  unblockedAt: IsoDateTime,
});

export const LaneCancelCommand = Schema.Struct({
  type: Schema.Literal("lane.cancel"),
  commandId: CommandId,
  laneId: WorkLaneId,
  cancelledAt: IsoDateTime,
});

export const LaneSupersedeCommand = Schema.Struct({
  type: Schema.Literal("lane.supersede"),
  commandId: CommandId,
  laneId: WorkLaneId,
  supersedingLaneId: Schema.optional(WorkLaneId),
  supersededAt: IsoDateTime,
});

export const LaneRecoveryRequestCommand = Schema.Struct({
  type: Schema.Literal("lane.recovery.request"),
  commandId: CommandId,
  laneId: WorkLaneId,
  requestedAt: IsoDateTime,
});

export const LaneCompletionInvalidateCommand = Schema.Struct({
  type: Schema.Literal("lane.completion.invalidate"),
  commandId: CommandId,
  laneId: WorkLaneId,
  reason: Schema.optional(TrimmedNonEmptyString),
  invalidatedAt: IsoDateTime,
});

export const LaneFailCommand = Schema.Struct({
  type: Schema.Literal("lane.fail"),
  commandId: CommandId,
  laneId: WorkLaneId,
  reason: Schema.optional(TrimmedNonEmptyString),
  failedAt: IsoDateTime,
});

export const LaneMetaUpdateCommand = Schema.Struct({
  type: Schema.Literal("lane.meta.update"),
  commandId: CommandId,
  laneId: WorkLaneId,
  title: Schema.optional(TrimmedNonEmptyString),
  priority: Schema.optional(WorkPriority),
  classification: Schema.optional(WorkLaneClassification),
  branch: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  worktreePath: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  baseRef: Schema.optional(Schema.NullOr(GitRef)),
  repositoryIdentity: Schema.optional(Schema.NullOr(RepositoryIdentity)),
  updatedAt: IsoDateTime,
});

export const SourceTruthPreflightRecordCommand = Schema.Struct({
  type: Schema.Literal("source-truth.preflight.record"),
  commandId: CommandId,
  laneId: WorkLaneId,
  revision: SourceTruthRevision,
  recordedAt: IsoDateTime,
});

export const SourceTruthConflictRecordCommand = Schema.Struct({
  type: Schema.Literal("source-truth.conflict.record"),
  commandId: CommandId,
  laneId: WorkLaneId,
  summary: TrimmedNonEmptyString,
  recordedAt: IsoDateTime,
});

export const SourceTruthRefreshRequestCommand = Schema.Struct({
  type: Schema.Literal("source-truth.refresh.request"),
  commandId: CommandId,
  laneId: WorkLaneId,
  requestedAt: IsoDateTime,
});

export const WorkLaneClientCommand = Schema.Union([
  LaneCreateCommand,
  LaneTaskContractUpdateCommand,
  LanePreflightRequestCommand,
  LaneOrientationRecordCommand,
  LanePlanProposeCommand,
  LanePlanActivateCommand,
  LaneExecutionStartCommand,
  LaneTestingStartCommand,
  LaneReviewRequestCommand,
  LaneDeliverableRegisterCommand,
  LaneCompletionRequestCommand,
  LaneBlockCommand,
  LaneUnblockCommand,
  LaneCancelCommand,
  LaneSupersedeCommand,
  LaneRecoveryRequestCommand,
  LaneCompletionInvalidateCommand,
  LaneFailCommand,
  LaneMetaUpdateCommand,
  SourceTruthPreflightRecordCommand,
  SourceTruthConflictRecordCommand,
  SourceTruthRefreshRequestCommand,
]);
export type WorkLaneClientCommand = typeof WorkLaneClientCommand.Type;

// --- Event payloads ---

export const LaneCreatedPayload = Schema.Struct({
  lane: WorkLane,
  acceptanceCriteria: Schema.Array(AcceptanceCriterion).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});

export const LaneImportedPayload = Schema.Struct({
  lane: WorkLane,
  acceptanceCriteria: Schema.Array(AcceptanceCriterion).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  importedFromThreadId: ThreadId,
  importReason: TrimmedNonEmptyString,
});

export const LaneStateChangedPayload = Schema.Struct({
  laneId: WorkLaneId,
  fromState: WorkLaneState,
  toState: WorkLaneState,
  resumeState: Schema.NullOr(WorkLaneState).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  reason: Schema.optional(TrimmedNonEmptyString),
  updatedAt: IsoDateTime,
});

export const LaneTaskContractUpdatedPayload = Schema.Struct({
  laneId: WorkLaneId,
  taskContract: TaskContract,
  updatedAt: IsoDateTime,
});

export const LaneMetaUpdatedPayload = Schema.Struct({
  laneId: WorkLaneId,
  title: Schema.optional(TrimmedNonEmptyString),
  priority: Schema.optional(WorkPriority),
  classification: Schema.optional(WorkLaneClassification),
  branch: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  worktreePath: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  baseRef: Schema.optional(Schema.NullOr(GitRef)),
  repositoryIdentity: Schema.optional(Schema.NullOr(RepositoryIdentity)),
  updatedAt: IsoDateTime,
});

export const LanePlanProposedPayload = Schema.Struct({
  laneId: WorkLaneId,
  planRevisionId: PlanRevisionId,
  proposedAt: IsoDateTime,
});

export const LanePlanActivatedPayload = Schema.Struct({
  laneId: WorkLaneId,
  planRevisionId: PlanRevisionId,
  activatedAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const LaneDeliverableRegisteredPayload = Schema.Struct({
  laneId: WorkLaneId,
  deliverableId: DeliverableId,
  registeredAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const SourceTruthPreflightRecordedPayload = Schema.Struct({
  laneId: WorkLaneId,
  revision: SourceTruthRevision,
  previousRevisionId: Schema.NullOr(SourceTruthRevisionId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  recordedAt: IsoDateTime,
});

export const SourceTruthConflictRecordedPayload = Schema.Struct({
  laneId: WorkLaneId,
  summary: TrimmedNonEmptyString,
  recordedAt: IsoDateTime,
});

export const SourceTruthRefreshRequestedPayload = Schema.Struct({
  laneId: WorkLaneId,
  requestedAt: IsoDateTime,
});

export const WorkLaneEventType = Schema.Literals([
  "lane.created",
  "lane.imported",
  "lane.state-changed",
  "lane.task-contract-updated",
  "lane.meta-updated",
  "lane.plan-proposed",
  "lane.plan-activated",
  "lane.deliverable-registered",
  "source-truth.preflight-recorded",
  "source-truth.conflict-recorded",
  "source-truth.refresh-requested",
]);
export type WorkLaneEventType = typeof WorkLaneEventType.Type;
