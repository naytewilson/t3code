/**
 * F3 Agent assignment + director tool contracts.
 *
 * Owned by Worker B (assignments-topology). Exported via the `./agentAssignment`
 * subpath until Integrator merges into the public barrel.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  AgentAssignmentId,
  EnvironmentId,
  IsoDateTime,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
  WorkLaneId,
} from "./baseSchemas.ts";
import { ModelSelection, RuntimeMode } from "./orchestration.ts";
import { ProviderInstanceId } from "./providerInstance.ts";

/** Durable agent roles for MacBrains topology (director controls workers). */
export const AgentRole = Schema.Literals([
  "director",
  "executor",
  "advisor",
  "verifier",
  "recovery",
]);
export type AgentRole = typeof AgentRole.Type;

/** Spawnable worker roles (everything except director). */
export const SpawnableAgentRole = Schema.Literals(["executor", "advisor", "verifier", "recovery"]);
export type SpawnableAgentRole = typeof SpawnableAgentRole.Type;

export const AgentAssignmentStatus = Schema.Literals([
  "pending",
  "starting",
  "active",
  "waiting",
  "paused",
  "completed",
  "failed",
  "cancelled",
  "superseded",
]);
export type AgentAssignmentStatus = typeof AgentAssignmentStatus.Type;

export const ReasoningLevel = Schema.Literals(["light", "medium", "high", "max"]);
export type ReasoningLevel = typeof ReasoningLevel.Type;

export const ModelCapabilityTier = Schema.Literals([
  "mechanical",
  "standard",
  "advanced",
  "frontier",
]);
export type ModelCapabilityTier = typeof ModelCapabilityTier.Type;

export const ModelIntent = Schema.Struct({
  capabilityTier: ModelCapabilityTier,
  latencyPreference: Schema.Literals(["fast", "balanced", "quality"]),
  costPreference: Schema.Literals(["free-flat-local-first", "balanced", "quality-first"]),
  continuityRequired: Schema.Boolean,
  independentVerificationRequired: Schema.Boolean,
});
export type ModelIntent = typeof ModelIntent.Type;

export const ContextHealth = Schema.Literals(["healthy", "degraded", "exhausted", "unknown"]);
export type ContextHealth = typeof ContextHealth.Type;

export const SharedFileRule = Schema.Struct({
  path: TrimmedNonEmptyString,
  mergeContract: TrimmedNonEmptyString,
});
export type SharedFileRule = typeof SharedFileRule.Type;

