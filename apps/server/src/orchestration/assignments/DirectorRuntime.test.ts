import {
  AgentAssignmentId,
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  TurnId,
  WorkLaneId,
  type ProviderSession,
  type ProviderTurnStartResult,
} from "@t3tools/contracts";
import { assert, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";

import type { ProviderServiceShape } from "../../provider/Services/ProviderService.ts";
import { ProviderService } from "../../provider/Services/ProviderService.ts";
import { AssignmentStore, makeInMemoryAssignmentStore } from "./AssignmentStore.ts";
import { DirectorRuntime, makeDirectorRuntime } from "./DirectorRuntime.ts";

const NOW = "2026-07-31T22:00:00.000Z";
const LANE_ID = WorkLaneId.make("lane-f3-1");
const ENV_ID = EnvironmentId.make("env-1");
const INSTANCE_ID = ProviderInstanceId.make("codex");
const WORKTREE = "/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f3-agent-topology";
const MODEL = { instanceId: INSTANCE_ID, model: "gpt-5.4" } as const;
const CODEX = ProviderDriverKind.make("codex");

type ProviderCall =
  | { readonly op: "startSession"; readonly threadId: string; readonly cwd?: string }
  | { readonly op: "sendTurn"; readonly threadId: string; readonly input?: string }
  | { readonly op: "interruptTurn"; readonly threadId: string }
  | { readonly op: "stopSession"; readonly threadId: string }
  | { readonly op: "listSessions" };

function makeRecordingProvider() {
  const sessions = new Map<string, ProviderSession>();
  const calls: ProviderCall[] = [];
  let turnCounter = 0;

  const service: ProviderServiceShape = {
    startSession: (threadId, input) =>
      Effect.sync(() => {
        calls.push({
          op: "startSession",
          threadId: String(threadId),
          ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
        });
        const session: ProviderSession = {
          provider: CODEX,
          providerInstanceId: input.providerInstanceId ?? INSTANCE_ID,
          status: "ready",
          runtimeMode: input.runtimeMode,
          threadId,
          cwd: input.cwd,
          resumeCursor: input.resumeCursor ?? { opaque: `resume-${String(threadId)}` },
          createdAt: NOW,
          updatedAt: NOW,
        };
        sessions.set(String(threadId), session);
        return session;
      }),
    sendTurn: (input) =>
      Effect.sync(() => {
        calls.push({
          op: "sendTurn",
          threadId: String(input.threadId),
          ...(input.input !== undefined ? { input: input.input } : {}),
        });
        if (!sessions.has(String(input.threadId))) {
          throw new Error(`sendTurn without session for ${String(input.threadId)}`);
        }
        turnCounter += 1;
        const result: ProviderTurnStartResult = {
          threadId: input.threadId,
          turnId: TurnId.make(`turn-${turnCounter}`),
          resumeCursor: { opaque: `resume-${String(input.threadId)}` },
        };
        return result;
      }),
    interruptTurn: (input) =>
      Effect.sync(() => {
        calls.push({ op: "interruptTurn", threadId: String(input.threadId) });
      }),
    respondToRequest: () => Effect.void,
    respondToUserInput: () => Effect.void,
    stopSession: (input) =>
      Effect.sync(() => {
        calls.push({ op: "stopSession", threadId: String(input.threadId) });
        sessions.delete(String(input.threadId));
      }),
    listSessions: () =>
      Effect.sync(() => {
        calls.push({ op: "listSessions" });
        return Array.from(sessions.values());
      }),
    getCapabilities: () => Effect.succeed({ sessionModelSwitch: "unsupported" as const }),
    getInstanceInfo: () => Effect.die("unused in DirectorRuntime tests"),
    rollbackConversation: () => Effect.void,
    streamEvents: Stream.empty,
  };

  return { service, calls, sessions };
}

function runtimeLayer(provider: ProviderServiceShape) {
  return Layer.effect(DirectorRuntime, makeDirectorRuntime()).pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ProviderService, provider),
        Layer.effect(AssignmentStore, makeInMemoryAssignmentStore()),
      ),
    ),
  );
}

