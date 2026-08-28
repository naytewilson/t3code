import {
  AcceptanceCriterionId,
  CommandId,
  DeliverableId,
  EnvironmentId,
  PlanRevisionId,
  ProjectId,
  SourceTruthRevisionId,
  WorkLaneId,
  type OrchestrationCommand,
  type OrchestrationEvent,
  type OrchestrationReadModel,
  type SourceTruthRevision,
  type TaskContract,
  type WorkLane,
  type WorkLaneState,
} from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { decideOrchestrationCommand } from "./decider.ts";
import { createEmptyReadModel, projectEvent } from "./projector.ts";

const NOW = "2026-01-01T00:00:00.000Z";
const LATER = "2026-01-01T01:00:00.000Z";
const PROJECT_ID = ProjectId.make("project-1");
const LANE_ID = WorkLaneId.make("lane-1");
const ENV_ID = EnvironmentId.make("env-1");
const WORKTREE = "/tmp/worktrees/lane-1";

function makeTaskContract(overrides: Partial<TaskContract> = {}): TaskContract {
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
    ...overrides,
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
    worktreePath: WORKTREE,
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
  overrides: Partial<SourceTruthRevision> & { readonly id?: SourceTruthRevisionId } = {},
): SourceTruthRevision {
  const { id = SourceTruthRevisionId.make("str-1"), ...rest } = overrides;
  return {
    id,
    laneId: LANE_ID,
    repositoryIdentity: null,
    repositoryRoot: "/tmp/repo",
    branch: "main",
    detached: false,
    headSha: "abc123",
    baseSha: "def456",
    worktreePath: WORKTREE,
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
    ...rest,
  };
}

function makeReadModel(lanes: ReadonlyArray<WorkLane> = []): OrchestrationReadModel {
  return {
    ...createEmptyReadModel(NOW),
    projects: [
      {
        id: PROJECT_ID,
        title: "Project",
        workspaceRoot: "/tmp/repo",
        defaultModelSelection: null,
        scripts: [],
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
      },
    ],
    lanes,
  };
}

type PlannedEvent = Omit<OrchestrationEvent, "sequence">;

function asEvents(
  decided: PlannedEvent | ReadonlyArray<PlannedEvent>,
): ReadonlyArray<PlannedEvent> {
  return Array.isArray(decided)
    ? (decided as ReadonlyArray<PlannedEvent>)
    : [decided as PlannedEvent];
}

function withSequence(event: PlannedEvent, sequence: number): OrchestrationEvent {
  return { ...event, sequence } as OrchestrationEvent;
}

function payloadOf<T>(event: PlannedEvent | undefined, type: OrchestrationEvent["type"]): T {
  expect(event?.type).toBe(type);
  if (event?.type !== type) {
    throw new Error(`expected ${type}, got ${event?.type}`);
  }
  return event.payload as T;
}

const applyCommands = Effect.fn("applyCommands")(function* ({
  commands,
  readModel,
}: {
  readonly commands: ReadonlyArray<OrchestrationCommand>;
  readonly readModel: OrchestrationReadModel;
}) {
  let nextReadModel = readModel;
  let nextSequence = readModel.snapshotSequence;
  const plannedEvents: Array<PlannedEvent> = [];

  for (const command of commands) {
    const decided = yield* decideOrchestrationCommand({ command, readModel: nextReadModel });
    for (const nextEvent of asEvents(decided)) {
      plannedEvents.push(nextEvent);
      nextSequence += 1;
      nextReadModel = yield* projectEvent(
        nextReadModel,
        withSequence(nextEvent, nextSequence),
      ).pipe(Effect.orDie);
    }
  }

  return { events: plannedEvents, readModel: nextReadModel };
});

function expectInvariant(
  error: { readonly _tag: string; readonly detail?: string; readonly commandType?: string },
  detailIncludes?: string,
) {
  expect(error._tag).toBe("OrchestrationCommandInvariantError");
  if (detailIncludes !== undefined) {
    expect(error.detail).toContain(detailIncludes);
  }
}

