import {
  CommandId,
  EnvironmentId,
  EventId,
  ProjectId,
  SourceTruthRevisionId,
  WorkLaneId,
  type OrchestrationEvent,
  type SourceTruthRevision,
  type WorkLane,
  type WorkLaneDetailSnapshot,
} from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import { applyLaneDetailEvent, applyLaneStreamItem } from "./workLanes.ts";

const NOW = "2026-01-01T00:00:00.000Z";
const LANE_ID = WorkLaneId.make("lane-1");
const REVISION_ID = SourceTruthRevisionId.make("revision-1");

const lane = {
  id: LANE_ID,
  projectId: ProjectId.make("project-1"),
  title: "Lane",
  taskContract: {
    objective: "test",
    constraints: [],
    nonGoals: [],
    deliverableRequirement: "none",
    requiresPullRequest: false,
    requiresUserVisibleSurface: false,
    authorizedActions: [],
    prohibitedActions: [],
    completionReportRequired: true,
    objectiveDerivation: "UNKNOWN",
  },
  state: "planned",
  priority: "normal",
  classification: "substantial",
  environmentId: EnvironmentId.make("env-1"),
  repositoryIdentity: null,
  baseRef: null,
  branch: null,
  worktreePath: "/tmp/lane-1",
  ownerAssignmentId: null,
  advisorAssignmentIds: [],
  verifierAssignmentIds: [],
  sourceTruthRevisionId: REVISION_ID,
  sourceTruthActiveGitOperation: "none",
  sourceTruthOwnershipOverlap: "exclusive",
  activePlanRevisionId: null,
  acceptanceCriterionIds: [],
  requiredReceiptKinds: [],
  deliverableIds: [],
  blockerIds: [],
  primaryThreadId: null,
  importedThreadId: null,
  threadIds: [],
  legacyExecutorRef: null,
  resumeState: null,
  supersedingLaneId: null,
  createdAt: NOW,
  updatedAt: NOW,
  completedAt: null,
} satisfies WorkLane;

const revision = {
  id: REVISION_ID,
  laneId: LANE_ID,
  repositoryIdentity: null,
  repositoryRoot: "/tmp/repo",
  branch: "main",
  detached: false,
  headSha: "head",
  baseSha: "base",
  worktreePath: "/tmp/lane-1",
  dirty: { fingerprint: "fp", summary: "clean", isDirty: false },
  instructionFiles: [],
  manifests: [],
  buildTestCandidates: [],
  relevantFiles: [],
  relevantTests: [],
  activeGitOperation: "none",
  ownershipOverlap: "exclusive",
  canonicalExternalSourceRefs: [],
  unknownsThatChangeAction: [],
  safeNextAction: "continue",
  producedAt: NOW,
  producerAssignmentId: null,
  producerThreadId: null,
  rawOutputArtifactRef: null,
  supersededAt: null,
  supersedesRevisionId: null,
} satisfies SourceTruthRevision;

const snapshot = {
  snapshotSequence: 1,
  detail: {
    lane,
    acceptanceCriteria: [],
    sourceTruthRevisions: [revision],
  },
} satisfies WorkLaneDetailSnapshot;

function laneEvent(
  sequence: number,
  type: OrchestrationEvent["type"],
  payload: unknown,
): OrchestrationEvent {
  return {
    sequence,
    eventId: EventId.make(`event-${sequence}`),
    type,
    aggregateKind: "lane",
    aggregateId: LANE_ID,
    occurredAt: NOW,
    commandId: CommandId.make(`command-${sequence}`),
    causationEventId: null,
    correlationId: null,
    metadata: {},
    payload: payload as never,
  } as OrchestrationEvent;
}

it("clears the active source-truth receipt on conflict and preserves history", () => {
  const next = applyLaneDetailEvent(
    snapshot,
    laneEvent(2, "source-truth.conflict-recorded", {
      laneId: LANE_ID,
      summary: "changed",
      blockerId: "blocker-1",
      recordedAt: "2026-01-01T01:00:00.000Z",
    }),
  );

  expect(next?.detail.lane.sourceTruthRevisionId).toBeNull();
  expect(next?.detail.lane.sourceTruthOwnershipOverlap).toBe("unknown");
  expect(next?.detail.lane.blockerIds).toEqual(["blocker-1"]);
  expect(next?.detail.sourceTruthRevisions[0]?.supersededAt).toBe("2026-01-01T01:00:00.000Z");
});

it("applies lane stream events and ignores stale sequence numbers", () => {
  const event = {
    kind: "event" as const,
    event: laneEvent(2, "lane.state-changed", {
      laneId: LANE_ID,
      fromState: "planned",
      toState: "executing",
      resumeState: null,
      updatedAt: "2026-01-01T01:00:00.000Z",
    }),
  };
  const next = applyLaneStreamItem(snapshot, event);
  expect(next?.detail.lane.state).toBe("executing");
  expect(applyLaneStreamItem(next, { ...event, event: { ...event.event, sequence: 1 } })).toBe(next);
});
