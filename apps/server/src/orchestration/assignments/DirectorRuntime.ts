/**
 * DirectorRuntime — F3 director/worker control plane wired to ProviderService.
 *
 * spawn_worker / startDirector call real ProviderService.startSession + sendTurn.
 * No simulated workers and no status-only fake transitions.
 */
import {
  AgentAssignmentId,
  ThreadId,
  TurnId,
  type ProviderInstanceId,
  type ProviderSession,
  type ProviderTurnStartResult,
} from "@t3tools/contracts";
import {
  DEFAULT_MODEL_INTENT_BY_ROLE,
  type AgentAssignment,
  type AgentRole,
  type AgentTopologyProjection,
  type DirectorReplaceWorkerInput,
  type DirectorRequestReviewInput,
  type DirectorSpawnWorkerInput,
  type DirectorStartSessionInput,
  type DirectorToolName,
  type DirectorWorkerTargetInput,
  type ModelIntent,
  type ReasoningLevel,
  type WorkerResultReport,
} from "@t3tools/contracts/agentAssignment";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type { ProviderServiceError } from "../../provider/Errors.ts";
import { ProviderService } from "../../provider/Services/ProviderService.ts";
import { AssignmentStore } from "./AssignmentStore.ts";

export class DirectorRuntimeError extends Error {
  readonly _tag = "DirectorRuntimeError";
  constructor(
    readonly operation: DirectorToolName | "start_director" | "ingest_worker_result" | "rehydrate",
    message: string,
  ) {
    super(message);
    this.name = "DirectorRuntimeError";
  }
}

export type DirectorRuntimeFailure = DirectorRuntimeError | ProviderServiceError;

export interface DirectorRuntimeShape {
  readonly startDirector: (
    input: DirectorStartSessionInput,
  ) => Effect.Effect<AgentAssignment, DirectorRuntimeFailure>;
  readonly spawnWorker: (
    input: DirectorSpawnWorkerInput,
  ) => Effect.Effect<AgentAssignment, DirectorRuntimeFailure>;
  readonly sendInstruction: (
    input: DirectorWorkerTargetInput & { readonly instruction: string },
  ) => Effect.Effect<ProviderTurnStartResult, DirectorRuntimeFailure>;
  readonly requestStatus: (
    input: Pick<DirectorWorkerTargetInput, "assignmentId">,
  ) => Effect.Effect<AgentAssignment, DirectorRuntimeFailure>;
  readonly steerWorker: (
    input: DirectorWorkerTargetInput & { readonly instruction: string },
  ) => Effect.Effect<ProviderTurnStartResult, DirectorRuntimeFailure>;
  readonly pauseWorker: (
    input: Pick<DirectorWorkerTargetInput, "assignmentId">,
  ) => Effect.Effect<AgentAssignment, DirectorRuntimeFailure>;
  readonly resumeWorker: (
    input: DirectorWorkerTargetInput & { readonly instruction?: string },
  ) => Effect.Effect<AgentAssignment, DirectorRuntimeFailure>;
  readonly stopWorker: (
    input: Pick<DirectorWorkerTargetInput, "assignmentId">,
  ) => Effect.Effect<AgentAssignment, DirectorRuntimeFailure>;
  readonly replaceWorker: (
    input: DirectorReplaceWorkerInput,
  ) => Effect.Effect<AgentAssignment, DirectorRuntimeFailure>;
  readonly requestReview: (
    input: DirectorRequestReviewInput,
  ) => Effect.Effect<AgentAssignment, DirectorRuntimeFailure>;
  readonly ingestWorkerResult: (
    input: WorkerResultReport,
  ) => Effect.Effect<AgentAssignment, DirectorRuntimeFailure>;
  readonly rehydrate: () => Effect.Effect<ReadonlyArray<AgentAssignment>, DirectorRuntimeFailure>;
  readonly topologyForLane: (
    laneId: AgentAssignment["laneId"],
  ) => Effect.Effect<AgentTopologyProjection>;
}

