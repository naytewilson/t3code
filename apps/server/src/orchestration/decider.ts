import {
  BlockerId,
  EventId,
  isWorkLaneTerminalState,
  isWorkLaneWorktreeOwningState,
  WORK_LANE_EXECUTION_START_STATES,
  WORK_LANE_PLAN_ACTIVATION_STATES,
  type OrchestrationCommand,
  type OrchestrationEvent,
  type OrchestrationReadModel,
  type WorkLane,
  type WorkLaneId,
  type WorkLaneState,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import type * as PlatformError from "effect/PlatformError";

import { OrchestrationCommandInvariantError } from "./Errors.ts";
import {
  listThreadsByProjectId,
  requireActiveProjectWorkspaceRootAbsent,
  requireLane,
  requireLaneAbsent,
  requireProject,
  requireProjectAbsent,
  requireThread,
  requireThreadArchived,
  requireThreadAbsent,
  requireThreadNotArchived,
  requireWorktreeExclusive,
} from "./commandInvariants.ts";
import { projectEvent } from "./projector.ts";
import {
  isAllowedWorkLaneTransition,
  isAllowedWorkLaneSupersede,
  requireAllowedWorkLaneTransition,
} from "./workLaneTransitions.ts";

const nowIso = Effect.map(DateTime.now, DateTime.formatIso);

// Session adoption takes seconds; a user message still unadopted after this
// window is a failed/stale start, not pending work. Mirrors the client's
// QUEUED_TURN_START_GRACE_MS in client-runtime threadSettled.ts.
const QUEUED_TURN_START_GRACE_MS = 2 * 60 * 1_000;

/**
 * Blocked-on-you work derived from the thread's retained activities: an
 * approval or user-input request with no later resolution for the same
 * requestId. The server-side twin of the shell's hasPendingApprovals /
 * hasPendingUserInput flags, which the decider read model does not carry.
 * The clearing rules MUST match ProjectionPipeline's pending accounting —
 * resolved activities always clear, respond.failed clears only when the
 * failure detail marks the request stale/unknown — or settle would be
 * rejected on threads whose shell flags read as clear.
 */
function isStaleRequestFailureDetail(payload: Record<string, unknown> | null): boolean {
  const detail = typeof payload?.detail === "string" ? payload.detail.toLowerCase() : null;
  if (detail === null) return false;
  return (
    detail.includes("stale pending approval request") ||
    detail.includes("unknown pending approval request") ||
    detail.includes("unknown pending permission request") ||
    detail.includes("stale pending user-input request") ||
    detail.includes("unknown pending user-input request") ||
    detail.includes("unknown pending user input request") ||
    detail.includes("unknown pending codex user input request")
  );
}

// Scans the read model's activities, which the projector caps at the most
// recent 500. That bound is safe here: an OPEN approval/user-input request
// blocks its turn, so the thread cannot accumulate hundreds of later
// activities while one is outstanding — a request that has scrolled out of
// the window is one whose turn kept running, i.e. it was resolved or went
// stale. (The projection pipeline's pendingApprovalCount reads the same
// capped stream and stays consistent with this view.)
function hasOpenBlockingRequest(thread: {
  readonly activities: ReadonlyArray<{ readonly kind: string; readonly payload: unknown }>;
}): boolean {
  const openRequestIds = new Set<string>();
  for (const activity of thread.activities) {
    const payload =
      typeof activity.payload === "object" && activity.payload !== null
        ? (activity.payload as Record<string, unknown>)
        : null;
    const requestId = typeof payload?.requestId === "string" ? payload.requestId : null;
    if (requestId === null) continue;
    if (activity.kind === "approval.requested" || activity.kind === "user-input.requested") {
      openRequestIds.add(requestId);
    } else if (activity.kind === "approval.resolved" || activity.kind === "user-input.resolved") {
      openRequestIds.delete(requestId);
    } else if (
      (activity.kind === "provider.approval.respond.failed" ||
        activity.kind === "provider.user-input.respond.failed") &&
      isStaleRequestFailureDetail(payload)
    ) {
      openRequestIds.delete(requestId);
    }
  }
  return openRequestIds.size > 0;
}

/**
 * A queued turn start — a user message no turn has picked up yet — is work
 * in flight even though session is still null (turn.start emits
 * message-sent + turn-start-requested; the session arrives later). Detection
 * mirrors the client's hasQueuedTurnStart: the newest user message is
 * strictly newer than every latestTurn timestamp (adoption stamps the new
 * turn's requestedAt with the message time, clearing this), and only within
 * the adoption grace window — historical threads whose last user message
 * postdates their turn timestamps (older-server data, mid-turn messages)
 * must not be blocked forever. A failed session start (status "error")
 * clears the block immediately.
 *
 * The age check is bounded on BOTH sides: message timestamps are
 * client-supplied, so a client clock ahead of the server yields a negative
 * age. Without the lower bound that negative age satisfies `<= grace` for
 * as long as the skew lasts, extending the block far past the intended two
 * minutes.
 */
function threadHasQueuedTurnStart(
  thread: {
    readonly messages: ReadonlyArray<{ readonly role: string; readonly createdAt: string }>;
    readonly latestTurn: {
      readonly requestedAt: string;
      readonly startedAt: string | null;
      readonly completedAt: string | null;
    } | null;
    readonly session: { readonly status: string } | null;
  },
  occurredAt: string,
): boolean {
  const latestUserMessageAtMs = thread.messages.reduce(
    (latest, message) =>
      message.role === "user" ? Math.max(latest, Date.parse(message.createdAt)) : latest,
    Number.NEGATIVE_INFINITY,
  );
  const latestTurnAtMs =
    thread.latestTurn === null
      ? Number.NEGATIVE_INFINITY
      : Math.max(
          ...[
            thread.latestTurn.requestedAt,
            thread.latestTurn.startedAt,
            thread.latestTurn.completedAt,
          ].map((candidate) =>
            candidate == null ? Number.NEGATIVE_INFINITY : Date.parse(candidate),
          ),
        );
  const queuedAgeMs = Date.parse(occurredAt) - latestUserMessageAtMs;
  return (
    thread.session?.status !== "error" &&
    Number.isFinite(latestUserMessageAtMs) &&
    latestUserMessageAtMs > latestTurnAtMs &&
    Math.abs(queuedAgeMs) <= QUEUED_TURN_START_GRACE_MS
  );
}

function withEventBase(
  input: Pick<OrchestrationCommand, "commandId"> & {
    readonly aggregateKind: OrchestrationEvent["aggregateKind"];
    readonly aggregateId: OrchestrationEvent["aggregateId"];
    readonly occurredAt: string;
    readonly metadata?: OrchestrationEvent["metadata"];
  },
): Effect.Effect<
  Omit<OrchestrationEvent, "sequence" | "type" | "payload">,
  PlatformError.PlatformError,
  Crypto.Crypto
> {
  return Crypto.Crypto.pipe(
    Effect.flatMap((crypto) =>
      crypto.randomUUIDv4.pipe(
        Effect.map((eventId) => ({
          eventId: EventId.make(eventId),
          aggregateKind: input.aggregateKind,
          aggregateId: input.aggregateId,
          occurredAt: input.occurredAt,
          commandId: input.commandId,
          causationEventId: null,
          correlationId: input.commandId,
          metadata: input.metadata ?? {},
        })),
      ),
    ),
  );
}

function buildLaneCreated(input: {
  readonly command: Extract<OrchestrationCommand, { type: "lane.create" }>;
}): WorkLane {
  const primaryThreadId = input.command.primaryThreadId ?? null;
  return {
    id: input.command.laneId,
    projectId: input.command.projectId,
    title: input.command.title,
    taskContract: input.command.taskContract,
    state: "queued",
    priority: input.command.priority,
    classification: input.command.classification,
    environmentId: input.command.environmentId,
    repositoryIdentity: input.command.repositoryIdentity ?? null,
    baseRef: input.command.baseRef ?? null,
    branch: input.command.branch ?? null,
    worktreePath: input.command.worktreePath ?? null,
    ownerAssignmentId: null,
    advisorAssignmentIds: [],
    verifierAssignmentIds: [],
    sourceTruthRevisionId: null,
    sourceTruthActiveGitOperation: "none",
    sourceTruthOwnershipOverlap: "unknown",
    activePlanRevisionId: null,
    acceptanceCriterionIds: (input.command.acceptanceCriteria ?? []).map(
      (criterion) => criterion.id,
    ),
    requiredReceiptKinds: [],
    deliverableIds: [],
    blockerIds: [],
    primaryThreadId,
    importedThreadId: null,
    threadIds: primaryThreadId === null ? [] : [primaryThreadId],
    legacyExecutorRef: null,
    resumeState: null,
    supersedingLaneId: null,
    createdAt: input.command.createdAt,
    updatedAt: input.command.createdAt,
    completedAt: null,
  };
}

function requireLaneMutable(input: {
  readonly command: OrchestrationCommand;
  readonly lane: WorkLane;
}): Effect.Effect<void, OrchestrationCommandInvariantError> {
  if (!isWorkLaneTerminalState(input.lane.state)) {
    return Effect.void;
  }
  return Effect.fail(
    new OrchestrationCommandInvariantError({
      commandType: input.command.type,
      detail: `Lane '${input.lane.id}' is terminal ('${input.lane.state}') and cannot accept '${input.command.type}'.`,
    }),
  );
}

type PlannedOrchestrationEvent = Omit<OrchestrationEvent, "sequence">;

const emitLaneStateChanged = Effect.fn("emitLaneStateChanged")(function* ({
  command,
  laneId,
  fromState,
  toState,
  occurredAt,
  resumeState = null,
  reason,
  blockerId,
  supersedingLaneId,
}: {
  readonly command: OrchestrationCommand;
  readonly laneId: WorkLane["id"];
  readonly fromState: WorkLaneState;
  readonly toState: WorkLaneState;
  readonly occurredAt: string;
  readonly resumeState?: WorkLaneState | null;
  readonly reason?: string;
  readonly blockerId?: BlockerId;
  readonly supersedingLaneId?: WorkLaneId;
}): Effect.fn.Return<
  PlannedOrchestrationEvent,
  OrchestrationCommandInvariantError | PlatformError.PlatformError,
  Crypto.Crypto
> {
  return {
    ...(yield* withEventBase({
      aggregateKind: "lane",
      aggregateId: laneId,
      occurredAt,
      commandId: command.commandId,
    })),
    type: "lane.state-changed" as const,
    payload: {
      laneId,
      fromState,
      toState,
      resumeState,
      ...(reason !== undefined ? { reason } : {}),
      ...(blockerId !== undefined ? { blockerId } : {}),
      ...(supersedingLaneId !== undefined ? { supersedingLaneId } : {}),
      updatedAt: occurredAt,
    },
  };
});

type DecideOrchestrationCommandResult =
  | PlannedOrchestrationEvent
  | ReadonlyArray<PlannedOrchestrationEvent>;

const decideCommandSequence = Effect.fn("decideCommandSequence")(function* ({
  commands,
  readModel,
}: {
  readonly commands: ReadonlyArray<OrchestrationCommand>;
  readonly readModel: OrchestrationReadModel;
}): Effect.fn.Return<
  ReadonlyArray<PlannedOrchestrationEvent>,
  OrchestrationCommandInvariantError | PlatformError.PlatformError,
  Crypto.Crypto
> {
  let nextReadModel = readModel;
  let nextSequence = readModel.snapshotSequence;
  const plannedEvents: PlannedOrchestrationEvent[] = [];

  for (const nextCommand of commands) {
    const decided = yield* decideOrchestrationCommand({
      command: nextCommand,
      readModel: nextReadModel,
    });
    const nextEvents = Array.isArray(decided) ? decided : [decided];
    for (const nextEvent of nextEvents) {
      plannedEvents.push(nextEvent);
      nextSequence += 1;
      nextReadModel = yield* projectEvent(nextReadModel, {
        ...nextEvent,
        sequence: nextSequence,
      }).pipe(Effect.orDie);
    }
  }

  return plannedEvents;
});

export const decideOrchestrationCommand = Effect.fn("decideOrchestrationCommand")(function* ({
  command,
  readModel,
}: {
  readonly command: OrchestrationCommand;
  readonly readModel: OrchestrationReadModel;
}): Effect.fn.Return<
  DecideOrchestrationCommandResult,
  OrchestrationCommandInvariantError | PlatformError.PlatformError,
  Crypto.Crypto
> {
  switch (command.type) {
    case "project.create": {
      yield* requireProjectAbsent({
        readModel,
        command,
        projectId: command.projectId,
      });
      yield* requireActiveProjectWorkspaceRootAbsent({
        readModel,
        command,
        workspaceRoot: command.workspaceRoot,
        exceptProjectId: command.projectId,
      });

      return {
        ...(yield* withEventBase({
          aggregateKind: "project",
          aggregateId: command.projectId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "project.created",
        payload: {
          projectId: command.projectId,
          title: command.title,
          workspaceRoot: command.workspaceRoot,
          defaultModelSelection: command.defaultModelSelection ?? null,
          scripts: [],
          createdAt: command.createdAt,
          updatedAt: command.createdAt,
        },
      };
    }

    case "project.meta.update": {
      yield* requireProject({
        readModel,
        command,
        projectId: command.projectId,
      });
      if (command.workspaceRoot !== undefined) {
        yield* requireActiveProjectWorkspaceRootAbsent({
          readModel,
          command,
          workspaceRoot: command.workspaceRoot,
          exceptProjectId: command.projectId,
        });
      }
      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "project",
          aggregateId: command.projectId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "project.meta-updated",
        payload: {
          projectId: command.projectId,
          ...(command.title !== undefined ? { title: command.title } : {}),
          ...(command.workspaceRoot !== undefined ? { workspaceRoot: command.workspaceRoot } : {}),
          ...(command.defaultModelSelection !== undefined
            ? { defaultModelSelection: command.defaultModelSelection }
            : {}),
          ...(command.scripts !== undefined ? { scripts: command.scripts } : {}),
          updatedAt: occurredAt,
        },
      };
    }

    case "project.delete": {
      yield* requireProject({
        readModel,
        command,
        projectId: command.projectId,
      });
      const activeThreads = listThreadsByProjectId(readModel, command.projectId).filter(
        (thread) => thread.deletedAt === null,
      );
      if (activeThreads.length > 0 && command.force !== true) {
        return yield* new OrchestrationCommandInvariantError({
          commandType: command.type,
          detail: `Project '${command.projectId}' is not empty and cannot be deleted without force=true.`,
        });
      }
      if (activeThreads.length > 0) {
        return yield* decideCommandSequence({
          readModel,
          commands: [
            ...activeThreads.map(
              (thread): Extract<OrchestrationCommand, { type: "thread.delete" }> => ({
                type: "thread.delete",
                commandId: command.commandId,
                threadId: thread.id,
              }),
            ),
            {
              type: "project.delete",
              commandId: command.commandId,
              projectId: command.projectId,
            },
          ],
        });
      }

      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "project",
          aggregateId: command.projectId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "project.deleted" as const,
        payload: {
          projectId: command.projectId,
          deletedAt: occurredAt,
        },
      };
    }

    case "thread.create": {
      yield* requireProject({
        readModel,
        command,
        projectId: command.projectId,
      });
      yield* requireThreadAbsent({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.created",
        payload: {
          threadId: command.threadId,
          projectId: command.projectId,
          title: command.title,
          modelSelection: command.modelSelection,
          runtimeMode: command.runtimeMode,
          interactionMode: command.interactionMode,
          branch: command.branch,
          worktreePath: command.worktreePath,
          createdAt: command.createdAt,
          updatedAt: command.createdAt,
        },
      };
    }

    case "thread.delete": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.deleted",
        payload: {
          threadId: command.threadId,
          deletedAt: occurredAt,
        },
      };
    }

    case "thread.archive": {
      yield* requireThreadNotArchived({
        readModel,
        command,
        threadId: command.threadId,
      });
      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.archived",
        payload: {
          threadId: command.threadId,
          archivedAt: occurredAt,
          updatedAt: occurredAt,
        },
      };
    }

    case "thread.unarchive": {
      yield* requireThreadArchived({
        readModel,
        command,
        threadId: command.threadId,
      });
      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.unarchived",
        payload: {
          threadId: command.threadId,
          updatedAt: occurredAt,
        },
      };
    }

    case "thread.settle": {
      const thread = yield* requireThreadNotArchived({
        readModel,
        command,
        threadId: command.threadId,
      });
      // Server-side twin of the client's canSettle session check: a stale
      // or raced client must not settle a thread whose session is coming
      // alive or working.
      if (thread.session?.status === "starting" || thread.session?.status === "running") {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `thread ${command.threadId} has an active session and cannot be settled`,
          }),
        );
      }
      // Pending approval / user-input requests are blocked-on-you work: a
      // raced or stale client must not park them behind a settled override
      // that would surface only after the request resolves.
      if (hasOpenBlockingRequest(thread)) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `thread ${command.threadId} has a pending approval or user-input request and cannot be settled`,
          }),
        );
      }
      const occurredAt = yield* nowIso;
      // Settling inside the adoption window would hide just-requested work.
      if (threadHasQueuedTurnStart(thread, occurredAt)) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `thread ${command.threadId} has a queued turn start and cannot be settled`,
          }),
        );
      }
      // Settling an already-settled thread re-emits with the original
      // settledAt: the engine rejects zero-event commands, and bulk-settle /
      // double-click must stay silent no-ops rather than surface errors.
      const alreadySettled = thread.settledOverride === "settled" && thread.settledAt !== null;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.settled",
        payload: {
          threadId: command.threadId,
          settledAt: alreadySettled ? thread.settledAt : occurredAt,
          // A re-emission is a projected no-op: keep the existing updatedAt
          // so duplicate settles neither rewind nor churn ordering. A fresh
          // settle stamps the command time.
          updatedAt: alreadySettled ? thread.updatedAt : occurredAt,
        },
      };
    }

    case "thread.unsettle": {
      const thread = yield* requireThreadNotArchived({
        readModel,
        command,
        threadId: command.threadId,
      });
      // Idempotent by re-emission (see thread.settle): reducing the event a
      // second time lands on the same override state. A re-emission keeps
      // the existing updatedAt so duplicates do not churn ordering.
      const alreadyPinnedActive = thread.settledOverride === "active";
      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.unsettled",
        payload: {
          threadId: command.threadId,
          reason: command.reason,
          updatedAt: alreadyPinnedActive ? thread.updatedAt : occurredAt,
        },
      };
    }

    case "thread.snooze": {
      const thread = yield* requireThreadNotArchived({
        readModel,
        command,
        threadId: command.threadId,
      });
      const occurredAt = yield* nowIso;
      // A wake time in the past would create a thread that is snoozed and
      // woken at once — the row would never leave the inbox but still carry
      // snooze state. Reject instead of silently normalizing. The negated
      // comparison also catches unparseable wake times (IsoDateTime is
      // structurally just a string): NaN fails every comparison, and an
      // unparseable snoozedUntil must never persist.
      if (!(Date.parse(command.snoozedUntil) > Date.parse(occurredAt))) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `thread ${command.threadId} snooze wake time ${command.snoozedUntil} is not in the future`,
          }),
        );
      }
      // Blocked-on-you work must not be snoozed away: a pending approval or
      // user-input request is the agent waiting on the user, and hiding it
      // defeats the request. (A running session IS snoozable — snooze only
      // affects visibility, never the agent.)
      if (hasOpenBlockingRequest(thread)) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `thread ${command.threadId} has a pending approval or user-input request and cannot be snoozed`,
          }),
        );
      }
      // A queued turn start — a user message no turn has adopted yet — is
      // invisible pending work: no session, no pending flags. Snoozing in
      // that window would hide a just-requested turn exactly the way settle
      // would.
      if (threadHasQueuedTurnStart(thread, occurredAt)) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `thread ${command.threadId} has a queued turn start and cannot be snoozed`,
          }),
        );
      }
      // Re-snoozing an already-snoozed thread to the SAME wake time is a
      // duplicate (double-click, raced clients): re-emit with the original
      // timestamps so the projection is a no-op. A different wake time is a
      // real change and stamps fresh.
      const existingSnoozedAt =
        thread.snoozedUntil === command.snoozedUntil && thread.snoozedAt != null
          ? thread.snoozedAt
          : null;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.snoozed",
        payload: {
          threadId: command.threadId,
          snoozedUntil: command.snoozedUntil,
          snoozedAt: existingSnoozedAt ?? occurredAt,
          updatedAt: existingSnoozedAt !== null ? thread.updatedAt : occurredAt,
        },
      };
    }

    case "thread.unsnooze": {
      const thread = yield* requireThreadNotArchived({
        readModel,
        command,
        threadId: command.threadId,
      });
      // Idempotent by re-emission (see thread.settle): waking a thread that
      // is not snoozed lands on the same null state without churning
      // updatedAt.
      const alreadyAwake = thread.snoozedUntil == null;
      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.unsnoozed",
        payload: {
          threadId: command.threadId,
          reason: command.reason,
          updatedAt: alreadyAwake ? thread.updatedAt : occurredAt,
        },
      };
    }

    case "thread.meta.update": {
      const thread = yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      const branch =
        command.branch !== undefined &&
        command.expectedBranch !== undefined &&
        thread.branch !== command.expectedBranch
          ? thread.branch
          : command.branch;
      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.meta-updated",
        payload: {
          threadId: command.threadId,
          ...(command.title !== undefined ? { title: command.title } : {}),
          ...(command.modelSelection !== undefined
            ? { modelSelection: command.modelSelection }
            : {}),
          ...(branch !== undefined ? { branch } : {}),
          ...(command.worktreePath !== undefined ? { worktreePath: command.worktreePath } : {}),
          updatedAt: occurredAt,
        },
      };
    }

    case "thread.runtime-mode.set": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.runtime-mode-set",
        payload: {
          threadId: command.threadId,
          runtimeMode: command.runtimeMode,
          updatedAt: occurredAt,
        },
      };
    }

    case "thread.interaction-mode.set": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      const occurredAt = yield* nowIso;
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt,
          commandId: command.commandId,
        })),
        type: "thread.interaction-mode-set",
        payload: {
          threadId: command.threadId,
          interactionMode: command.interactionMode,
          updatedAt: occurredAt,
        },
      };
    }

    case "thread.turn.start": {
      const targetThread = yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      const sourceProposedPlan = command.sourceProposedPlan;
      const sourceThread = sourceProposedPlan
        ? yield* requireThread({
            readModel,
            command,
            threadId: sourceProposedPlan.threadId,
          })
        : null;
      const sourcePlan =
        sourceProposedPlan && sourceThread
          ? sourceThread.proposedPlans.find((entry) => entry.id === sourceProposedPlan.planId)
          : null;
      if (sourceProposedPlan && !sourcePlan) {
        return yield* new OrchestrationCommandInvariantError({
          commandType: command.type,
          detail: `Proposed plan '${sourceProposedPlan.planId}' does not exist on thread '${sourceProposedPlan.threadId}'.`,
        });
      }
      if (sourceThread && sourceThread.projectId !== targetThread.projectId) {
        return yield* new OrchestrationCommandInvariantError({
          commandType: command.type,
          detail: `Proposed plan '${sourceProposedPlan?.planId}' belongs to thread '${sourceThread.id}' in a different project.`,
        });
      }
      const userMessageEvent: Omit<OrchestrationEvent, "sequence"> = {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.message-sent",
        payload: {
          threadId: command.threadId,
          messageId: command.message.messageId,
          role: "user",
          text: command.message.text,
          attachments: command.message.attachments,
          turnId: null,
          streaming: false,
          createdAt: command.createdAt,
          updatedAt: command.createdAt,
        },
      };
      const turnStartRequestedEvent: Omit<OrchestrationEvent, "sequence"> = {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        causationEventId: userMessageEvent.eventId,
        type: "thread.turn-start-requested",
        payload: {
          threadId: command.threadId,
          messageId: command.message.messageId,
          ...(command.modelSelection !== undefined
            ? { modelSelection: command.modelSelection }
            : {}),
          ...(command.titleSeed !== undefined ? { titleSeed: command.titleSeed } : {}),
          runtimeMode: targetThread.runtimeMode,
          interactionMode: targetThread.interactionMode,
          ...(sourceProposedPlan !== undefined ? { sourceProposedPlan } : {}),
          createdAt: command.createdAt,
        },
      };
      // Real activity resets ANY override: it wakes an explicitly settled
      // thread, and it clears a keep-active pin back to neutral so the
      // thread can auto-settle again after this burst of work goes stale.
      // A snooze clears the same way — sending a message to a snoozed
      // thread is the user re-engaging, so the return ticket is spent.
      const lifecycleResetEvents: Array<Omit<OrchestrationEvent, "sequence">> = [];
      if (targetThread.settledOverride !== null) {
        lifecycleResetEvents.push({
          ...(yield* withEventBase({
            aggregateKind: "thread",
            aggregateId: command.threadId,
            occurredAt: command.createdAt,
            commandId: command.commandId,
          })),
          type: "thread.unsettled",
          payload: {
            threadId: command.threadId,
            reason: "activity",
            updatedAt: command.createdAt,
          },
        });
      }
      if (targetThread.snoozedUntil != null) {
        lifecycleResetEvents.push({
          ...(yield* withEventBase({
            aggregateKind: "thread",
            aggregateId: command.threadId,
            occurredAt: command.createdAt,
            commandId: command.commandId,
          })),
          type: "thread.unsnoozed",
          payload: {
            threadId: command.threadId,
            reason: "activity",
            updatedAt: command.createdAt,
          },
        });
      }
      return [...lifecycleResetEvents, userMessageEvent, turnStartRequestedEvent];
    }

    case "thread.turn.interrupt": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.turn-interrupt-requested",
        payload: {
          threadId: command.threadId,
          ...(command.turnId !== undefined ? { turnId: command.turnId } : {}),
          createdAt: command.createdAt,
        },
      };
    }

    case "thread.approval.respond": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
          metadata: {
            requestId: command.requestId,
          },
        })),
        type: "thread.approval-response-requested",
        payload: {
          threadId: command.threadId,
          requestId: command.requestId,
          decision: command.decision,
          createdAt: command.createdAt,
        },
      };
    }

    case "thread.user-input.respond": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
          metadata: {
            requestId: command.requestId,
          },
        })),
        type: "thread.user-input-response-requested",
        payload: {
          threadId: command.threadId,
          requestId: command.requestId,
          answers: command.answers,
          createdAt: command.createdAt,
        },
      };
    }

    case "thread.checkpoint.revert": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.checkpoint-revert-requested",
        payload: {
          threadId: command.threadId,
          turnCount: command.turnCount,
          createdAt: command.createdAt,
        },
      };
    }

    case "thread.session.stop": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.session-stop-requested",
        payload: {
          threadId: command.threadId,
          createdAt: command.createdAt,
        },
      };
    }

    case "thread.session.set": {
      const thread = yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      const sessionSetEvent: Omit<OrchestrationEvent, "sequence"> = {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
          metadata: {},
        })),
        type: "thread.session-set",
        payload: {
          threadId: command.threadId,
          session: command.session,
        },
      };
      // Only a session coming alive is activity worth waking a settled thread
      // for — status writes like ready/stopped/error arrive after the fact and
      // must not fight a user's explicit settle. Snooze is deliberately NOT
      // cleared here: snooze never pauses the agent, so its session starting
      // or erroring is not the user re-engaging. Blocked/failed work still
      // surfaces immediately — effectiveSnoozed refuses to classify a thread
      // with a raised hand (approval / input / failure / fresh completion)
      // as snoozed, without spending the return ticket.
      const isSessionActivity =
        command.session.status === "starting" || command.session.status === "running";
      // Real activity resets ANY override (settled wakes, active unpins).
      if (thread.settledOverride === null || !isSessionActivity) {
        return sessionSetEvent;
      }
      const unsettledEvent: Omit<OrchestrationEvent, "sequence"> = {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.unsettled",
        payload: {
          threadId: command.threadId,
          reason: "activity",
          updatedAt: command.createdAt,
        },
      };
      return [unsettledEvent, sessionSetEvent];
    }

    case "thread.message.assistant.delta": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.message-sent",
        payload: {
          threadId: command.threadId,
          messageId: command.messageId,
          role: "assistant",
          text: command.delta,
          turnId: command.turnId ?? null,
          streaming: true,
          createdAt: command.createdAt,
          updatedAt: command.createdAt,
        },
      };
    }

    case "thread.message.assistant.complete": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.message-sent",
        payload: {
          threadId: command.threadId,
          messageId: command.messageId,
          role: "assistant",
          text: "",
          turnId: command.turnId ?? null,
          streaming: false,
          createdAt: command.createdAt,
          updatedAt: command.createdAt,
        },
      };
    }

    case "thread.proposed-plan.upsert": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.proposed-plan-upserted",
        payload: {
          threadId: command.threadId,
          proposedPlan: command.proposedPlan,
        },
      };
    }

    case "thread.turn.diff.complete": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.turn-diff-completed",
        payload: {
          threadId: command.threadId,
          turnId: command.turnId,
          checkpointTurnCount: command.checkpointTurnCount,
          checkpointRef: command.checkpointRef,
          status: command.status,
          files: command.files,
          assistantMessageId: command.assistantMessageId ?? null,
          completedAt: command.completedAt,
        },
      };
    }

    case "thread.revert.complete": {
      yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      return {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.reverted",
        payload: {
          threadId: command.threadId,
          turnCount: command.turnCount,
        },
      };
    }

    case "thread.activity.append": {
      const thread = yield* requireThread({
        readModel,
        command,
        threadId: command.threadId,
      });
      const requestId =
        typeof command.activity.payload === "object" &&
        command.activity.payload !== null &&
        "requestId" in command.activity.payload &&
        typeof (command.activity.payload as { requestId?: unknown }).requestId === "string"
          ? ((command.activity.payload as { requestId: string })
              .requestId as OrchestrationEvent["metadata"]["requestId"])
          : undefined;
      const activityAppendedEvent: Omit<OrchestrationEvent, "sequence"> = {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
          ...(requestId !== undefined ? { metadata: { requestId } } : {}),
        })),
        type: "thread.activity-appended",
        payload: {
          threadId: command.threadId,
          activity: command.activity,
        },
      };
      // An approval or user-input request is blocked-on-you work — it must
      // never stay hidden inside a settled slim row.
      const wakesSettledThread =
        command.activity.kind === "approval.requested" ||
        command.activity.kind === "user-input.requested";
      // Real activity resets ANY override (settled wakes, active unpins).
      if (thread.settledOverride === null || !wakesSettledThread) {
        return activityAppendedEvent;
      }
      const unsettledEvent: Omit<OrchestrationEvent, "sequence"> = {
        ...(yield* withEventBase({
          aggregateKind: "thread",
          aggregateId: command.threadId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "thread.unsettled",
        payload: {
          threadId: command.threadId,
          reason: "activity",
          updatedAt: command.createdAt,
        },
      };
      return [unsettledEvent, activityAppendedEvent];
    }

    case "lane.create": {
      yield* requireProject({
        readModel,
        command,
        projectId: command.projectId,
      });
      yield* requireLaneAbsent({
        readModel,
        command,
        laneId: command.laneId,
      });
      const acceptanceCriteria = command.acceptanceCriteria ?? [];
      for (const criterion of acceptanceCriteria) {
        if (criterion.laneId !== command.laneId) {
          return yield* Effect.fail(
            new OrchestrationCommandInvariantError({
              commandType: command.type,
              detail: `Acceptance criterion '${criterion.id}' laneId '${criterion.laneId}' does not match lane '${command.laneId}'.`,
            }),
          );
        }
      }
      const lane = buildLaneCreated({ command });
      if (
        lane.worktreePath !== null &&
        isWorkLaneWorktreeOwningState(lane.state)
      ) {
        yield* requireWorktreeExclusive({
          readModel,
          command,
          worktreePath: lane.worktreePath,
          exceptLaneId: command.laneId,
        });
      }
      return {
        ...(yield* withEventBase({
          aggregateKind: "lane",
          aggregateId: command.laneId,
          occurredAt: command.createdAt,
          commandId: command.commandId,
        })),
        type: "lane.created" as const,
        payload: {
          lane,
          acceptanceCriteria,
        },
      };
    }

    case "lane.preflight.request": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "preflight",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "preflight",
        occurredAt: command.requestedAt,
      });
    }

    case "lane.orientation.record": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "oriented",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "oriented",
        occurredAt: command.recordedAt,
      });
    }

    case "lane.plan.propose": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "planned",
      });
      const stateChanged = yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "planned",
        occurredAt: command.proposedAt,
      });
      const planProposed: PlannedOrchestrationEvent = {
        ...(yield* withEventBase({
          aggregateKind: "lane",
          aggregateId: command.laneId,
          occurredAt: command.proposedAt,
          commandId: command.commandId,
        })),
        type: "lane.plan-proposed" as const,
        payload: {
          laneId: command.laneId,
          planRevisionId: command.planRevisionId,
          proposedAt: command.proposedAt,
        },
      };
      return [stateChanged, planProposed];
    }

    case "lane.plan.activate": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireLaneMutable({ command, lane });
      if (
        !(WORK_LANE_PLAN_ACTIVATION_STATES as ReadonlyArray<string>).includes(lane.state)
      ) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' must be in oriented|planned to activate a plan (current: '${lane.state}').`,
          }),
        );
      }
      if (
        lane.activePlanRevisionId !== null &&
        lane.activePlanRevisionId !== command.planRevisionId
      ) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' already has active plan '${lane.activePlanRevisionId}'.`,
          }),
        );
      }
      const planActivated: PlannedOrchestrationEvent = {
        ...(yield* withEventBase({
          aggregateKind: "lane",
          aggregateId: command.laneId,
          occurredAt: command.activatedAt,
          commandId: command.commandId,
        })),
        type: "lane.plan-activated" as const,
        payload: {
          laneId: command.laneId,
          planRevisionId: command.planRevisionId,
          activatedAt: command.activatedAt,
          updatedAt: command.activatedAt,
        },
      };
      if (lane.state === "oriented") {
        yield* requireAllowedWorkLaneTransition({
          commandType: command.type,
          from: lane.state,
          to: "planned",
        });
        const stateChanged = yield* emitLaneStateChanged({
          command,
          laneId: command.laneId,
          fromState: lane.state,
          toState: "planned",
          occurredAt: command.activatedAt,
        });
        return [planActivated, stateChanged];
      }
      return planActivated;
    }

    case "lane.execution.start": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      if (
        !(WORK_LANE_EXECUTION_START_STATES as ReadonlyArray<string>).includes(lane.state)
      ) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' must be in planned|testing|reviewing|deliverable-ready to start execution (current: '${lane.state}').`,
          }),
        );
      }
      if (lane.sourceTruthRevisionId === null) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' requires a source-truth revision before execution.`,
          }),
        );
      }
      if (lane.classification === "substantial" && lane.worktreePath === null) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Substantial lane '${command.laneId}' requires a worktree path before execution.`,
          }),
        );
      }
      if (
        lane.sourceTruthOwnershipOverlap !== "exclusive" &&
        lane.sourceTruthOwnershipOverlap !== "not-applicable"
      ) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' requires exclusive or not-applicable source-truth ownership before execution (current: '${lane.sourceTruthOwnershipOverlap}').`,
          }),
        );
      }
      if (lane.sourceTruthActiveGitOperation !== "none") {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' cannot execute while git operation '${lane.sourceTruthActiveGitOperation}' is active.`,
          }),
        );
      }
      yield* requireWorktreeExclusive({
        readModel,
        command,
        worktreePath: lane.worktreePath,
        exceptLaneId: command.laneId,
      });
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "executing",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "executing",
        occurredAt: command.startedAt,
      });
    }

    case "lane.testing.start": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "testing",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "testing",
        occurredAt: command.startedAt,
      });
    }

    case "lane.review.request": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "reviewing",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "reviewing",
        occurredAt: command.requestedAt,
      });
    }

    case "lane.deliverable.register": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      const registered: PlannedOrchestrationEvent = {
        ...(yield* withEventBase({
          aggregateKind: "lane",
          aggregateId: command.laneId,
          occurredAt: command.registeredAt,
          commandId: command.commandId,
        })),
        type: "lane.deliverable-registered" as const,
        payload: {
          laneId: command.laneId,
          deliverableId: command.deliverableId,
          registeredAt: command.registeredAt,
          updatedAt: command.registeredAt,
        },
      };
      if (lane.state === "deliverable-ready") {
        return registered;
      }
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "deliverable-ready",
      });
      const stateChanged = yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "deliverable-ready",
        occurredAt: command.registeredAt,
      });
      return [stateChanged, registered];
    }

    case "lane.completion.request": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireLaneMutable({ command, lane });
      if (lane.state !== "deliverable-ready") {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' must be deliverable-ready before completion (current: '${lane.state}').`,
          }),
        );
      }
      if (lane.activePlanRevisionId === null) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' requires an active plan before completion.`,
          }),
        );
      }
      if (lane.sourceTruthRevisionId === null) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' requires current source truth before completion.`,
          }),
        );
      }
      if (
        lane.sourceTruthActiveGitOperation !== "none" ||
        (lane.sourceTruthOwnershipOverlap !== "exclusive" &&
          lane.sourceTruthOwnershipOverlap !== "not-applicable")
      ) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' cannot complete with an unsafe source-truth gate.`,
          }),
        );
      }
      if (
        lane.taskContract.deliverableRequirement === "required" &&
        lane.deliverableIds.length === 0
      ) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' requires a registered deliverable before completion.`,
          }),
        );
      }
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "completed",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "completed",
        occurredAt: command.requestedAt,
        resumeState: null,
      });
    }

    case "lane.block": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "blocked",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "blocked",
        occurredAt: command.blockedAt,
        resumeState: lane.state,
        ...(command.reason !== undefined ? { reason: command.reason } : {}),
        ...(command.blockerId !== undefined ? { blockerId: command.blockerId } : {}),
      });
    }

    case "lane.unblock": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      if (lane.state !== "blocked") {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' is not blocked (current: '${lane.state}').`,
          }),
        );
      }
      const resumeState = lane.resumeState;
      const toState: WorkLaneState =
        resumeState !== null &&
        !isWorkLaneTerminalState(resumeState) &&
        resumeState !== "blocked"
          ? resumeState
          : "recovery-required";
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState,
        occurredAt: command.unblockedAt,
        resumeState: null,
      });
    }

    case "lane.cancel": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "cancelled",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "cancelled",
        occurredAt: command.cancelledAt,
        resumeState: null,
      });
    }

    case "lane.supersede": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      if (!isAllowedWorkLaneSupersede(lane.state)) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' cannot be superseded from terminal state '${lane.state}'.`,
          }),
        );
      }
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "superseded",
        occurredAt: command.supersededAt,
        resumeState: null,
        ...(command.supersedingLaneId !== undefined
          ? { supersedingLaneId: command.supersedingLaneId }
          : {}),
      });
    }

    case "lane.recovery.request": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      if (lane.state !== "failed" && lane.state !== "recovery-required") {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' recovery is only allowed from 'failed' or 'recovery-required' (current: '${lane.state}').`,
          }),
        );
      }
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "preflight",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "preflight",
        occurredAt: command.requestedAt,
        resumeState: null,
      });
    }

    case "lane.completion.invalidate": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      if (lane.state !== "completed") {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' completion invalidation requires 'completed' state (current: '${lane.state}').`,
          }),
        );
      }
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "recovery-required",
      });
      yield* requireWorktreeExclusive({
        readModel,
        command,
        worktreePath: lane.worktreePath,
        exceptLaneId: command.laneId,
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "recovery-required",
        occurredAt: command.invalidatedAt,
        resumeState: null,
        ...(command.reason !== undefined ? { reason: command.reason } : {}),
      });
    }

    case "lane.fail": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      if (
        lane.state !== "executing" &&
        lane.state !== "testing" &&
        lane.state !== "reviewing"
      ) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Lane '${command.laneId}' can only fail from executing|testing|reviewing (current: '${lane.state}').`,
          }),
        );
      }
      yield* requireAllowedWorkLaneTransition({
        commandType: command.type,
        from: lane.state,
        to: "failed",
      });
      return yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: lane.state,
        toState: "failed",
        occurredAt: command.failedAt,
        resumeState: null,
        ...(command.reason !== undefined ? { reason: command.reason } : {}),
      });
    }

    case "lane.task-contract.update": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireLaneMutable({ command, lane });
      return {
        ...(yield* withEventBase({
          aggregateKind: "lane",
          aggregateId: command.laneId,
          occurredAt: command.updatedAt,
          commandId: command.commandId,
        })),
        type: "lane.task-contract-updated" as const,
        payload: {
          laneId: command.laneId,
          taskContract: command.taskContract,
          updatedAt: command.updatedAt,
        },
      };
    }

    case "lane.meta.update": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireLaneMutable({ command, lane });
      if (
        command.worktreePath !== undefined &&
        isWorkLaneWorktreeOwningState(lane.state)
      ) {
        yield* requireWorktreeExclusive({
          readModel,
          command,
          worktreePath: command.worktreePath,
          exceptLaneId: command.laneId,
        });
      }
      return {
        ...(yield* withEventBase({
          aggregateKind: "lane",
          aggregateId: command.laneId,
          occurredAt: command.updatedAt,
          commandId: command.commandId,
        })),
        type: "lane.meta-updated" as const,
        payload: {
          laneId: command.laneId,
          ...(command.title !== undefined ? { title: command.title } : {}),
          ...(command.priority !== undefined ? { priority: command.priority } : {}),
          ...(command.classification !== undefined
            ? { classification: command.classification }
            : {}),
          ...(command.branch !== undefined ? { branch: command.branch } : {}),
          ...(command.worktreePath !== undefined ? { worktreePath: command.worktreePath } : {}),
          ...(command.baseRef !== undefined ? { baseRef: command.baseRef } : {}),
          ...(command.repositoryIdentity !== undefined
            ? { repositoryIdentity: command.repositoryIdentity }
            : {}),
          updatedAt: command.updatedAt,
        },
      };
    }

    case "source-truth.preflight.record": {
      const lane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireLaneMutable({ command, lane });
      if (command.revision.laneId !== command.laneId) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Source-truth revision laneId '${command.revision.laneId}' does not match command laneId '${command.laneId}'.`,
          }),
        );
      }
      if (
        command.revision.environmentId !== undefined &&
        command.revision.environmentId !== lane.environmentId
      ) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Source-truth revision environmentId '${command.revision.environmentId}' does not match lane environmentId '${lane.environmentId}'.`,
          }),
        );
      }
      if (command.revision.worktreePath !== lane.worktreePath) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Source-truth revision worktreePath '${command.revision.worktreePath ?? "null"}' does not match lane worktreePath '${lane.worktreePath ?? "null"}'.`,
          }),
        );
      }
      if (
        command.revision.repositoryIdentity?.canonicalKey !==
        lane.repositoryIdentity?.canonicalKey
      ) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: "Source-truth revision repository identity does not match the lane repository identity.",
          }),
        );
      }
      if (command.revision.id === lane.sourceTruthRevisionId) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Source-truth revision '${command.revision.id}' is already current for lane '${command.laneId}'.`,
          }),
        );
      }
      const revisionAlreadyOwned = readModel.lanes.some(
        (entry) => entry.sourceTruthRevisionId === command.revision.id,
      );
      if (revisionAlreadyOwned) {
        return yield* Effect.fail(
          new OrchestrationCommandInvariantError({
            commandType: command.type,
            detail: `Source-truth revision '${command.revision.id}' already exists.`,
          }),
        );
      }
      return {
        ...(yield* withEventBase({
          aggregateKind: "lane",
          aggregateId: command.laneId,
          occurredAt: command.recordedAt,
          commandId: command.commandId,
        })),
        type: "source-truth.preflight-recorded" as const,
        payload: {
          laneId: command.laneId,
          revision: {
            ...command.revision,
            supersedesRevisionId: lane.sourceTruthRevisionId,
          },
          previousRevisionId: lane.sourceTruthRevisionId,
          recordedAt: command.recordedAt,
        },
      };
    }

    case "source-truth.conflict.record": {
      const conflictLane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireLaneMutable({ command, lane: conflictLane });
      const blockerId = command.blockerId ?? BlockerId.make(`source-truth:${command.commandId}`);
      const conflictRecorded: PlannedOrchestrationEvent = {
        ...(yield* withEventBase({
          aggregateKind: "lane",
          aggregateId: command.laneId,
          occurredAt: command.recordedAt,
          commandId: command.commandId,
        })),
        type: "source-truth.conflict-recorded" as const,
        payload: {
          laneId: command.laneId,
          summary: command.summary,
          blockerId,
          recordedAt: command.recordedAt,
        },
      };
      if (
        conflictLane.state === "blocked" ||
        !isAllowedWorkLaneTransition(conflictLane.state, "blocked")
      ) {
        return conflictRecorded;
      }
      const stateChanged = yield* emitLaneStateChanged({
        command,
        laneId: command.laneId,
        fromState: conflictLane.state,
        toState: "blocked",
        occurredAt: command.recordedAt,
        resumeState: conflictLane.state,
        reason: command.summary,
        blockerId,
      });
      return [conflictRecorded, stateChanged];
    }

    case "source-truth.refresh.request": {
      const refreshLane = yield* requireLane({
        readModel,
        command,
        laneId: command.laneId,
      });
      yield* requireLaneMutable({ command, lane: refreshLane });
      return {
        ...(yield* withEventBase({
          aggregateKind: "lane",
          aggregateId: command.laneId,
          occurredAt: command.requestedAt,
          commandId: command.commandId,
        })),
        type: "source-truth.refresh-requested" as const,
        payload: {
          laneId: command.laneId,
          requestedAt: command.requestedAt,
        },
      };
    }

    default: {
      command satisfies never;
      const fallback = command as never as { type: string };
      return yield* new OrchestrationCommandInvariantError({
        commandType: fallback.type,
        detail: `Unknown command type: ${fallback.type}`,
      });
    }
  }
});
