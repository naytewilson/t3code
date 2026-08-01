import {
  AgentAssignmentId,
  DeliverableId,
  EnvironmentId,
  PlanRevisionId,
  ProjectId,
  ProviderInstanceId,
  ReceiptId,
  SourceTruthRevisionId,
  ThreadId,
  WorkLaneId,
  type WorkLane,
  type WorkLaneShell,
} from "@t3tools/contracts";

import { laneDeliverablePath, laneWorkspacePath } from "./deepLinks.ts";
import type { CommandCenterAdapter } from "./adapter.ts";
import { isAgentControlAvailable } from "./adapter.ts";
import { attentionReasonForLane, classifyLaneShell, nextActionForSection } from "./classify.ts";
import type {
  AgentAssignmentShell,
  AgentControlRequest,
  AgentControlResult,
  CommandCenterCard,
  CommandCenterSnapshot,
  LaneWorkspaceView,
  NodeActivityShell,
} from "./types.ts";

const NOW = "2026-07-31T18:00:00.000Z";

export interface MockCommandCenterSeed {
  readonly environmentId?: EnvironmentId;
  readonly projectId?: ProjectId;
  readonly projectTitle?: string;
  readonly workspaceRoot?: string;
}

interface MutableAssignment extends AgentAssignmentShell {}

/**
 * Wave-1 replaceable mock. Builds real contract-shaped shells (WorkLaneShell /
 * WorkLane / branded IDs). Not acceptable as Wave-2 demo evidence — live
 * adapters must replace this producer.
 */
