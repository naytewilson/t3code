/**
 * F5/F6 command-center projection types.
 *
 * These are compact UI/read-model shells composed from real MacBrains contracts
 * (`WorkLaneShell`, `OrchestrationProjectShell`, branded IDs). They are not a
 * second domain model. When F3 lands `AgentAssignment` Schema and F1/F4 land
 * receipt/node-job aggregates, adapters swap producers — consumers keep these
 * shell shapes or migrate to the exported Schema types via Integrator.
 */
import type {
  AgentAssignmentId,
  DeliverableId,
  EnvironmentId,
  IsoDateTime,
  OrchestrationProjectShell,
  PlanRevisionId,
  ProjectId,
  ProviderInstanceId,
  ReceiptId,
  SourceTruthRevisionId,
  ThreadId,
  WorkLaneDetail,
  WorkLaneId,
  WorkLaneShell,
  WorkLaneState,
} from "@t3tools/contracts";

/** DOMAIN_MODEL AgentRole — kept as literals until F3 Schema export lands. */
export const AGENT_ROLES = [
  "director",
  "executor",
  "advisor",
  "verifier",
  "recovery-worker",
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

/** DOMAIN_MODEL AgentAssignmentStatus. */
export const AGENT_ASSIGNMENT_STATUSES = [
  "pending",
  "starting",
  "active",
  "waiting",
  "paused",
  "completed",
  "failed",
  "cancelled",
  "superseded",
] as const;
export type AgentAssignmentStatus = (typeof AGENT_ASSIGNMENT_STATUSES)[number];

/** DOMAIN_MODEL NodeJobStatus (compact shell only). */
export const NODE_JOB_STATUSES = [
  "draft",
  "validating",
  "queued",
  "dispatching",
  "running",
  "collecting",
  "completed",
  "failed",
  "cancelled",
  "stale",
] as const;
export type NodeJobStatus = (typeof NODE_JOB_STATUSES)[number];

export const COMMAND_CENTER_SECTIONS = [
  "needs-attention",
  "active",
  "ready-for-review",
  "ready-to-use",
  "node-activity",
] as const;
export type CommandCenterSection = (typeof COMMAND_CENTER_SECTIONS)[number];

/**
 * Compact assignment shell for agent-tree rendering.
 * Structurally aligned with DOMAIN_MODEL AgentAssignment; not a competing aggregate.
 */
export interface AgentAssignmentShell {
  readonly id: AgentAssignmentId;
  readonly laneId: WorkLaneId;
  readonly role: AgentRole;
  readonly providerInstanceId: ProviderInstanceId;
  readonly resolvedModel: string;
  readonly reasoningLevel: string;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId | null;
  readonly parentAssignmentId: AgentAssignmentId | null;
  readonly status: AgentAssignmentStatus;
  readonly supersedesAssignmentId: AgentAssignmentId | null;
  readonly lastReceiptId: ReceiptId | null;
  readonly updatedAt: IsoDateTime;
}

export interface NodeActivityShell {
  readonly id: string;
  readonly laneId: WorkLaneId;
  readonly projectId: ProjectId;
  readonly environmentId: EnvironmentId;
  readonly title: string;
  readonly status: NodeJobStatus;
  readonly resourceClass: string;
  readonly integrationStatus: "pending" | "returned" | "verified" | "stale" | "failed";
  readonly updatedAt: IsoDateTime;
}

export interface CommandCenterCard {
  readonly section: CommandCenterSection;
  readonly project: Pick<OrchestrationProjectShell, "id" | "title" | "workspaceRoot" | "updatedAt">;
  readonly lane: WorkLaneShell;
  readonly environmentId: EnvironmentId;
  readonly primaryRole: AgentRole | null;
  readonly providerModelSummary: string | null;
  readonly lastReceiptKind: string | null;
  readonly lastReceiptId: ReceiptId | null;
  readonly nextAction: string;
  readonly deepLink: string;
  readonly attentionReason: string | null;
}

export interface CommandCenterSnapshot {
  readonly sequence: number;
  readonly updatedAt: IsoDateTime;
  readonly cards: ReadonlyArray<CommandCenterCard>;
  readonly nodeActivity: ReadonlyArray<NodeActivityShell>;
}

export interface ChangedFileShell {
  readonly path: string;
  readonly status: "added" | "modified" | "deleted" | "renamed" | "untracked";
}

export interface CheckShell {
  readonly id: string;
  readonly title: string;
  readonly status: "pending" | "running" | "passed" | "failed" | "stale" | "skipped";
  readonly required: boolean;
}

export interface DeliverableShell {
  readonly id: DeliverableId;
  readonly title: string;
  readonly status: "draft" | "ready" | "accepted" | "invalidated" | "missing";
  readonly launchPath: string | null;
}

export interface LaneWorkspaceView {
  readonly lane: WorkLaneDetail["lane"];
  readonly project: Pick<OrchestrationProjectShell, "id" | "title" | "workspaceRoot">;
  readonly taskObjective: string;
  readonly sourceTruthRevisionId: SourceTruthRevisionId | null;
  readonly sourceTruthSummary: string | null;
  readonly planRevisionId: PlanRevisionId | null;
  readonly planSummary: string | null;
  readonly director: AgentAssignmentShell | null;
  readonly workers: ReadonlyArray<AgentAssignmentShell>;
  readonly worktreePath: string | null;
  readonly branch: string | null;
  readonly changedFiles: ReadonlyArray<ChangedFileShell>;
  readonly checks: ReadonlyArray<CheckShell>;
  readonly reviewStatus: "not-requested" | "pending" | "accepted" | "rejected";
  readonly deliverables: ReadonlyArray<DeliverableShell>;
  readonly deepLink: string;
}

export type AgentControlAction =
  | "steer"
  | "queue"
  | "pause"
  | "resume"
  | "stop"
  | "replace"
  | "review"
  | "open-result";

export interface AgentControlRequest {
  readonly action: AgentControlAction;
  readonly assignmentId: AgentAssignmentId;
  readonly laneId: WorkLaneId;
  readonly environmentId: EnvironmentId;
  readonly instruction?: string;
}

export interface AgentControlResult {
  readonly ok: boolean;
  readonly action: AgentControlAction;
  readonly assignmentId: AgentAssignmentId;
  readonly message: string;
  readonly resultingStatus: AgentAssignmentStatus | null;
}

export function isTerminalLaneState(state: WorkLaneState): boolean {
  return state === "completed" || state === "cancelled" || state === "superseded";
}
