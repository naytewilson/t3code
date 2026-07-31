import {
  CommandId,
  EnvironmentId,
  EventId,
  ProjectId,
  SourceTruthRevisionId,
  WorkLaneId,
  toWorkLaneShell,
  type OrchestrationEvent,
  type SourceTruthRevision,
  type TaskContract,
  type WorkLane,
} from "@t3tools/contracts";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { createEmptyReadModel, projectEvent } from "./projector.ts";

const NOW = "2026-01-01T00:00:00.000Z";
const LATER = "2026-01-01T01:00:00.000Z";
const PROJECT_ID = ProjectId.make("project-1");
const LANE_ID = WorkLaneId.make("lane-1");
const ENV_ID = EnvironmentId.make("env-1");

function makeTaskContract(): TaskContract {
  return {
    objective: "Ship F0 work lanes",
    constraints: [],
    nonGoals: [],
    deliverableRequirement: "required",
    requiresPullRequest: false,
    requiresUserVisibleSurface: false,
    authorizedActions: ["edit", "test"],
    prohibitedActions: ["force-push"],
    completionReportRequired: true,
    objectiveDerivation: "PROVEN",
  };
}

function makeWorkLane(overrides: Partial<WorkLane> = {}): WorkLane {
  return {
    id: LANE_ID,
    projectId: PROJECT_ID,
    title: "Lane",
    taskContract: makeTaskContract(),
    state: "queued",
    priority: "normal",
    classification: "substantial",
    environmentId: ENV_ID,
    repositoryIdentity: null,
    baseRef: null,
    branch: null,
    worktreePath: "/tmp/worktrees/lane-1",
    ownerAssignmentId: null,
    advisorAssignmentIds: [],
    verifierAssignmentIds: [],
    sourceTruthRevisionId: null,
    sourceTruthActiveGitOperation: "none",
    sourceTruthOwnershipOverlap: "unknown",
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
    ...overrides,
  };
}

function makeSourceTruthRevision(
  overrides: Partial<SourceTruthRevision> = {},
): SourceTruthRevision {
  return {
    id: SourceTruthRevisionId.make("str-1"),
    laneId: LANE_ID,
    repositoryIdentity: null,
    repositoryRoot: "/tmp/repo",
    branch: "main",
    detached: false,
    headSha: "abc123",
    baseSha: "def456",
    worktreePath: "/tmp/worktrees/lane-1",
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
    safeNextAction: "implement",
    producedAt: NOW,
    producerAssignmentId: null,
    producerThreadId: null,
    rawOutputArtifactRef: null,
    supersededAt: null,
    supersedesRevisionId: null,
    ...overrides,
  };
}

function makeLaneEvent(input: {
  readonly sequence: number;
  readonly type: OrchestrationEvent["type"];
  readonly payload: unknown;
  readonly occurredAt?: string;
}): OrchestrationEvent {
  return {
    sequence: input.sequence,
    eventId: EventId.make(`event-${input.sequence}`),
    type: input.type,
    aggregateKind: "lane",
    aggregateId: LANE_ID,
    occurredAt: input.occurredAt ?? NOW,
    commandId: CommandId.make(`command-${input.sequence}`),
    causationEventId: null,
    correlationId: null,
    metadata: {},
    payload: input.payload as never,
  } as OrchestrationEvent;
}

it.effect("replays lane.created + state-changed + preflight-recorded deterministically", () =>
  Effect.gen(function* () {
    const lane = makeWorkLane();
    const revision = makeSourceTruthRevision();

    const events = [
      makeLaneEvent({
        sequence: 1,
        type: "lane.created",
        payload: { lane, acceptanceCriteria: [] },
      }),
      makeLaneEvent({
        sequence: 2,
        type: "lane.state-changed",
        payload: {
          laneId: LANE_ID,
          fromState: "queued",
          toState: "preflight",
          resumeState: null,
          updatedAt: LATER,
        },
        occurredAt: LATER,
      }),
      makeLaneEvent({
        sequence: 3,
        type: "source-truth.preflight-recorded",
        payload: {
          laneId: LANE_ID,
          revision,
          previousRevisionId: null,
          recordedAt: LATER,
        },
        occurredAt: LATER,
      }),
    ] as const;

    const replay = (initial = createEmptyReadModel(NOW)) =>
      Effect.gen(function* () {
        let model = initial;
        for (const event of events) {
          model = yield* projectEvent(model, event);
        }
        return model;
      });
    const firstPass = yield* replay();
    const secondPass = yield* replay();

    expect(firstPass).toEqual(secondPass);
    expect(firstPass.snapshotSequence).toBe(3);
    expect(firstPass.lanes).toHaveLength(1);
    expect(firstPass.lanes[0]?.state).toBe("preflight");
    expect(firstPass.lanes[0]?.sourceTruthRevisionId).toBe(revision.id);
    expect(firstPass.lanes[0]?.sourceTruthActiveGitOperation).toBe(revision.activeGitOperation);
    expect(firstPass.lanes[0]?.sourceTruthOwnershipOverlap).toBe(revision.ownershipOverlap);
    expect(firstPass.lanes[0]?.updatedAt).toBe(LATER);
  }),
);

