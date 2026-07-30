import { assert, describe, it } from "@effect/vitest";
import * as Schema from "effect/Schema";

import {
  AcceptanceCriterionId,
  EnvironmentId,
  ProjectId,
  SourceTruthRevisionId,
  ThreadId,
  WorkLaneId,
} from "./baseSchemas.ts";
import {
  isAllowedWorkLaneTransition,
  TaskContract,
  WORK_LANE_NORMAL_TRANSITIONS,
  WorkLane,
  WorkLaneShell,
  WorkLaneState,
  importedWorkLaneIdForThread,
} from "./workLane.ts";
import { SourceTruthRevision } from "./sourceTruth.ts";
import { OrchestrationShellSnapshot } from "./orchestration.ts";

const decodeWorkLane = Schema.decodeUnknownSync(WorkLane);
const decodeShell = Schema.decodeUnknownSync(WorkLaneShell);
const decodeTaskContract = Schema.decodeUnknownSync(TaskContract);
const decodeRevision = Schema.decodeUnknownSync(SourceTruthRevision);
const decodeShellSnapshot = Schema.decodeUnknownSync(OrchestrationShellSnapshot);

describe("workLane contracts", () => {
  it("roundtrips a minimal WorkLane", () => {
    const lane = decodeWorkLane({
      id: "lane-1",
      projectId: "project-1",
      title: "Ship F0",
      taskContract: {
        objective: "Add work lanes",
        constraints: [{ kind: "scope", summary: "F0 only" }],
        nonGoals: ["full UI"],
        deliverableRequirement: "required",
        requiresPullRequest: false,
        requiresUserVisibleSurface: false,
        authorizedActions: ["edit", "test"],
        prohibitedActions: ["force-push"],
        completionReportRequired: true,
        objectiveDerivation: "PROVEN",
      },
      state: "queued",
      priority: "normal",
      classification: "substantial",
      environmentId: "env-1",
      repositoryIdentity: null,
      baseRef: null,
      branch: null,
      worktreePath: null,
      ownerAssignmentId: null,
      advisorAssignmentIds: [],
      verifierAssignmentIds: [],
      sourceTruthRevisionId: null,
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
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
      completedAt: null,
    });

    assert.strictEqual(lane.id, WorkLaneId.make("lane-1"));
    assert.strictEqual(lane.environmentId, EnvironmentId.make("env-1"));
    assert.strictEqual(lane.projectId, ProjectId.make("project-1"));
  });

  it("rejects invalid lifecycle states", () => {
    assert.throws(() => Schema.decodeUnknownSync(WorkLaneState)("done"));
  });

  it("rejects untyped permission blobs on task contracts", () => {
    assert.throws(() =>
      decodeTaskContract({
        objective: "x",
        constraints: "allow-all",
        nonGoals: [],
        deliverableRequirement: "none",
        requiresPullRequest: false,
        requiresUserVisibleSurface: false,
        authorizedActions: ["not-a-real-action"],
        prohibitedActions: [],
        completionReportRequired: true,
      }),
    );
  });

  it("defaults shell snapshot lanes to empty for legacy payloads", () => {
    const snapshot = decodeShellSnapshot({
      snapshotSequence: 1,
      projects: [],
      threads: [],
      updatedAt: "2026-07-30T00:00:00.000Z",
    });
    assert.deepStrictEqual(snapshot.lanes, []);
  });

  it("derives stable imported lane ids from threads", () => {
    const threadId = ThreadId.make("thread-abc");
    assert.strictEqual(
      importedWorkLaneIdForThread(threadId),
      WorkLaneId.make("lane:import:thread-abc"),
    );
  });
});

describe("workLane transition matrix", () => {
  it("allows every documented normal transition", () => {
    for (const [from, tos] of Object.entries(WORK_LANE_NORMAL_TRANSITIONS) as Array<
      [WorkLaneState, ReadonlyArray<WorkLaneState>]
    >) {
      for (const to of tos) {
        assert.isTrue(isAllowedWorkLaneTransition(from, to));
      }
    }
  });

  it("disallows jumping from queued to executing", () => {
    assert.isFalse(isAllowedWorkLaneTransition("queued", "executing"));
  });

  it("disallows leaving cancelled or superseded", () => {
    assert.isFalse(isAllowedWorkLaneTransition("cancelled", "queued"));
    assert.isFalse(isAllowedWorkLaneTransition("superseded", "preflight"));
  });
});

describe("sourceTruth contracts", () => {
  it("roundtrips a revision and keeps large output as a reference", () => {
    const revision = decodeRevision({
      id: "str-1",
      laneId: "lane-1",
      repositoryIdentity: null,
      repositoryRoot: "/repo",
      branch: "cursor/f0",
      detached: false,
      headSha: "abc",
      baseSha: "def",
      worktreePath: "/repo/.worktrees/f0",
      dirty: { fingerprint: "fp", summary: "clean", isDirty: false },
      instructionFiles: [{ path: "AGENTS.md", role: "instruction" }],
      manifests: [],
      buildTestCandidates: ["vp test"],
      relevantFiles: [],
      relevantTests: [],
      activeGitOperation: "none",
      ownershipOverlap: "exclusive",
      canonicalExternalSourceRefs: [],
      unknownsThatChangeAction: [],
      safeNextAction: "implement contracts",
      producedAt: "2026-07-30T00:00:00.000Z",
      producerAssignmentId: null,
      producerThreadId: null,
      rawOutputArtifactRef: {
        id: "art-1",
        kind: "log",
        ref: "artifacts/preflight.log",
      },
      supersededAt: null,
      supersedesRevisionId: null,
    });

    assert.strictEqual(revision.id, SourceTruthRevisionId.make("str-1"));
    assert.strictEqual(revision.rawOutputArtifactRef?.ref, "artifacts/preflight.log");
  });

  it("keeps WorkLaneShell compact without embedding task contracts", () => {
    const shell = decodeShell({
      id: "lane-1",
      projectId: "project-1",
      title: "Ship F0",
      state: "queued",
      priority: "normal",
      classification: "substantial",
      environmentId: "env-1",
      branch: null,
      worktreePath: null,
      sourceTruthRevisionId: null,
      sourceTruthSummary: null,
      primaryThreadId: null,
      importedThreadId: null,
      objectiveSummary: "Add work lanes",
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
      completedAt: null,
    });
    assert.isFalse("taskContract" in shell);
    assert.strictEqual(shell.objectiveSummary, "Add work lanes");
    assert.isTrue(Boolean(AcceptanceCriterionId.make("ac-1")));
  });
});