describe("DirectorRuntime real ProviderService spawn path", () => {
  it.effect(
    "lane → director session → spawn worker → result → director response → reconnect",
    () => {
      const recording = makeRecordingProvider();
      return Effect.gen(function* () {
        const runtime = yield* DirectorRuntime;

        const directorThreadId = ThreadId.make("thread-director-1");
        const workerThreadId = ThreadId.make("thread-worker-1");
        const directorAssignmentId = AgentAssignmentId.make("aa-director-1");
        const workerAssignmentId = AgentAssignmentId.make("aa-executor-1");

        const director = yield* runtime.startDirector({
          laneId: LANE_ID,
          worktreePath: WORKTREE,
          providerInstanceId: INSTANCE_ID,
          modelSelection: MODEL,
          runtimeMode: "full-access",
          environmentId: ENV_ID,
          directorThreadId,
          directorAssignmentId,
          initialInstruction: "You are the lane director. Spawn one executor.",
        });

        assert.strictEqual(director.role, "director");
        assert.strictEqual(director.status, "active");
        assert.strictEqual(director.threadId, directorThreadId);
        assert.strictEqual(director.worktreePath, WORKTREE);

        const worker = yield* runtime.spawnWorker({
          laneId: LANE_ID,
          directorAssignmentId: director.id,
          role: "executor",
          task: "Implement the smallest real spawn path under assignments/",
          worktreePath: WORKTREE,
          providerInstanceId: INSTANCE_ID,
          modelSelection: MODEL,
          runtimeMode: "full-access",
          environmentId: ENV_ID,
          workerThreadId,
          workerAssignmentId,
        });

        assert.strictEqual(worker.role, "executor");
        assert.strictEqual(worker.status, "active");
        assert.strictEqual(worker.parentAssignmentId, director.id);
        assert.strictEqual(worker.threadId, workerThreadId);
        assert.strictEqual(worker.worktreePath, WORKTREE);
        assert.ok(worker.taskSummary?.includes("smallest real spawn path"));

        const spawnTurn = recording.calls.find(
          (call) =>
            call.op === "sendTurn" &&
            call.threadId === String(workerThreadId) &&
            typeof call.input === "string",
        );
        assert.ok(spawnTurn && spawnTurn.op === "sendTurn");
        assert.ok(spawnTurn.input?.includes(`worktreePath=${WORKTREE}`));
        assert.ok(spawnTurn.input?.includes(`laneId=${LANE_ID}`));
        assert.ok(spawnTurn.input?.includes("Implement the smallest real spawn path"));

        yield* runtime.steerWorker({
          assignmentId: worker.id,
          instruction: "Keep ownership boundaries tight.",
        });
        assert.ok(
          recording.calls.some(
            (call) =>
              call.op === "sendTurn" &&
              call.threadId === String(workerThreadId) &&
              call.input?.includes("[steer]"),
          ),
        );

        const paused = yield* runtime.pauseWorker({ assignmentId: worker.id });
        assert.strictEqual(paused.status, "paused");
        assert.ok(
          recording.calls.some(
            (call) => call.op === "interruptTurn" && call.threadId === String(workerThreadId),
          ),
        );

        const resumed = yield* runtime.resumeWorker({ assignmentId: worker.id });
        assert.strictEqual(resumed.status, "active");

        const completed = yield* runtime.ingestWorkerResult({
          assignmentId: worker.id,
          summary: "Spawn path modules landed with focused tests.",
          success: true,
          turnId: worker.lastTurnId ?? undefined,
        });
        assert.strictEqual(completed.status, "completed");

        const directorAfter = yield* runtime.requestStatus({ assignmentId: director.id });
        assert.ok(directorAfter.lastResultSummary?.includes(worker.id));
        assert.ok(
          recording.calls.some(
            (call) =>
              call.op === "sendTurn" &&
              call.threadId === String(directorThreadId) &&
              call.input?.includes("[macbrains-worker-result]"),
          ),
        );

        const replacement = yield* runtime.replaceWorker({
          assignmentId: worker.id,
          task: "Finish remaining F3 wiring notes",
          workerThreadId: ThreadId.make("thread-worker-2"),
          workerAssignmentId: AgentAssignmentId.make("aa-executor-2"),
        });
        assert.strictEqual(replacement.supersedesAssignmentId, worker.id);
        assert.strictEqual(replacement.status, "active");

        const review = yield* runtime.requestReview({
          laneId: LANE_ID,
          directorAssignmentId: director.id,
          subjectAssignmentId: replacement.id,
          reviewTask: "Verify spawn path evidence.",
          worktreePath: WORKTREE,
          providerInstanceId: INSTANCE_ID,
          modelSelection: MODEL,
          runtimeMode: "full-access",
          environmentId: ENV_ID,
          workerThreadId: ThreadId.make("thread-verifier-1"),
          workerAssignmentId: AgentAssignmentId.make("aa-verifier-1"),
        });
        assert.strictEqual(review.role, "verifier");
        assert.strictEqual(review.parentAssignmentId, director.id);

        const topology = yield* runtime.topologyForLane(LANE_ID);
        assert.strictEqual(topology.directorAssignmentId, director.id);
        expect(topology.nodes.map((node) => node.role).sort()).toEqual(
          ["director", "executor", "executor", "verifier"].sort(),
        );

        // Survive reconnect: drop live sessions, keep durable assignment snapshot, relaunch.
        const startSessionBeforeReconnect = recording.calls.filter(
          (call) => call.op === "startSession",
        ).length;
        recording.sessions.clear();
        const rehydrated = yield* runtime.rehydrate();
        const directorLive = rehydrated.find((row) => row.id === director.id);
        assert.ok(directorLive);
        assert.strictEqual(directorLive?.threadId, directorThreadId);
        assert.ok(
          recording.calls.filter((call) => call.op === "startSession").length >
            startSessionBeforeReconnect,
          "rehydrate must call ProviderService.startSession again",
        );
        assert.ok(
          recording.calls.some((call) => call.op === "startSession" && call.cwd === WORKTREE),
          "spawn/reconnect sessions must use the lane worktree cwd",
        );
      }).pipe(Effect.provide(runtimeLayer(recording.service)));
    },
  );

  it.effect("rejects spawn when director assignment is missing (no fake transition)", () => {
    const recording = makeRecordingProvider();
    return Effect.gen(function* () {
      const runtime = yield* DirectorRuntime;
      const result = yield* runtime
        .spawnWorker({
          laneId: LANE_ID,
          directorAssignmentId: AgentAssignmentId.make("missing-director"),
          role: "executor",
          task: "should fail",
          worktreePath: WORKTREE,
          providerInstanceId: INSTANCE_ID,
          modelSelection: MODEL,
          runtimeMode: "full-access",
          environmentId: ENV_ID,
        })
        .pipe(Effect.result);

      assert.ok(Result.isFailure(result));
      if (Result.isFailure(result)) {
        assert.ok(String(result.failure.message).includes("Unknown assignment"));
      }
      assert.strictEqual(recording.calls.filter((call) => call.op === "startSession").length, 0);
    }).pipe(Effect.provide(runtimeLayer(recording.service)));
  });

  it.effect("assignment store snapshot round-trips durable roles", () =>
    Effect.gen(function* () {
      const store = yield* makeInMemoryAssignmentStore();
      const directorId = AgentAssignmentId.make("aa-d");
      yield* store.upsert({
        id: directorId,
        laneId: LANE_ID,
        role: "director",
        providerInstanceId: INSTANCE_ID,
        modelIntent: {
          capabilityTier: "advanced",
          latencyPreference: "balanced",
          costPreference: "balanced",
          continuityRequired: true,
          independentVerificationRequired: false,
        },
        resolvedModel: "gpt-5.4",
        reasoningLevel: "high",
        toolPolicyId: "director",
        environmentId: ENV_ID,
        threadId: ThreadId.make("t-d"),
        parentAssignmentId: null,
        ownership: null,
        status: "active",
        contextHealth: "healthy",
        supersedesAssignmentId: null,
        worktreePath: WORKTREE,
        taskSummary: "direct",
        lastResultSummary: null,
        lastTurnId: null,
        createdAt: NOW,
        updatedAt: NOW,
      });

      const snap = yield* store.snapshot();
      yield* store.replaceAll([]);
      const restored = yield* store.restore(snap);
      assert.strictEqual(restored.length, 1);
      assert.strictEqual(restored[0]?.role, "director");
      const topology = yield* store.topologyForLane(LANE_ID);
      assert.strictEqual(topology.directorAssignmentId, directorId);
    }),
  );
});