it.effect("toWorkLaneShell keeps shell compact without taskContract", () =>
  Effect.gen(function* () {
    const lane = makeWorkLane({
      state: "preflight",
      sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
    });
    const projected = yield* projectEvent(
      createEmptyReadModel(NOW),
      makeLaneEvent({
        sequence: 1,
        type: "lane.created",
        payload: { lane, acceptanceCriteria: [] },
      }),
    );
    const projectedLane = projected.lanes[0];
    expect(projectedLane).toBeDefined();

    const shell = toWorkLaneShell(projectedLane!);
    expect(shell.id).toBe(LANE_ID);
    expect(shell.objectiveSummary).toBe(lane.taskContract.objective);
    expect(shell.sourceTruthRevisionId).toBe(lane.sourceTruthRevisionId);
    expect("taskContract" in shell).toBe(false);
    expect(Object.keys(shell).sort()).toEqual(
      [
        "id",
        "projectId",
        "title",
        "state",
        "priority",
        "classification",
        "environmentId",
        "branch",
        "worktreePath",
        "sourceTruthRevisionId",
        "sourceTruthSummary",
        "primaryThreadId",
        "importedThreadId",
        "objectiveSummary",
        "createdAt",
        "updatedAt",
        "completedAt",
      ].sort(),
    );
  }),
);

it.effect("invalidates source truth on conflict and refresh while retaining history", () =>
  Effect.gen(function* () {
    const lane = makeWorkLane();
    const revision = makeSourceTruthRevision();
    let model = yield* projectEvent(
      createEmptyReadModel(NOW),
      makeLaneEvent({
        sequence: 1,
        type: "lane.created",
        payload: { lane, acceptanceCriteria: [] },
      }),
    );
    model = yield* projectEvent(
      model,
      makeLaneEvent({
        sequence: 2,
        type: "source-truth.preflight-recorded",
        payload: {
          laneId: LANE_ID,
          revision,
          previousRevisionId: null,
          recordedAt: LATER,
        },
      }),
    );
    model = yield* projectEvent(
      model,
      makeLaneEvent({
        sequence: 3,
        type: "source-truth.conflict-recorded",
        payload: {
          laneId: LANE_ID,
          summary: "worktree changed",
          blockerId: "blocker-1",
          recordedAt: LATER,
        },
      }),
    );
    const conflicted = model.lanes[0]!;
    expect(conflicted.sourceTruthRevisionId).toBeNull();
    expect(conflicted.sourceTruthOwnershipOverlap).toBe("unknown");
    expect(conflicted.blockerIds).toEqual(["blocker-1"]);

    model = yield* projectEvent(
      model,
      makeLaneEvent({
        sequence: 4,
        type: "source-truth.refresh-requested",
        payload: { laneId: LANE_ID, requestedAt: "2026-01-01T02:00:00.000Z" },
      }),
    );
    expect(model.lanes[0]!.sourceTruthRevisionId).toBeNull();
    expect(model.lanes[0]!.sourceTruthOwnershipOverlap).toBe("unknown");

    model = yield* projectEvent(
      model,
      makeLaneEvent({
        sequence: 5,
        type: "source-truth.conflict-recorded",
        payload: {
          laneId: LANE_ID,
          summary: "legacy conflict without blocker id",
          recordedAt: "2026-01-01T03:00:00.000Z",
        },
      }),
    );
    expect(model.lanes[0]!.blockerIds).toContain("source-truth:command-5");
  }),
);

it.effect("projects unknown action-changing facts as an unknown execution gate", () =>
  Effect.gen(function* () {
    const lane = makeWorkLane({ state: "planned" });
    const revision = makeSourceTruthRevision({ unknownsThatChangeAction: ["repository root unavailable"] });
    const model = yield* projectEvent(
      yield* projectEvent(
        createEmptyReadModel(NOW),
        makeLaneEvent({
          sequence: 1,
          type: "lane.created",
          payload: { lane, acceptanceCriteria: [] },
        }),
      ),
      makeLaneEvent({
        sequence: 2,
        type: "source-truth.preflight-recorded",
        payload: {
          laneId: LANE_ID,
          revision,
          previousRevisionId: null,
          recordedAt: LATER,
        },
      }),
    );
    expect(model.lanes[0]!.sourceTruthOwnershipOverlap).toBe("unknown");
  }),
);