export function createMockCommandCenterAdapter(
  seed: MockCommandCenterSeed = {},
): CommandCenterAdapter {
  const environmentId = seed.environmentId ?? EnvironmentId.make("env-mac-local");
  const projectId = seed.projectId ?? ProjectId.make("project-macbrains-t3");
  const projectTitle = seed.projectTitle ?? "MacBrains T3 Code";
  const workspaceRoot =
    seed.workspaceRoot ??
    "/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f5-command-center";

  const lanes = buildSeedLanes(environmentId, projectId);
  const assignments = new Map<string, MutableAssignment>();
  for (const assignment of buildSeedAssignments(environmentId, lanes)) {
    assignments.set(assignment.id, { ...assignment });
  }
  const nodeActivity = buildSeedNodeActivity(environmentId, projectId, lanes);
  let sequence = 1;

  const project = {
    id: projectId,
    title: projectTitle,
    workspaceRoot,
    updatedAt: NOW,
  };

  function cardFor(lane: WorkLaneShell): CommandCenterCard {
    const section = classifyLaneShell(lane, {
      hasOpenBlocker: lane.state === "blocked",
      hasReadyDeliverable: lane.state === "deliverable-ready" || lane.state === "completed",
    });
    const laneAssignments = [...assignments.values()].filter((a) => a.laneId === lane.id);
    const primary =
      laneAssignments.find((a) => a.role === "director") ??
      laneAssignments.find((a) => a.role === "executor") ??
      null;
    return {
      section,
      project,
      lane,
      environmentId,
      primaryRole: primary?.role ?? null,
      providerModelSummary: primary
        ? `${primary.providerInstanceId} / ${primary.resolvedModel}`
        : null,
      lastReceiptKind: section === "needs-attention" ? "blocker" : "lifecycle",
      lastReceiptId: primary?.lastReceiptId ?? null,
      nextAction: nextActionForSection(section, lane.state),
      deepLink: laneWorkspacePath(environmentId, lane.id),
      attentionReason: attentionReasonForLane(lane, {
        hasOpenBlocker: lane.state === "blocked",
      }),
    };
  }

  return {
    kind: "mock",
    async getSnapshot(): Promise<CommandCenterSnapshot> {
      sequence += 1;
      return {
        sequence,
        updatedAt: NOW,
        cards: lanes.map(cardFor),
        nodeActivity,
      };
    },
    async getLaneWorkspace(envId, laneId): Promise<LaneWorkspaceView | null> {
      if (envId !== environmentId) return null;
      const shell = lanes.find((lane) => lane.id === laneId);
      if (!shell) return null;
      const lane = workLaneFromShell(shell);
      const laneAssignments = [...assignments.values()].filter((a) => a.laneId === laneId);
      const director = laneAssignments.find((a) => a.role === "director") ?? null;
      const workers = laneAssignments.filter((a) => a.role !== "director");
      return {
        lane,
        project,
        taskObjective: shell.objectiveSummary,
        sourceTruthRevisionId: shell.sourceTruthRevisionId,
        sourceTruthSummary: shell.sourceTruthSummary?.headSha
          ? `HEAD ${shell.sourceTruthSummary.headSha.slice(0, 8)} · ${shell.branch ?? "detached"}`
          : shell.branch
            ? `Branch ${shell.branch}`
            : null,
        planRevisionId: lane.activePlanRevisionId,
        planSummary:
          lane.activePlanRevisionId === null
            ? null
            : `Plan ${lane.activePlanRevisionId} · state ${lane.state}`,
        director,
        workers,
        worktreePath: lane.worktreePath,
        branch: lane.branch,
        changedFiles:
          lane.state === "queued"
            ? []
            : [
                { path: "packages/client-runtime/src/commandCenter/types.ts", status: "added" },
                { path: "apps/web/src/components/commandCenter/ProjectsHome.tsx", status: "added" },
              ],
        checks: [
          {
            id: "check-typecheck",
            title: "Focused typecheck",
            status:
              lane.state === "failed" ? "failed" : lane.state === "testing" ? "running" : "pending",
            required: true,
          },
          {
            id: "check-unit",
            title: "Command-center unit tests",
            status:
              lane.state === "reviewing" || lane.state === "deliverable-ready"
                ? "passed"
                : "pending",
            required: true,
          },
        ],
        reviewStatus:
          lane.state === "reviewing"
            ? "pending"
            : lane.state === "deliverable-ready" || lane.state === "completed"
              ? "accepted"
              : "not-requested",
        deliverables:
          lane.deliverableIds.length === 0
            ? []
            : [
                {
                  id: lane.deliverableIds[0]!,
                  title: "Visible Projects + lane shell",
                  status:
                    lane.state === "deliverable-ready" || lane.state === "completed"
                      ? "ready"
                      : "draft",
                  launchPath: laneDeliverablePath(environmentId, lane.id, lane.deliverableIds[0]!),
                },
              ],
        deepLink: laneWorkspacePath(environmentId, lane.id),
      };
    },
    async dispatchAgentControl(request: AgentControlRequest): Promise<AgentControlResult> {
      const current = assignments.get(request.assignmentId);
      if (!current || current.laneId !== request.laneId) {
        return {
          ok: false,
          action: request.action,
          assignmentId: request.assignmentId,
          message: "Assignment not found in adapter",
          resultingStatus: null,
        };
      }
      if (!isAgentControlAvailable(current.status, request.action)) {
        return {
          ok: false,
          action: request.action,
          assignmentId: request.assignmentId,
          message: `Action ${request.action} unavailable for status ${current.status}`,
          resultingStatus: current.status,
        };
      }

      let resultingStatus = current.status;
      switch (request.action) {
        case "steer":
        case "queue":
          resultingStatus = "active";
          break;
        case "pause":
          resultingStatus = "paused";
          break;
        case "resume":
          resultingStatus = "active";
          break;
        case "stop":
          resultingStatus = "cancelled";
          break;
        case "replace":
          resultingStatus = "superseded";
          break;
        case "review":
          resultingStatus = current.status === "completed" ? "completed" : "waiting";
          break;
        case "open-result":
          resultingStatus = "completed";
          break;
      }
      assignments.set(request.assignmentId, {
        ...current,
        status: resultingStatus,
        updatedAt: NOW,
      });
      return {
        ok: true,
        action: request.action,
        assignmentId: request.assignmentId,
        message: `Mock adapter applied ${request.action}`,
        resultingStatus,
      };
    },
    async openDeliverable(_envId, laneId, deliverableId) {
      const workspace = await this.getLaneWorkspace(environmentId, laneId);
      const deliverable = workspace?.deliverables.find((d) => d.id === deliverableId) ?? null;
      if (deliverable === null) {
        return { ok: false, path: null, message: "Deliverable not found" };
      }
      return {
        ok: deliverable.status === "ready" || deliverable.status === "accepted",
        path: deliverable.launchPath,
        message:
          deliverable.status === "ready" || deliverable.status === "accepted"
            ? "Open deliverable"
            : `Deliverable not ready (${deliverable.status})`,
      };
    },
  };
}