export const OwnershipBoundary = Schema.Struct({
  includePaths: Schema.Array(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  excludePaths: Schema.Array(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  symbols: Schema.Array(TrimmedNonEmptyString).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  sharedFiles: Schema.Array(SharedFileRule).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  mergeContract: Schema.optional(TrimmedNonEmptyString),
});
export type OwnershipBoundary = typeof OwnershipBoundary.Type;

/**
 * Role-bound durable assignment of one provider session to a lane.
 * Thread/session binding is required once the assignment is started.
 */
export const AgentAssignment = Schema.Struct({
  id: AgentAssignmentId,
  laneId: WorkLaneId,
  role: AgentRole,
  providerInstanceId: ProviderInstanceId,
  modelIntent: ModelIntent,
  resolvedModel: TrimmedNonEmptyString,
  reasoningLevel: ReasoningLevel,
  toolPolicyId: TrimmedNonEmptyString,
  environmentId: EnvironmentId,
  threadId: Schema.NullOr(ThreadId),
  parentAssignmentId: Schema.NullOr(AgentAssignmentId),
  ownership: Schema.NullOr(OwnershipBoundary),
  status: AgentAssignmentStatus,
  contextHealth: ContextHealth.pipe(Schema.withDecodingDefault(Effect.succeed("unknown" as const))),
  supersedesAssignmentId: Schema.NullOr(AgentAssignmentId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  taskSummary: Schema.NullOr(TrimmedNonEmptyString),
  lastResultSummary: Schema.NullOr(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  lastTurnId: Schema.NullOr(TurnId).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  resumeCursor: Schema.optional(Schema.Unknown),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type AgentAssignment = typeof AgentAssignment.Type;

/** Director control-plane tools (equivalents of the F3 launch packet). */
export const DirectorToolName = Schema.Literals([
  "spawn_worker",
  "send_instruction",
  "request_status",
  "steer_worker",
  "pause_worker",
  "resume_worker",
  "stop_worker",
  "replace_worker",
  "request_review",
]);
export type DirectorToolName = typeof DirectorToolName.Type;

export const DirectorSpawnWorkerInput = Schema.Struct({
  laneId: WorkLaneId,
  directorAssignmentId: AgentAssignmentId,
  role: SpawnableAgentRole.pipe(Schema.withDecodingDefault(Effect.succeed("executor" as const))),
  task: TrimmedNonEmptyString,
  worktreePath: TrimmedNonEmptyString,
  providerInstanceId: ProviderInstanceId,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode.pipe(Schema.withDecodingDefault(Effect.succeed("full-access" as const))),
  environmentId: EnvironmentId,
  ownership: Schema.optional(Schema.NullOr(OwnershipBoundary)),
  modelIntent: Schema.optional(ModelIntent),
  reasoningLevel: ReasoningLevel.pipe(
    Schema.withDecodingDefault(Effect.succeed("medium" as const)),
  ),
  toolPolicyId: TrimmedNonEmptyString.pipe(
    Schema.withDecodingDefault(Effect.succeed("default" as const)),
  ),
  workerThreadId: Schema.optional(ThreadId),
  workerAssignmentId: Schema.optional(AgentAssignmentId),
});
export type DirectorSpawnWorkerInput = typeof DirectorSpawnWorkerInput.Type;

export const DirectorWorkerTargetInput = Schema.Struct({
  assignmentId: AgentAssignmentId,
  instruction: Schema.optional(TrimmedNonEmptyString),
});
export type DirectorWorkerTargetInput = typeof DirectorWorkerTargetInput.Type;

export const DirectorReplaceWorkerInput = Schema.Struct({
  assignmentId: AgentAssignmentId,
  task: Schema.optional(TrimmedNonEmptyString),
  providerInstanceId: Schema.optional(ProviderInstanceId),
  modelSelection: Schema.optional(ModelSelection),
  workerThreadId: Schema.optional(ThreadId),
  workerAssignmentId: Schema.optional(AgentAssignmentId),
});
export type DirectorReplaceWorkerInput = typeof DirectorReplaceWorkerInput.Type;

export const DirectorRequestReviewInput = Schema.Struct({
  laneId: WorkLaneId,
  directorAssignmentId: AgentAssignmentId,
  subjectAssignmentId: AgentAssignmentId,
  reviewTask: TrimmedNonEmptyString,
  worktreePath: TrimmedNonEmptyString,
  providerInstanceId: ProviderInstanceId,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode.pipe(Schema.withDecodingDefault(Effect.succeed("full-access" as const))),
  environmentId: EnvironmentId,
  workerThreadId: Schema.optional(ThreadId),
  workerAssignmentId: Schema.optional(AgentAssignmentId),
});
export type DirectorRequestReviewInput = typeof DirectorRequestReviewInput.Type;

export const DirectorStartSessionInput = Schema.Struct({
  laneId: WorkLaneId,
  worktreePath: TrimmedNonEmptyString,
  providerInstanceId: ProviderInstanceId,
  modelSelection: ModelSelection,
  runtimeMode: RuntimeMode.pipe(Schema.withDecodingDefault(Effect.succeed("full-access" as const))),
  environmentId: EnvironmentId,
  taskSummary: Schema.optional(TrimmedNonEmptyString),
  directorThreadId: Schema.optional(ThreadId),
  directorAssignmentId: Schema.optional(AgentAssignmentId),
  modelIntent: Schema.optional(ModelIntent),
  reasoningLevel: ReasoningLevel.pipe(Schema.withDecodingDefault(Effect.succeed("high" as const))),
  toolPolicyId: TrimmedNonEmptyString.pipe(
    Schema.withDecodingDefault(Effect.succeed("director" as const)),
  ),
  initialInstruction: Schema.optional(TrimmedNonEmptyString),
});
export type DirectorStartSessionInput = typeof DirectorStartSessionInput.Type;

export const WorkerResultReport = Schema.Struct({
  assignmentId: AgentAssignmentId,
  summary: TrimmedNonEmptyString,
  turnId: Schema.optional(TurnId),
  success: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
});
export type WorkerResultReport = typeof WorkerResultReport.Type;

export const AgentTopologyNode = Schema.Struct({
  assignmentId: AgentAssignmentId,
  role: AgentRole,
  status: AgentAssignmentStatus,
  parentAssignmentId: Schema.NullOr(AgentAssignmentId),
  threadId: Schema.NullOr(ThreadId),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  taskSummary: Schema.NullOr(TrimmedNonEmptyString),
  lastResultSummary: Schema.NullOr(TrimmedNonEmptyString),
});
export type AgentTopologyNode = typeof AgentTopologyNode.Type;

export const AgentTopologyProjection = Schema.Struct({
  laneId: WorkLaneId,
  nodes: Schema.Array(AgentTopologyNode),
  directorAssignmentId: Schema.NullOr(AgentAssignmentId),
});
export type AgentTopologyProjection = typeof AgentTopologyProjection.Type;

export const DEFAULT_MODEL_INTENT_BY_ROLE: Readonly<Record<AgentRole, ModelIntent>> = {
  director: {
    capabilityTier: "advanced",
    latencyPreference: "balanced",
    costPreference: "balanced",
    continuityRequired: true,
    independentVerificationRequired: false,
  },
  executor: {
    capabilityTier: "standard",
    latencyPreference: "balanced",
    costPreference: "free-flat-local-first",
    continuityRequired: true,
    independentVerificationRequired: false,
  },
  advisor: {
    capabilityTier: "advanced",
    latencyPreference: "quality",
    costPreference: "balanced",
    continuityRequired: false,
    independentVerificationRequired: false,
  },
  verifier: {
    capabilityTier: "advanced",
    latencyPreference: "quality",
    costPreference: "balanced",
    continuityRequired: false,
    independentVerificationRequired: true,
  },
  recovery: {
    capabilityTier: "standard",
    latencyPreference: "balanced",
    costPreference: "free-flat-local-first",
    continuityRequired: true,
    independentVerificationRequired: false,
  },
};

export function isSpawnableAgentRole(role: AgentRole): role is SpawnableAgentRole {
  return role !== "director";
}