it.layer(NodeServices.layer)("work lane decider", (it) => {
  it.effect("runs the full happy-path command sequence", () =>
    Effect.gen(function* () {
      const planRevisionId = PlanRevisionId.make("plan-1");
      const deliverableId = DeliverableId.make("del-1");
      const revision = makeSourceTruthRevision();

      const { events, readModel } = yield* applyCommands({
        readModel: makeReadModel(),
        commands: [
          {
            type: "lane.create",
            commandId: CommandId.make("cmd-create"),
            laneId: LANE_ID,
            projectId: PROJECT_ID,
            title: "Lane",
            taskContract: makeTaskContract(),
            priority: "normal",
            classification: "substantial",
            environmentId: ENV_ID,
            worktreePath: WORKTREE,
            createdAt: NOW,
          },
          {
            type: "lane.preflight.request",
            commandId: CommandId.make("cmd-preflight"),
            laneId: LANE_ID,
            requestedAt: NOW,
          },
          {
            type: "lane.orientation.record",
            commandId: CommandId.make("cmd-orient"),
            laneId: LANE_ID,
            recordedAt: NOW,
          },
          {
            type: "lane.plan.propose",
            commandId: CommandId.make("cmd-plan"),
            laneId: LANE_ID,
            planRevisionId,
            proposedAt: NOW,
          },
          {
            type: "source-truth.preflight.record",
            commandId: CommandId.make("cmd-source-truth"),
            laneId: LANE_ID,
            revision,
            recordedAt: NOW,
          },
          {
            type: "lane.execution.start",
            commandId: CommandId.make("cmd-exec"),
            laneId: LANE_ID,
            startedAt: NOW,
          },
          {
            type: "lane.testing.start",
            commandId: CommandId.make("cmd-test"),
            laneId: LANE_ID,
            startedAt: NOW,
          },
          {
            type: "lane.review.request",
            commandId: CommandId.make("cmd-review"),
            laneId: LANE_ID,
            requestedAt: NOW,
          },
          {
            type: "lane.deliverable.register",
            commandId: CommandId.make("cmd-deliverable"),
            laneId: LANE_ID,
            deliverableId,
            registeredAt: NOW,
          },
        ],
      });

      const types = events.map((event) => event.type);
      expect(types).toEqual([
        "lane.created",
        "lane.state-changed",
        "lane.state-changed",
        "lane.state-changed",
        "lane.plan-proposed",
        "source-truth.preflight-recorded",
        "lane.state-changed",
        "lane.state-changed",
        "lane.state-changed",
        "lane.state-changed",
        "lane.deliverable-registered",
      ]);

      const lane = readModel.lanes[0];
      expect(lane?.state).toBe("deliverable-ready");
      expect(lane?.sourceTruthRevisionId).toBe(revision.id);
      expect(lane?.deliverableIds).toEqual([deliverableId]);
    }),
  );

  it.effect("rejects disallowed transitions including queued→execution.start", () =>
    Effect.gen(function* () {
      const queuedError = yield* decideOrchestrationCommand({
        command: {
          type: "lane.execution.start",
          commandId: CommandId.make("cmd-bad-exec"),
          laneId: LANE_ID,
          startedAt: NOW,
        },
        readModel: makeReadModel([
          makeWorkLane({
            state: "queued",
            sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(queuedError, "must be in planned|testing|reviewing|deliverable-ready");

      const orientedToTesting = yield* decideOrchestrationCommand({
        command: {
          type: "lane.testing.start",
          commandId: CommandId.make("cmd-bad-test"),
          laneId: LANE_ID,
          startedAt: NOW,
        },
        readModel: makeReadModel([makeWorkLane({ state: "oriented" })]),
      }).pipe(Effect.flip);
      expectInvariant(orientedToTesting, "is not allowed");

      const cancelledToPreflight = yield* decideOrchestrationCommand({
        command: {
          type: "lane.preflight.request",
          commandId: CommandId.make("cmd-bad-preflight"),
          laneId: LANE_ID,
          requestedAt: NOW,
        },
        readModel: makeReadModel([makeWorkLane({ state: "cancelled" })]),
      }).pipe(Effect.flip);
      expectInvariant(cancelledToPreflight, "is not allowed");

      // completion.request always fails — covered in depth below; assert here too.
      const completion = yield* decideOrchestrationCommand({
        command: {
          type: "lane.completion.request",
          commandId: CommandId.make("cmd-completion-disallowed"),
          laneId: LANE_ID,
          requestedAt: NOW,
        },
        readModel: makeReadModel([makeWorkLane({ state: "deliverable-ready" })]),
      }).pipe(Effect.flip);
      expectInvariant(completion, "completion gate reserved until F2");
    }),
  );

  it.effect("refuses execution.start for substantial lanes without a worktree", () =>
    Effect.gen(function* () {
      const error = yield* decideOrchestrationCommand({
        command: {
          type: "lane.execution.start",
          commandId: CommandId.make("cmd-no-worktree"),
          laneId: LANE_ID,
          startedAt: NOW,
        },
        readModel: makeReadModel([
          makeWorkLane({
            state: "planned",
            classification: "substantial",
            worktreePath: null,
            sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(error, "requires a worktree path before execution");
    }),
  );

  it.effect(
    "allows bounded-readonly execution without a worktree when source-truth is present",
    () =>
      Effect.gen(function* () {
        const decided = yield* decideOrchestrationCommand({
          command: {
            type: "lane.execution.start",
            commandId: CommandId.make("cmd-readonly-exec"),
            laneId: LANE_ID,
            startedAt: NOW,
          },
          readModel: makeReadModel([
            makeWorkLane({
              state: "planned",
              classification: "bounded-readonly",
              worktreePath: null,
              sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
            }),
          ]),
        });
        const events = asEvents(decided);
        expect(events).toHaveLength(1);
        const stateChanged = payloadOf<Record<string, any>>(events[0], "lane.state-changed");
        expect(stateChanged.fromState).toBe("planned");
        expect(stateChanged.toState).toBe("executing");
      }),
  );

  it.effect("rejects exclusive worktree ownership for a second lane", () =>
    Effect.gen(function* () {
      const otherLaneId = WorkLaneId.make("lane-2");
      const error = yield* decideOrchestrationCommand({
        command: {
          type: "lane.execution.start",
          commandId: CommandId.make("cmd-exclusive"),
          laneId: otherLaneId,
          startedAt: NOW,
        },
        readModel: makeReadModel([
          makeWorkLane({
            id: LANE_ID,
            state: "executing",
            worktreePath: WORKTREE,
            sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
          }),
          makeWorkLane({
            id: otherLaneId,
            state: "planned",
            worktreePath: WORKTREE,
            sourceTruthRevisionId: SourceTruthRevisionId.make("str-2"),
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(error, "already owned by lane");
    }),
  );

  it.effect("always rejects completion.request with the F2 message", () =>
    Effect.gen(function* () {
      const states: ReadonlyArray<WorkLaneState> = [
        "queued",
        "planned",
        "executing",
        "deliverable-ready",
        "completed",
      ];
      for (const state of states) {
        const error = yield* decideOrchestrationCommand({
          command: {
            type: "lane.completion.request",
            commandId: CommandId.make(`cmd-completion-${state}`),
            laneId: LANE_ID,
            requestedAt: NOW,
          },
          readModel: makeReadModel([makeWorkLane({ state })]),
        }).pipe(Effect.flip);
        expectInvariant(error, "completion gate reserved until F2");
      }
    }),
  );

  it.effect("moves constructed completed lanes to recovery-required on completion.invalidate", () =>
    Effect.gen(function* () {
      const decided = yield* decideOrchestrationCommand({
        command: {
          type: "lane.completion.invalidate",
          commandId: CommandId.make("cmd-invalidate"),
          laneId: LANE_ID,
          reason: "false historical completion",
          invalidatedAt: LATER,
        },
        readModel: makeReadModel([
          makeWorkLane({
            state: "completed",
            completedAt: NOW,
          }),
        ]),
      });
      const events = asEvents(decided);
      expect(events).toHaveLength(1);
      const invalidated = payloadOf<Record<string, any>>(events[0], "lane.state-changed");
      expect(invalidated.fromState).toBe("completed");
      expect(invalidated.toState).toBe("recovery-required");
      expect(invalidated.resumeState).toBeNull();
      expect(invalidated.reason).toBe("false historical completion");
    }),
  );

  it.effect("block/unblock restores resumeState", () =>
    Effect.gen(function* () {
      const blocked = yield* decideOrchestrationCommand({
        command: {
          type: "lane.block",
          commandId: CommandId.make("cmd-block"),
          laneId: LANE_ID,
          reason: "waiting on review",
          blockedAt: NOW,
        },
        readModel: makeReadModel([
          makeWorkLane({
            state: "executing",
            sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
          }),
        ]),
      });
      const blockEvents = asEvents(blocked);
      const blockedEvent = payloadOf<Record<string, any>>(blockEvents[0], "lane.state-changed");
      expect(blockedEvent.toState).toBe("blocked");
      expect(blockedEvent.resumeState).toBe("executing");

      const afterBlock = yield* projectEvent(
        makeReadModel([
          makeWorkLane({
            state: "executing",
            sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
          }),
        ]),
        withSequence(blockEvents[0]!, 1),
      ).pipe(Effect.orDie);
      expect(afterBlock.lanes[0]?.state).toBe("blocked");
      expect(afterBlock.lanes[0]?.resumeState).toBe("executing");

      const unblocked = yield* decideOrchestrationCommand({
        command: {
          type: "lane.unblock",
          commandId: CommandId.make("cmd-unblock"),
          laneId: LANE_ID,
          unblockedAt: LATER,
        },
        readModel: afterBlock,
      });
      const unblockEvents = asEvents(unblocked);
      const unblockedEvent = payloadOf<Record<string, any>>(unblockEvents[0], "lane.state-changed");
      expect(unblockedEvent.fromState).toBe("blocked");
      expect(unblockedEvent.toState).toBe("executing");
      expect(unblockedEvent.resumeState).toBeNull();

      const afterUnblock = yield* projectEvent(afterBlock, withSequence(unblockEvents[0]!, 2)).pipe(
        Effect.orDie,
      );
      expect(afterUnblock.lanes[0]?.state).toBe("executing");
      expect(afterUnblock.lanes[0]?.resumeState).toBeNull();
    }),
  );

  it.effect("source-truth supersession updates sourceTruthRevisionId", () =>
    Effect.gen(function* () {
      const first = makeSourceTruthRevision({ id: SourceTruthRevisionId.make("str-1") });
      const second = makeSourceTruthRevision({
        id: SourceTruthRevisionId.make("str-2"),
        producedAt: LATER,
      });

      const { readModel } = yield* applyCommands({
        readModel: makeReadModel([makeWorkLane({ state: "planned" })]),
        commands: [
          {
            type: "source-truth.preflight.record",
            commandId: CommandId.make("cmd-st-1"),
            laneId: LANE_ID,
            revision: first,
            recordedAt: NOW,
          },
          {
            type: "source-truth.preflight.record",
            commandId: CommandId.make("cmd-st-2"),
            laneId: LANE_ID,
            revision: second,
            recordedAt: LATER,
          },
        ],
      });

      expect(readModel.lanes[0]?.sourceTruthRevisionId).toBe(second.id);

      const secondDecide = yield* decideOrchestrationCommand({
        command: {
          type: "source-truth.preflight.record",
          commandId: CommandId.make("cmd-st-2-check"),
          laneId: LANE_ID,
          revision: makeSourceTruthRevision({ id: SourceTruthRevisionId.make("str-3") }),
          recordedAt: LATER,
        },
        readModel: {
          ...makeReadModel([
            makeWorkLane({
              state: "planned",
              sourceTruthRevisionId: second.id,
            }),
          ]),
        },
      });
      const events = asEvents(secondDecide);
      const recorded = payloadOf<Record<string, any>>(events[0], "source-truth.preflight-recorded");
      expect(recorded.previousRevisionId).toBe(second.id);
      expect(recorded.revision.supersedesRevisionId).toBe(second.id);
    }),
  );

  it.effect(
    "command idempotency is engine/receipt-level — pure decide re-emits events on repeat",
    () =>
      Effect.gen(function* () {
        // Pure decider has no commandId ledger. Idempotency lives in the engine
        // receipt layer. Calling decide twice with the same logical command still
        // produces events (re-emission), which the engine dedupes by commandId.
        const readModel = makeReadModel([makeWorkLane({ state: "queued" })]);
        const command = {
          type: "lane.preflight.request" as const,
          commandId: CommandId.make("cmd-idempotent"),
          laneId: LANE_ID,
          requestedAt: NOW,
        };
        const first = asEvents(yield* decideOrchestrationCommand({ command, readModel }));
        const second = asEvents(yield* decideOrchestrationCommand({ command, readModel }));
        expect(first).toHaveLength(1);
        expect(second).toHaveLength(1);
        expect(first[0]?.type).toBe("lane.state-changed");
        expect(second[0]?.type).toBe("lane.state-changed");
      }),
  );

  it.effect("cancel, supersede, and recovery.request have continuation paths", () =>
    Effect.gen(function* () {
      const cancelled = asEvents(
        yield* decideOrchestrationCommand({
          command: {
            type: "lane.cancel",
            commandId: CommandId.make("cmd-cancel"),
            laneId: LANE_ID,
            cancelledAt: NOW,
          },
          readModel: makeReadModel([makeWorkLane({ state: "executing" })]),
        }),
      );
      expect(payloadOf<{ toState: string }>(cancelled[0], "lane.state-changed").toState).toBe(
        "cancelled",
      );

      const superseded = asEvents(
        yield* decideOrchestrationCommand({
          command: {
            type: "lane.supersede",
            commandId: CommandId.make("cmd-supersede"),
            laneId: LANE_ID,
            supersededAt: NOW,
            supersedingLaneId: WorkLaneId.make("lane-replacement"),
          },
          readModel: makeReadModel([makeWorkLane({ state: "planned" })]),
        }),
      );
      const supersededPayload = payloadOf<{
        toState: string;
        supersedingLaneId?: string;
      }>(superseded[0], "lane.state-changed");
      expect(supersededPayload.toState).toBe("superseded");
      expect(supersededPayload.supersedingLaneId).toBe("lane-replacement");

      const recovered = asEvents(
        yield* decideOrchestrationCommand({
          command: {
            type: "lane.recovery.request",
            commandId: CommandId.make("cmd-recovery"),
            laneId: LANE_ID,
            requestedAt: NOW,
          },
          readModel: makeReadModel([makeWorkLane({ state: "recovery-required" })]),
        }),
      );
      expect(payloadOf<{ toState: string }>(recovered[0], "lane.state-changed").toState).toBe(
        "preflight",
      );
    }),
  );

  it.effect("allows two queued lanes to share a worktree until one owns it", () =>
    Effect.gen(function* () {
      const otherLaneId = WorkLaneId.make("lane-2");
      const revisionId = SourceTruthRevisionId.make("str-1");
      const otherRevisionId = SourceTruthRevisionId.make("str-2");
      const shared = makeReadModel([
        makeWorkLane({
          id: LANE_ID,
          state: "queued",
          worktreePath: WORKTREE,
        }),
        makeWorkLane({
          id: otherLaneId,
          state: "queued",
          worktreePath: WORKTREE,
        }),
      ]);

      const firstStart = asEvents(
        yield* decideOrchestrationCommand({
          command: {
            type: "lane.execution.start",
            commandId: CommandId.make("cmd-first-exec"),
            laneId: LANE_ID,
            startedAt: NOW,
          },
          readModel: makeReadModel([
            makeWorkLane({
              id: LANE_ID,
              state: "planned",
              worktreePath: WORKTREE,
              sourceTruthRevisionId: revisionId,
              sourceTruthActiveGitOperation: "none",
              sourceTruthOwnershipOverlap: "exclusive",
            }),
            makeWorkLane({
              id: otherLaneId,
              state: "queued",
              worktreePath: WORKTREE,
            }),
          ]),
        }),
      );
      expect(payloadOf<{ toState: string }>(firstStart[0], "lane.state-changed").toState).toBe(
        "executing",
      );

      const secondBlocked = yield* decideOrchestrationCommand({
        command: {
          type: "lane.execution.start",
          commandId: CommandId.make("cmd-second-exec"),
          laneId: otherLaneId,
          startedAt: NOW,
        },
        readModel: makeReadModel([
          makeWorkLane({
            id: LANE_ID,
            state: "executing",
            worktreePath: WORKTREE,
            sourceTruthRevisionId: revisionId,
          }),
          makeWorkLane({
            id: otherLaneId,
            state: "planned",
            worktreePath: WORKTREE,
            sourceTruthRevisionId: otherRevisionId,
            sourceTruthActiveGitOperation: "none",
            sourceTruthOwnershipOverlap: "exclusive",
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(secondBlocked, "already owned by lane");

      // Soft-state meta path updates remain allowed while neither owns exclusively.
      const metaOk = asEvents(
        yield* decideOrchestrationCommand({
          command: {
            type: "lane.meta.update",
            commandId: CommandId.make("cmd-meta-soft"),
            laneId: otherLaneId,
            worktreePath: WORKTREE,
            updatedAt: LATER,
          },
          readModel: shared,
        }),
      );
      expect(metaOk[0]?.type).toBe("lane.meta-updated");
    }),
  );

  it.effect("enforces exclusivity on meta.update while owning and on invalidate re-entry", () =>
    Effect.gen(function* () {
      const otherLaneId = WorkLaneId.make("lane-2");
      const metaConflict = yield* decideOrchestrationCommand({
        command: {
          type: "lane.meta.update",
          commandId: CommandId.make("cmd-meta-owning"),
          laneId: otherLaneId,
          worktreePath: WORKTREE,
          updatedAt: LATER,
        },
        readModel: makeReadModel([
          makeWorkLane({
            id: LANE_ID,
            state: "executing",
            worktreePath: WORKTREE,
          }),
          makeWorkLane({
            id: otherLaneId,
            state: "testing",
            worktreePath: "/tmp/other",
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(metaConflict, "already owned by lane");

      const invalidateConflict = yield* decideOrchestrationCommand({
        command: {
          type: "lane.completion.invalidate",
          commandId: CommandId.make("cmd-invalidate-exclusive"),
          laneId: otherLaneId,
          reason: "reopen",
          invalidatedAt: LATER,
        },
        readModel: makeReadModel([
          makeWorkLane({
            id: LANE_ID,
            state: "executing",
            worktreePath: WORKTREE,
          }),
          makeWorkLane({
            id: otherLaneId,
            state: "completed",
            worktreePath: WORKTREE,
            completedAt: NOW,
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(invalidateConflict, "already owned by lane");
    }),
  );

  it.effect("allows execution.start re-entry from testing/reviewing/deliverable-ready", () =>
    Effect.gen(function* () {
      for (const state of ["testing", "reviewing", "deliverable-ready"] as const) {
        const decided = asEvents(
          yield* decideOrchestrationCommand({
            command: {
              type: "lane.execution.start",
              commandId: CommandId.make(`cmd-reenter-${state}`),
              laneId: LANE_ID,
              startedAt: NOW,
            },
            readModel: makeReadModel([
              makeWorkLane({
                state,
                sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
                sourceTruthActiveGitOperation: "none",
                sourceTruthOwnershipOverlap: "exclusive",
              }),
            ]),
          }),
        );
        const payload = payloadOf<{ fromState: string; toState: string }>(
          decided[0],
          "lane.state-changed",
        );
        expect(payload.fromState).toBe(state);
        expect(payload.toState).toBe("executing");
      }
    }),
  );

  it.effect("rejects execution.start when preflight gate fields are unsafe", () =>
    Effect.gen(function* () {
      const overlap = yield* decideOrchestrationCommand({
        command: {
          type: "lane.execution.start",
          commandId: CommandId.make("cmd-overlap"),
          laneId: LANE_ID,
          startedAt: NOW,
        },
        readModel: makeReadModel([
          makeWorkLane({
            state: "planned",
            sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
            sourceTruthOwnershipOverlap: "overlap",
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(overlap, "ownership overlap is 'overlap'");

      const gitOp = yield* decideOrchestrationCommand({
        command: {
          type: "lane.execution.start",
          commandId: CommandId.make("cmd-rebase"),
          laneId: LANE_ID,
          startedAt: NOW,
        },
        readModel: makeReadModel([
          makeWorkLane({
            state: "planned",
            sourceTruthRevisionId: SourceTruthRevisionId.make("str-1"),
            sourceTruthActiveGitOperation: "rebase",
            sourceTruthOwnershipOverlap: "exclusive",
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(gitOp, "git operation 'rebase' is active");
    }),
  );

  it.effect("rejects duplicate source-truth revision ids and terminal mutations", () =>
    Effect.gen(function* () {
      const revisionId = SourceTruthRevisionId.make("str-dup");
      const duplicateCurrent = yield* decideOrchestrationCommand({
        command: {
          type: "source-truth.preflight.record",
          commandId: CommandId.make("cmd-dup-current"),
          laneId: LANE_ID,
          revision: makeSourceTruthRevision({ id: revisionId }),
          recordedAt: NOW,
        },
        readModel: makeReadModel([
          makeWorkLane({
            state: "planned",
            sourceTruthRevisionId: revisionId,
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(duplicateCurrent, "already current");

      const otherLaneId = WorkLaneId.make("lane-2");
      const duplicateExists = yield* decideOrchestrationCommand({
        command: {
          type: "source-truth.preflight.record",
          commandId: CommandId.make("cmd-dup-exists"),
          laneId: LANE_ID,
          revision: makeSourceTruthRevision({ id: revisionId }),
          recordedAt: NOW,
        },
        readModel: makeReadModel([
          makeWorkLane({
            id: LANE_ID,
            state: "planned",
            sourceTruthRevisionId: SourceTruthRevisionId.make("str-other"),
          }),
          makeWorkLane({
            id: otherLaneId,
            state: "queued",
            sourceTruthRevisionId: revisionId,
          }),
        ]),
      }).pipe(Effect.flip);
      expectInvariant(duplicateExists, "already exists");

      for (const state of ["completed", "cancelled", "superseded"] as const) {
        const terminalMeta = yield* decideOrchestrationCommand({
          command: {
            type: "lane.meta.update",
            commandId: CommandId.make(`cmd-terminal-meta-${state}`),
            laneId: LANE_ID,
            title: "nope",
            updatedAt: LATER,
          },
          readModel: makeReadModel([makeWorkLane({ state })]),
        }).pipe(Effect.flip);
        expectInvariant(terminalMeta, "is terminal");
      }
    }),
  );

  it.effect("rejects acceptance criteria whose laneId does not match create", () =>
    Effect.gen(function* () {
      const error = yield* decideOrchestrationCommand({
        command: {
          type: "lane.create",
          commandId: CommandId.make("cmd-bad-criterion"),
          laneId: LANE_ID,
          projectId: PROJECT_ID,
          title: "Lane",
          taskContract: makeTaskContract(),
          priority: "normal",
          classification: "substantial",
          environmentId: ENV_ID,
          createdAt: NOW,
          acceptanceCriteria: [
            {
              id: AcceptanceCriterionId.make("crit-1"),
              laneId: WorkLaneId.make("lane-other"),
              description: "wrong lane",
              category: "correctness",
              required: true,
              status: "pending",
              supportingReceiptIds: [],
            },
          ],
        },
        readModel: makeReadModel(),
      }).pipe(Effect.flip);
      expectInvariant(error, "does not match lane");
    }),
  );
});