function buildSeedLanes(environmentId: EnvironmentId, projectId: ProjectId): WorkLaneShell[] {
  const base = {
    projectId,
    environmentId,
    priority: "normal" as const,
    classification: "substantial" as const,
    sourceTruthSummary: null,
    primaryThreadId: null,
    importedThreadId: null,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
  };

  return [
    {
      ...base,
      id: WorkLaneId.make("lane-f5-active"),
      title: "F5 command-center shell",
      state: "executing",
      branch: "macbrains/f5-command-center",
      worktreePath: "/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f5-command-center",
      sourceTruthRevisionId: SourceTruthRevisionId.make("str-f5-1"),
      objectiveSummary: "Ship Projects home + lane/agent-tree shells on real contracts",
    },
    {
      ...base,
      id: WorkLaneId.make("lane-f5-blocked"),
      title: "Node 24 install gate",
      state: "blocked",
      branch: "macbrains/f5-command-center",
      worktreePath: "/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f5-command-center",
      sourceTruthRevisionId: SourceTruthRevisionId.make("str-f5-2"),
      objectiveSummary: "Unblock pnpm install after RAM admit XL",
    },
    {
      ...base,
      id: WorkLaneId.make("lane-f5-review"),
      title: "Agent-tree controls",
      state: "reviewing",
      branch: "macbrains/f5-command-center",
      worktreePath: "/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f5-command-center",
      sourceTruthRevisionId: SourceTruthRevisionId.make("str-f5-3"),
      objectiveSummary: "Verifier reviews steer/pause/replace/review controls",
    },
    {
      ...base,
      id: WorkLaneId.make("lane-f5-ready"),
      title: "Wave 1 visible shell",
      state: "deliverable-ready",
      branch: "macbrains/f5-command-center",
      worktreePath: "/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f5-command-center",
      sourceTruthRevisionId: SourceTruthRevisionId.make("str-f5-4"),
      objectiveSummary: "Projects home + lane screen ready for Integrator wiring",
      completedAt: null,
    },
  ];
}