export class DirectorRuntime extends Context.Service<DirectorRuntime, DirectorRuntimeShape>()(
  "t3/orchestration/assignments/DirectorRuntime",
) {}

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

function requireThreadId(
  assignment: AgentAssignment,
  operation: DirectorToolName,
): Effect.Effect<ThreadId, DirectorRuntimeError> {
  if (assignment.threadId === null) {
    return Effect.fail(
      new DirectorRuntimeError(
        operation,
        `Assignment '${assignment.id}' has no bound provider thread.`,
      ),
    );
  }
  return Effect.succeed(assignment.threadId);
}

function buildAssignment(input: {
  readonly id: AgentAssignmentId;
  readonly laneId: AgentAssignment["laneId"];
  readonly role: AgentRole;
  readonly providerInstanceId: ProviderInstanceId;
  readonly resolvedModel: string;
  readonly reasoningLevel: ReasoningLevel;
  readonly toolPolicyId: string;
  readonly environmentId: AgentAssignment["environmentId"];
  readonly threadId: ThreadId | null;
  readonly parentAssignmentId: AgentAssignmentId | null;
  readonly ownership: AgentAssignment["ownership"];
  readonly status: AgentAssignment["status"];
  readonly worktreePath: string | null;
  readonly taskSummary: string | null;
  readonly modelIntent?: ModelIntent;
  readonly supersedesAssignmentId?: AgentAssignmentId | null;
  readonly resumeCursor?: unknown;
  readonly lastTurnId?: TurnId | null;
  readonly lastResultSummary?: string | null;
  readonly createdAt?: string;
}): AgentAssignment {
  const createdAt = input.createdAt ?? nowIso();
  return {
    id: input.id,
    laneId: input.laneId,
    role: input.role,
    providerInstanceId: input.providerInstanceId,
    modelIntent: input.modelIntent ?? DEFAULT_MODEL_INTENT_BY_ROLE[input.role],
    resolvedModel: input.resolvedModel,
    reasoningLevel: input.reasoningLevel,
    toolPolicyId: input.toolPolicyId,
    environmentId: input.environmentId,
    threadId: input.threadId,
    parentAssignmentId: input.parentAssignmentId,
    ownership: input.ownership,
    status: input.status,
    contextHealth: "healthy",
    supersedesAssignmentId: input.supersedesAssignmentId ?? null,
    worktreePath: input.worktreePath,
    taskSummary: input.taskSummary,
    lastResultSummary: input.lastResultSummary ?? null,
    lastTurnId: input.lastTurnId ?? null,
    ...(input.resumeCursor !== undefined ? { resumeCursor: input.resumeCursor } : {}),
    createdAt,
    updatedAt: createdAt,
  };
}

function formatWorkerTask(input: {
  readonly role: AgentRole;
  readonly task: string;
  readonly worktreePath: string;
  readonly laneId: string;
  readonly parentAssignmentId: string;
}): string {
  return [
    `[macbrains-assignment]`,
    `role=${input.role}`,
    `laneId=${input.laneId}`,
    `parentAssignmentId=${input.parentAssignmentId}`,
    `worktreePath=${input.worktreePath}`,
    ``,
    input.task,
  ].join("\n");
}

function formatDirectorResultNotice(input: {
  readonly workerAssignmentId: string;
  readonly role: AgentRole;
  readonly summary: string;
  readonly success: boolean;
}): string {
  return [
    `[macbrains-worker-result]`,
    `workerAssignmentId=${input.workerAssignmentId}`,
    `role=${input.role}`,
    `success=${input.success ? "true" : "false"}`,
    ``,
    input.summary,
  ].join("\n");
}