function buildSeedAssignments(
  environmentId: EnvironmentId,
  lanes: ReadonlyArray<WorkLaneShell>,
): AgentAssignmentShell[] {
  const active = lanes[0]!;
  const review = lanes[2]!;
  const ready = lanes[3]!;
  const directorId = AgentAssignmentId.make("assign-director-1");
  return [
    {
      id: directorId,
      laneId: active.id,
      role: "director",
      providerInstanceId: ProviderInstanceId.make("claude"),
      resolvedModel: "claude-opus",
      reasoningLevel: "high",
      environmentId,
      threadId: ThreadId.make("thread-director-1"),
      parentAssignmentId: null,
      status: "active",
      supersedesAssignmentId: null,
      lastReceiptId: ReceiptId.make("receipt-director-1"),
      updatedAt: NOW,
    },
    {
      id: AgentAssignmentId.make("assign-executor-1"),
      laneId: active.id,
      role: "executor",
      providerInstanceId: ProviderInstanceId.make("codex"),
      resolvedModel: "gpt-5",
      reasoningLevel: "medium",
      environmentId,
      threadId: ThreadId.make("thread-executor-1"),
      parentAssignmentId: directorId,
      status: "active",
      supersedesAssignmentId: null,
      lastReceiptId: ReceiptId.make("receipt-executor-1"),
      updatedAt: NOW,
    },
    {
      id: AgentAssignmentId.make("assign-verifier-1"),
      laneId: review.id,
      role: "verifier",
      providerInstanceId: ProviderInstanceId.make("claude"),
      resolvedModel: "claude-opus",
      reasoningLevel: "high",
      environmentId,
      threadId: null,
      parentAssignmentId: null,
      status: "waiting",
      supersedesAssignmentId: null,
      lastReceiptId: null,
      updatedAt: NOW,
    },
    {
      id: AgentAssignmentId.make("assign-executor-ready"),
      laneId: ready.id,
      role: "executor",
      providerInstanceId: ProviderInstanceId.make("cursor-agent"),
      resolvedModel: "composer",
      reasoningLevel: "medium",
      environmentId,
      threadId: ThreadId.make("thread-ready-1"),
      parentAssignmentId: null,
      status: "completed",
      supersedesAssignmentId: null,
      lastReceiptId: ReceiptId.make("receipt-ready-1"),
      updatedAt: NOW,
    },
  ];
}

function buildSeedNodeActivity(
  environmentId: EnvironmentId,
  projectId: ProjectId,
  lanes: ReadonlyArray<WorkLaneShell>,
): NodeActivityShell[] {
  return [
    {
      id: "nodejob-1",
      laneId: lanes[0]!.id,
      projectId,
      environmentId,
      title: "Focused client-runtime tests on node-02",
      status: "queued",
      resourceClass: "cpu_compute",
      integrationStatus: "pending",
      updatedAt: NOW,
    },
  ];
}

function workLaneFromShell(shell: WorkLaneShell): WorkLane {
  const deliverableId =
    shell.state === "deliverable-ready" || shell.state === "completed"
      ? DeliverableId.make(`deliverable-${shell.id}`)
      : null;
  return {
    id: shell.id,
    projectId: shell.projectId,
    title: shell.title,
    taskContract: {
      objective: shell.objectiveSummary,
      constraints: [],
      nonGoals: [],
      deliverableRequirement: deliverableId === null ? "none" : "required",
      requiresPullRequest: false,
      requiresUserVisibleSurface: true,
      authorizedActions: ["edit", "test"],
      prohibitedActions: ["force-push"],
      completionReportRequired: true,
      objectiveDerivation: "PROVEN",
    },
    state: shell.state,
    priority: shell.priority,
    classification: shell.classification,
    environmentId: shell.environmentId,
    repositoryIdentity: null,
    baseRef: null,
    branch: shell.branch,
    worktreePath: shell.worktreePath,
    ownerAssignmentId: null,
    advisorAssignmentIds: [],
    verifierAssignmentIds: [],
    sourceTruthRevisionId: shell.sourceTruthRevisionId,
    sourceTruthActiveGitOperation: "none",
    sourceTruthOwnershipOverlap: "exclusive",
    activePlanRevisionId:
      shell.state === "queued" || shell.state === "preflight"
        ? null
        : PlanRevisionId.make(`plan-${shell.id}`),
    supersedingLaneId: null,
    acceptanceCriterionIds: [],
    requiredReceiptKinds: ["source-truth", "checks", "completion-report"],
    deliverableIds: deliverableId === null ? [] : [deliverableId],
    blockerIds: [],
    primaryThreadId: shell.primaryThreadId,
    importedThreadId: shell.importedThreadId,
    threadIds: shell.primaryThreadId === null ? [] : [shell.primaryThreadId],
    legacyExecutorRef: null,
    resumeState: null,
    createdAt: shell.createdAt,
    updatedAt: shell.updatedAt,
    completedAt: shell.completedAt,
  };
}