export const makeDirectorRuntime = Effect.fn("makeDirectorRuntime")(function* () {
  const providerService = yield* ProviderService;
  const store = yield* AssignmentStore;

  const getOrFail = (
    id: AgentAssignmentId,
    operation: DirectorToolName | "ingest_worker_result",
  ): Effect.Effect<AgentAssignment, DirectorRuntimeError> =>
    store.get(id).pipe(
      Effect.flatMap((option) =>
        Option.match(option, {
          onNone: () =>
            Effect.fail(new DirectorRuntimeError(operation, `Unknown assignment '${id}'.`)),
          onSome: (assignment) => Effect.succeed(assignment),
        }),
      ),
    );

  const persistSessionBinding = (
    assignment: AgentAssignment,
    session: ProviderSession,
    extras?: {
      readonly status?: AgentAssignment["status"];
      readonly lastTurnId?: TurnId | null;
      readonly lastResultSummary?: string | null;
      readonly taskSummary?: string | null;
    },
  ): Effect.Effect<AgentAssignment> => {
    const next: AgentAssignment = {
      ...assignment,
      threadId: session.threadId,
      status: extras?.status ?? "active",
      resumeCursor: session.resumeCursor,
      worktreePath: session.cwd ?? assignment.worktreePath,
      lastTurnId: extras?.lastTurnId !== undefined ? extras.lastTurnId : assignment.lastTurnId,
      lastResultSummary:
        extras?.lastResultSummary !== undefined
          ? extras.lastResultSummary
          : assignment.lastResultSummary,
      taskSummary: extras?.taskSummary !== undefined ? extras.taskSummary : assignment.taskSummary,
      updatedAt: nowIso(),
    };
    return store.upsert(next);
  };

  const startDirector: DirectorRuntimeShape["startDirector"] = (input) =>
    Effect.gen(function* () {
      const threadId = input.directorThreadId ?? ThreadId.make(makeId("thread_director"));
      const assignmentId =
        input.directorAssignmentId ?? AgentAssignmentId.make(makeId("aa_director"));
      const pending = buildAssignment({
        id: assignmentId,
        laneId: input.laneId,
        role: "director",
        providerInstanceId: input.providerInstanceId,
        resolvedModel: input.modelSelection.model,
        reasoningLevel: input.reasoningLevel,
        toolPolicyId: input.toolPolicyId,
        environmentId: input.environmentId,
        threadId,
        parentAssignmentId: null,
        ownership: null,
        status: "starting",
        worktreePath: input.worktreePath,
        taskSummary: input.taskSummary ?? "Direct lane work",
        modelIntent: input.modelIntent,
      });
      yield* store.upsert(pending);

      const session = yield* providerService.startSession(threadId, {
        threadId,
        providerInstanceId: input.providerInstanceId,
        cwd: input.worktreePath,
        modelSelection: input.modelSelection,
        runtimeMode: input.runtimeMode,
      });

      let active = yield* persistSessionBinding(pending, session, { status: "active" });

      if (input.initialInstruction !== undefined) {
        const turn = yield* providerService.sendTurn({
          threadId,
          input: input.initialInstruction,
          modelSelection: input.modelSelection,
        });
        active = yield* store.upsert({
          ...active,
          lastTurnId: turn.turnId,
          updatedAt: nowIso(),
        });
      }

      return active;
    });

  const spawnWorker: DirectorRuntimeShape["spawnWorker"] = (input) =>
    Effect.gen(function* () {
      const director = yield* getOrFail(input.directorAssignmentId, "spawn_worker");
      if (director.role !== "director") {
        return yield* Effect.fail(
          new DirectorRuntimeError(
            "spawn_worker",
            `Assignment '${director.id}' is role '${director.role}', not director.`,
          ),
        );
      }
      if (director.laneId !== input.laneId) {
        return yield* Effect.fail(
          new DirectorRuntimeError(
            "spawn_worker",
            `Director '${director.id}' belongs to lane '${director.laneId}', not '${input.laneId}'.`,
          ),
        );
      }

      const threadId = input.workerThreadId ?? ThreadId.make(makeId("thread_worker"));
      const assignmentId =
        input.workerAssignmentId ?? AgentAssignmentId.make(makeId(`aa_${input.role}`));
      const pending = buildAssignment({
        id: assignmentId,
        laneId: input.laneId,
        role: input.role,
        providerInstanceId: input.providerInstanceId,
        resolvedModel: input.modelSelection.model,
        reasoningLevel: input.reasoningLevel,
        toolPolicyId: input.toolPolicyId,
        environmentId: input.environmentId,
        threadId,
        parentAssignmentId: director.id,
        ownership: input.ownership ?? null,
        status: "starting",
        worktreePath: input.worktreePath,
        taskSummary: input.task,
        modelIntent: input.modelIntent,
      });
      yield* store.upsert(pending);

      // Real provider launch — not a state-only transition.
      const session = yield* providerService.startSession(threadId, {
        threadId,
        providerInstanceId: input.providerInstanceId,
        cwd: input.worktreePath,
        modelSelection: input.modelSelection,
        runtimeMode: input.runtimeMode,
      });

      if (session.cwd !== undefined && session.cwd !== input.worktreePath) {
        return yield* Effect.fail(
          new DirectorRuntimeError(
            "spawn_worker",
            `Provider session cwd '${session.cwd}' does not match lane worktree '${input.worktreePath}'.`,
          ),
        );
      }

      const turn = yield* providerService.sendTurn({
        threadId,
        input: formatWorkerTask({
          role: input.role,
          task: input.task,
          worktreePath: input.worktreePath,
          laneId: input.laneId,
          parentAssignmentId: director.id,
        }),
        modelSelection: input.modelSelection,
      });

      return yield* persistSessionBinding(pending, session, {
        status: "active",
        lastTurnId: turn.turnId,
        taskSummary: input.task,
      });
    });

  const sendInstruction: DirectorRuntimeShape["sendInstruction"] = (input) =>
    Effect.gen(function* () {
      const assignment = yield* getOrFail(input.assignmentId, "send_instruction");
      const threadId = yield* requireThreadId(assignment, "send_instruction");
      if (assignment.status === "paused" || assignment.status === "cancelled") {
        return yield* Effect.fail(
          new DirectorRuntimeError(
            "send_instruction",
            `Cannot instruct assignment '${assignment.id}' while status is '${assignment.status}'.`,
          ),
        );
      }
      const turn = yield* providerService.sendTurn({
        threadId,
        input: input.instruction,
      });
      yield* store.upsert({
        ...assignment,
        status: "active",
        lastTurnId: turn.turnId,
        updatedAt: nowIso(),
      });
      return turn;
    });

  const requestStatus: DirectorRuntimeShape["requestStatus"] = (input) =>
    getOrFail(input.assignmentId, "request_status");

  const steerWorker: DirectorRuntimeShape["steerWorker"] = (input) =>
    sendInstruction({
      assignmentId: input.assignmentId,
      instruction: `[steer]\n${input.instruction}`,
    }).pipe(
      Effect.mapError((error) =>
        error instanceof DirectorRuntimeError
          ? new DirectorRuntimeError("steer_worker", error.message)
          : error,
      ),
    );

  const pauseWorker: DirectorRuntimeShape["pauseWorker"] = (input) =>
    Effect.gen(function* () {
      const assignment = yield* getOrFail(input.assignmentId, "pause_worker");
      const threadId = yield* requireThreadId(assignment, "pause_worker");
      yield* providerService.interruptTurn({ threadId });
      return yield* store.upsert({
        ...assignment,
        status: "paused",
        updatedAt: nowIso(),
      });
    });

  const resumeWorker: DirectorRuntimeShape["resumeWorker"] = (input) =>
    Effect.gen(function* () {
      const assignment = yield* getOrFail(input.assignmentId, "resume_worker");
      const threadId = yield* requireThreadId(assignment, "resume_worker");
      if (assignment.status !== "paused" && assignment.status !== "waiting") {
        return yield* Effect.fail(
          new DirectorRuntimeError(
            "resume_worker",
            `Assignment '${assignment.id}' is '${assignment.status}', not paused/waiting.`,
          ),
        );
      }
      const turn = yield* providerService.sendTurn({
        threadId,
        input: input.instruction ?? "[resume] Continue the assigned task.",
      });
      return yield* store.upsert({
        ...assignment,
        status: "active",
        lastTurnId: turn.turnId,
        updatedAt: nowIso(),
      });
    });

  const stopWorker: DirectorRuntimeShape["stopWorker"] = (input) =>
    Effect.gen(function* () {
      const assignment = yield* getOrFail(input.assignmentId, "stop_worker");
      const threadId = yield* requireThreadId(assignment, "stop_worker");
      yield* providerService.stopSession({ threadId });
      return yield* store.upsert({
        ...assignment,
        status: "cancelled",
        updatedAt: nowIso(),
      });
    });

  const replaceWorker: DirectorRuntimeShape["replaceWorker"] = (input) =>
    Effect.gen(function* () {
      const previous = yield* getOrFail(input.assignmentId, "replace_worker");
      if (previous.parentAssignmentId === null) {
        return yield* Effect.fail(
          new DirectorRuntimeError(
            "replace_worker",
            `Assignment '${previous.id}' has no director parent and cannot be replaced as a worker.`,
          ),
        );
      }
      if (previous.role === "director") {
        return yield* Effect.fail(
          new DirectorRuntimeError("replace_worker", "Cannot replace a director assignment."),
        );
      }
      if (previous.worktreePath === null) {
        return yield* Effect.fail(
          new DirectorRuntimeError(
            "replace_worker",
            `Assignment '${previous.id}' has no worktree path.`,
          ),
        );
      }

      if (previous.threadId !== null && previous.status !== "cancelled") {
        yield* providerService.stopSession({ threadId: previous.threadId }).pipe(Effect.ignore);
      }
      yield* store.upsert({
        ...previous,
        status: "superseded",
        updatedAt: nowIso(),
      });

      const replacement = yield* spawnWorker({
        laneId: previous.laneId,
        directorAssignmentId: previous.parentAssignmentId,
        role: previous.role === "director" ? "executor" : previous.role,
        task: input.task ?? previous.taskSummary ?? "Continue superseded worker task",
        worktreePath: previous.worktreePath,
        providerInstanceId: input.providerInstanceId ?? previous.providerInstanceId,
        modelSelection: input.modelSelection ?? {
          instanceId: previous.providerInstanceId,
          model: previous.resolvedModel,
        },
        runtimeMode: "full-access",
        environmentId: previous.environmentId,
        ownership: previous.ownership,
        modelIntent: previous.modelIntent,
        reasoningLevel: previous.reasoningLevel,
        toolPolicyId: previous.toolPolicyId,
        workerThreadId: input.workerThreadId,
        workerAssignmentId: input.workerAssignmentId,
      });

      return yield* store.upsert({
        ...replacement,
        supersedesAssignmentId: previous.id,
        updatedAt: nowIso(),
      });
    });

  const requestReview: DirectorRuntimeShape["requestReview"] = (input) =>
    spawnWorker({
      laneId: input.laneId,
      directorAssignmentId: input.directorAssignmentId,
      role: "verifier",
      task: [`Review subject assignment ${input.subjectAssignmentId}.`, input.reviewTask].join(
        "\n",
      ),
      worktreePath: input.worktreePath,
      providerInstanceId: input.providerInstanceId,
      modelSelection: input.modelSelection,
      runtimeMode: input.runtimeMode,
      environmentId: input.environmentId,
      reasoningLevel: "high",
      toolPolicyId: "verifier",
      modelIntent: DEFAULT_MODEL_INTENT_BY_ROLE.verifier,
      workerThreadId: input.workerThreadId,
      workerAssignmentId: input.workerAssignmentId,
    }).pipe(
      Effect.mapError((error) =>
        error instanceof DirectorRuntimeError
          ? new DirectorRuntimeError("request_review", error.message)
          : error,
      ),
    );

  const ingestWorkerResult: DirectorRuntimeShape["ingestWorkerResult"] = (input) =>
    Effect.gen(function* () {
      const worker = yield* getOrFail(input.assignmentId, "ingest_worker_result");
      if (worker.parentAssignmentId === null) {
        return yield* Effect.fail(
          new DirectorRuntimeError(
            "ingest_worker_result",
            `Assignment '${worker.id}' has no director parent for result delivery.`,
          ),
        );
      }
      const director = yield* getOrFail(worker.parentAssignmentId, "ingest_worker_result");
      const directorThreadId = yield* requireThreadId(director, "send_instruction").pipe(
        Effect.mapError((error) => new DirectorRuntimeError("ingest_worker_result", error.message)),
      );

      const completed = yield* store.upsert({
        ...worker,
        status: input.success ? "completed" : "failed",
        lastResultSummary: input.summary,
        lastTurnId: input.turnId ?? worker.lastTurnId,
        updatedAt: nowIso(),
      });

      const turn = yield* providerService.sendTurn({
        threadId: directorThreadId,
        input: formatDirectorResultNotice({
          workerAssignmentId: worker.id,
          role: worker.role,
          summary: input.summary,
          success: input.success,
        }),
      });

      yield* store.upsert({
        ...director,
        status: "active",
        lastTurnId: turn.turnId,
        lastResultSummary: `worker ${worker.id}: ${input.summary}`,
        updatedAt: nowIso(),
      });

      return completed;
    });

  const rehydrate: DirectorRuntimeShape["rehydrate"] = () =>
    Effect.gen(function* () {
      const assignments = yield* store.listAll();
      const sessions = yield* providerService.listSessions();
      const byThread = new Map(sessions.map((session) => [session.threadId, session] as const));
      const restored: AgentAssignment[] = [];

      for (const assignment of assignments) {
        if (assignment.threadId === null) {
          restored.push(assignment);
          continue;
        }
        const live = byThread.get(assignment.threadId);
        if (live) {
          restored.push(
            yield* persistSessionBinding(assignment, live, {
              status:
                assignment.status === "paused" ||
                assignment.status === "completed" ||
                assignment.status === "failed" ||
                assignment.status === "cancelled" ||
                assignment.status === "superseded"
                  ? assignment.status
                  : "active",
            }),
          );
          continue;
        }

        if (assignment.resumeCursor === undefined || assignment.worktreePath === null) {
          restored.push(
            yield* store.upsert({
              ...assignment,
              status:
                assignment.status === "completed" ||
                assignment.status === "cancelled" ||
                assignment.status === "superseded" ||
                assignment.status === "failed"
                  ? assignment.status
                  : "waiting",
              contextHealth: "degraded",
              updatedAt: nowIso(),
            }),
          );
          continue;
        }

        // Survive reconnect by relaunching the provider session with persisted resume state.
        const session = yield* providerService.startSession(assignment.threadId, {
          threadId: assignment.threadId,
          providerInstanceId: assignment.providerInstanceId,
          cwd: assignment.worktreePath,
          modelSelection: {
            instanceId: assignment.providerInstanceId,
            model: assignment.resolvedModel,
          },
          resumeCursor: assignment.resumeCursor,
          runtimeMode: "full-access",
        });
        restored.push(
          yield* persistSessionBinding(assignment, session, {
            status:
              assignment.status === "paused" ||
              assignment.status === "completed" ||
              assignment.status === "failed" ||
              assignment.status === "cancelled" ||
              assignment.status === "superseded"
                ? assignment.status
                : "active",
          }),
        );
      }

      return restored;
    });

  return {
    startDirector,
    spawnWorker,
    sendInstruction,
    requestStatus,
    steerWorker,
    pauseWorker,
    resumeWorker,
    stopWorker,
    replaceWorker,
    requestReview,
    ingestWorkerResult,
    rehydrate,
    topologyForLane: store.topologyForLane,
  } satisfies DirectorRuntimeShape;
});
