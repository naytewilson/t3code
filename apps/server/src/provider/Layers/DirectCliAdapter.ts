import {
  EventId,
  ProviderDriverKind,
  RuntimeItemId,
  ThreadId,
  TurnId,
  type ModelSelection,
  type ProviderInstanceId,
  type ProviderInteractionMode,
  type ProviderRuntimeEvent,
  type ProviderSession,
  type ProviderTurnStartResult,
  type RuntimeMode,
} from "@t3tools/contracts";
import { getModelSelectionStringOptionValue } from "@t3tools/shared/model";
import { resolveSpawnCommand } from "@t3tools/shared/shell";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  ProviderAdapterProcessError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
  type ProviderAdapterError,
} from "../Errors.ts";
import type {
  ProviderAdapterShape,
  ProviderThreadSnapshot,
} from "../Services/ProviderAdapter.ts";
import { DIRECT_CLI_REASONING_OPTION_ID } from "../Drivers/DirectCliDriverSupport.ts";

export type DirectCliParsedLine =
  | { readonly kind: "assistant_delta"; readonly text: string }
  | {
      readonly kind: "result";
      readonly subtype?: string;
      readonly sessionId?: string;
      readonly stopReason?: string;
      readonly finalText?: string;
      readonly error?: string;
    };

export interface DirectCliTurnArgsInput {
  readonly prompt: string;
  readonly sessionId?: string;
  readonly model?: string;
  readonly reasoningEffort?: string;
  readonly runtimeMode: RuntimeMode;
  readonly interactionMode: ProviderInteractionMode;
}

interface DirectCliSessionState {
  session: ProviderSession;
  providerSessionId: string | undefined;
  readonly snapshot: ProviderThreadSnapshot;
  turns: Array<{ readonly id: TurnId; readonly items: ReadonlyArray<unknown> }>;
  activeChild: ChildProcessSpawner.ChildProcessHandle | undefined;
  activeTurnId: TurnId | undefined;
  interrupted: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResumeSessionId(raw: unknown): string | undefined {
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  if (!isRecord(raw)) return undefined;
  const candidate = raw.sessionId;
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : undefined;
}

function selectedModel(selection: ModelSelection | undefined): string | undefined {
  const model = selection?.model?.trim();
  return model && model !== "default" ? model : undefined;
}

function selectedEffort(selection: ModelSelection | undefined): string | undefined {
  const effort = getModelSelectionStringOptionValue(selection, DIRECT_CLI_REASONING_OPTION_ID)?.trim();
  return effort && effort !== "default" ? effort : undefined;
}

export const makeDirectCliAdapter = Effect.fn("makeDirectCliAdapter")(function* (input: {
  readonly provider: ProviderDriverKind;
  readonly instanceId: ProviderInstanceId;
  readonly binaryPath: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly sessionIdMode: "required-before-first-turn" | "reported-by-cli";
  readonly buildArgs: (input: DirectCliTurnArgsInput) => ReadonlyArray<string>;
  readonly parseStdoutLine: (line: string) => DirectCliParsedLine | undefined;
  readonly parseSessionLine?: (line: string) => string | undefined;
}) {
  const crypto = yield* Crypto.Crypto;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const scope = yield* Effect.scope;
  const events = yield* PubSub.unbounded<ProviderRuntimeEvent>();
  const sessions = new Map<ThreadId, DirectCliSessionState>();

  const nowIso = Effect.map(DateTime.now, DateTime.formatIso);
  const nextEventId = crypto.randomUUIDv4.pipe(Effect.map(EventId.make));
  const nextTurnId = crypto.randomUUIDv4.pipe(Effect.map(TurnId.make));
  const nextItemId = crypto.randomUUIDv4.pipe(Effect.map(RuntimeItemId.make));

  const emit = (event: ProviderRuntimeEvent) => PubSub.publish(events, event).pipe(Effect.asVoid);

  const missingSession = (threadId: ThreadId) =>
    Effect.fail(
      new ProviderAdapterSessionNotFoundError({
        provider: input.provider,
        threadId: String(threadId),
      }),
    );

  const updateProviderSessionId = (
    state: DirectCliSessionState,
    deferred: Deferred.Deferred<string>,
    sessionId: string | undefined,
  ) =>
    Effect.gen(function* () {
      const normalized = sessionId?.trim();
      if (!normalized) return;
      state.providerSessionId = normalized;
      const updatedAt = yield* nowIso;
      state.session = {
        ...state.session,
        resumeCursor: { sessionId: normalized },
        updatedAt,
      };
      yield* Deferred.succeed(deferred, normalized).pipe(Effect.ignore);
    });

  const startSession: ProviderAdapterShape<ProviderAdapterError>["startSession"] = (startInput) =>
    Effect.gen(function* () {
      if (startInput.provider !== undefined && startInput.provider !== input.provider) {
        return yield* new ProviderAdapterValidationError({
          provider: input.provider,
          operation: "startSession",
          issue: `Expected provider '${input.provider}' but received '${startInput.provider}'.`,
        });
      }

      const createdAt = yield* nowIso;
      const resumedSessionId = parseResumeSessionId(startInput.resumeCursor);
      const providerSessionId =
        resumedSessionId ??
        (input.sessionIdMode === "required-before-first-turn" ? yield* crypto.randomUUIDv4 : undefined);
      const session: ProviderSession = {
        provider: input.provider,
        providerInstanceId: input.instanceId,
        status: "ready",
        runtimeMode: startInput.runtimeMode,
        threadId: startInput.threadId,
        ...(startInput.cwd ? { cwd: startInput.cwd } : {}),
        ...(selectedModel(startInput.modelSelection)
          ? { model: selectedModel(startInput.modelSelection) }
          : {}),
        ...(providerSessionId ? { resumeCursor: { sessionId: providerSessionId } } : {}),
        createdAt,
        updatedAt: createdAt,
      };
      const turns: Array<{ readonly id: TurnId; readonly items: ReadonlyArray<unknown> }> = [];
      sessions.set(startInput.threadId, {
        session,
        providerSessionId,
        snapshot: { threadId: startInput.threadId, turns },
        turns,
        activeChild: undefined,
        activeTurnId: undefined,
        interrupted: false,
      });
      return session;
    });

  const sendTurn: ProviderAdapterShape<ProviderAdapterError>["sendTurn"] = (turnInput) =>
    Effect.gen(function* () {
      const state = sessions.get(turnInput.threadId);
      if (!state) return yield* missingSession(turnInput.threadId);
      if (state.activeChild !== undefined) {
        return yield* new ProviderAdapterValidationError({
          provider: input.provider,
          operation: "sendTurn",
          issue: `A turn is already running for thread ${turnInput.threadId}.`,
        });
      }
      if (!turnInput.input?.trim()) {
        return yield* new ProviderAdapterValidationError({
          provider: input.provider,
          operation: "sendTurn",
          issue: "Direct CLI turns require a non-empty text prompt.",
        });
      }
      if ((turnInput.attachments?.length ?? 0) > 0) {
        return yield* new ProviderAdapterValidationError({
          provider: input.provider,
          operation: "sendTurn",
          issue: "Direct CLI attachments are not supported by this adapter yet.",
        });
      }

      const turnId = yield* nextTurnId;
      const itemId = yield* nextItemId;
      const reportedSessionId = yield* Deferred.make<string>();
      const model = selectedModel(turnInput.modelSelection);
      const reasoningEffort = selectedEffort(turnInput.modelSelection);
      const interactionMode = turnInput.interactionMode ?? "default";
      const args = input.buildArgs({
        prompt: turnInput.input.trim(),
        ...(state.providerSessionId ? { sessionId: state.providerSessionId } : {}),
        ...(model ? { model } : {}),
        ...(reasoningEffort ? { reasoningEffort } : {}),
        runtimeMode: state.session.runtimeMode,
        interactionMode,
      });
      const resolved = yield* resolveSpawnCommand(input.binaryPath, args, {
        env: input.environment,
      });
      const child = yield* spawner
        .spawn(
          ChildProcess.make(resolved.command, resolved.args, {
            ...(state.session.cwd ? { cwd: state.session.cwd } : {}),
            env: input.environment,
            shell: resolved.shell,
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
          }),
        )
        .pipe(
          Effect.mapError(
            (cause) =>
              new ProviderAdapterProcessError({
                provider: input.provider,
                threadId: String(turnInput.threadId),
                detail: `Failed to start '${input.binaryPath}'.`,
                cause,
              }),
          ),
        );

      state.activeChild = child;
      state.activeTurnId = turnId;
      state.interrupted = false;
      state.session = {
        ...state.session,
        status: "running",
        activeTurnId: turnId,
        updatedAt: yield* nowIso,
      };

      yield* emit({
        type: "turn.started",
        eventId: yield* nextEventId,
        provider: input.provider,
        providerInstanceId: input.instanceId,
        threadId: turnInput.threadId,
        createdAt: yield* nowIso,
        turnId,
        payload: {
          ...(model ? { model } : {}),
          ...(reasoningEffort ? { effort: reasoningEffort } : {}),
        },
      });
      yield* emit({
        type: "item.started",
        eventId: yield* nextEventId,
        provider: input.provider,
        providerInstanceId: input.instanceId,
        threadId: turnInput.threadId,
        createdAt: yield* nowIso,
        turnId,
        itemId,
        payload: { itemType: "assistant_message", status: "inProgress" },
      });

      let assistantText = "";
      let finalResult: Extract<DirectCliParsedLine, { kind: "result" }> | undefined;
      const stderrLines: string[] = [];

      const handleParsedLine = (parsed: DirectCliParsedLine | undefined) =>
        Effect.gen(function* () {
          if (!parsed) return;
          if (parsed.kind === "assistant_delta") {
            if (parsed.text.length === 0) return;
            assistantText += parsed.text;
            yield* emit({
              type: "content.delta",
              eventId: yield* nextEventId,
              provider: input.provider,
              providerInstanceId: input.instanceId,
              threadId: turnInput.threadId,
              createdAt: yield* nowIso,
              turnId,
              itemId,
              payload: { streamKind: "assistant_text", delta: parsed.text },
            });
            return;
          }
          finalResult = parsed;
          yield* updateProviderSessionId(state, reportedSessionId, parsed.sessionId);
        });

      const stdoutEffect = child.stdout.pipe(
        Stream.decodeText,
        Stream.splitLines,
        Stream.runForEach((line) => handleParsedLine(input.parseStdoutLine(line))),
      );
      const stderrEffect = child.stderr.pipe(
        Stream.decodeText,
        Stream.splitLines,
        Stream.runForEach((line) =>
          Effect.gen(function* () {
            const trimmed = line.trim();
            if (trimmed && stderrLines.length < 40) stderrLines.push(trimmed);
            const sessionId = input.parseSessionLine?.(line);
            yield* updateProviderSessionId(state, reportedSessionId, sessionId);
          }),
        ),
      );

      const worker = Effect.gen(function* () {
        const [, , exitCode] = yield* Effect.all(
          [stdoutEffect, stderrEffect, child.exitCode.pipe(Effect.map(Number))],
          { concurrency: "unbounded" },
        );
        yield* updateProviderSessionId(state, reportedSessionId, finalResult?.sessionId);

        if (assistantText.length === 0 && finalResult?.finalText) {
          assistantText = finalResult.finalText;
          yield* emit({
            type: "content.delta",
            eventId: yield* nextEventId,
            provider: input.provider,
            providerInstanceId: input.instanceId,
            threadId: turnInput.threadId,
            createdAt: yield* nowIso,
            turnId,
            itemId,
            payload: { streamKind: "assistant_text", delta: finalResult.finalText },
          });
        }

        const interrupted = state.interrupted || exitCode === 130 || exitCode === 143;
        const succeeded = exitCode === 0 && finalResult?.subtype !== "error" && !interrupted;
        const failureMessage =
          finalResult?.error ?? stderrLines.at(-1) ?? `CLI exited with code ${exitCode}.`;

        yield* emit({
          type: "item.completed",
          eventId: yield* nextEventId,
          provider: input.provider,
          providerInstanceId: input.instanceId,
          threadId: turnInput.threadId,
          createdAt: yield* nowIso,
          turnId,
          itemId,
          payload: {
            itemType: "assistant_message",
            status: succeeded ? "completed" : "failed",
            ...(assistantText.trim() ? { detail: assistantText.trim() } : {}),
          },
        });

        if (!succeeded && !interrupted) {
          yield* emit({
            type: "runtime.error",
            eventId: yield* nextEventId,
            provider: input.provider,
            providerInstanceId: input.instanceId,
            threadId: turnInput.threadId,
            createdAt: yield* nowIso,
            turnId,
            payload: {
              message: failureMessage,
              class: "provider_error",
              detail: { exitCode, stderr: stderrLines },
            },
          });
        }

        yield* emit({
          type: "turn.completed",
          eventId: yield* nextEventId,
          provider: input.provider,
          providerInstanceId: input.instanceId,
          threadId: turnInput.threadId,
          createdAt: yield* nowIso,
          turnId,
          payload: {
            state: interrupted ? "interrupted" : succeeded ? "completed" : "failed",
            ...(finalResult?.stopReason ? { stopReason: finalResult.stopReason } : {}),
            ...(!succeeded && !interrupted ? { errorMessage: failureMessage } : {}),
          },
        });

        state.turns = [
          ...state.turns,
          {
            id: turnId,
            items: [
              { type: "userMessage", content: [{ type: "text", text: turnInput.input }] },
              ...(assistantText ? [{ type: "agentMessage", text: assistantText }] : []),
            ],
          },
        ];
        state.session = {
          ...state.session,
          status: "ready",
          activeTurnId: undefined,
          ...(state.providerSessionId ? { resumeCursor: { sessionId: state.providerSessionId } } : {}),
          updatedAt: yield* nowIso,
        };
      }).pipe(
        Effect.catchAll((cause) =>
          emit({
            type: "runtime.error",
            eventId: EventId.make(`direct-cli:${input.provider}:${turnId}:worker-error`),
            provider: input.provider,
            providerInstanceId: input.instanceId,
            threadId: turnInput.threadId,
            createdAt: new Date().toISOString(),
            turnId,
            payload: {
              message: `Direct CLI stream failed: ${String(cause)}`,
              class: "transport_error",
            },
          }),
        ),
        Effect.ensuring(
          Effect.sync(() => {
            state.activeChild = undefined;
            state.activeTurnId = undefined;
          }),
        ),
      );

      yield* Effect.forkIn(worker, scope);

      let resumeCursor = state.providerSessionId
        ? { sessionId: state.providerSessionId }
        : undefined;
      if (!resumeCursor && input.sessionIdMode === "reported-by-cli") {
        const sessionOption = yield* Deferred.await(reportedSessionId).pipe(
          Effect.timeoutOption("3 seconds"),
        );
        const sessionId = Option.getOrUndefined(sessionOption);
        if (sessionId) resumeCursor = { sessionId };
      }

      return {
        threadId: turnInput.threadId,
        turnId,
        ...(resumeCursor ? { resumeCursor } : {}),
      } satisfies ProviderTurnStartResult;
    });

  const interruptTurn: ProviderAdapterShape<ProviderAdapterError>["interruptTurn"] = (
    threadId,
    turnId,
  ) =>
    Effect.gen(function* () {
      const state = sessions.get(threadId);
      if (!state) return yield* missingSession(threadId);
      if (turnId !== undefined && state.activeTurnId !== undefined && turnId !== state.activeTurnId) {
        return;
      }
      state.interrupted = true;
      if (state.activeChild) {
        yield* state.activeChild.kill({ killSignal: "SIGINT", forceKillAfter: "2 seconds" }).pipe(
          Effect.mapError(
            (cause) =>
              new ProviderAdapterProcessError({
                provider: input.provider,
                threadId: String(threadId),
                detail: "Failed to interrupt direct CLI process.",
                cause,
              }),
          ),
        );
      }
    });

  const unsupportedInteractive = (operation: string, threadId: ThreadId) =>
    sessions.has(threadId)
      ? Effect.fail(
          new ProviderAdapterValidationError({
            provider: input.provider,
            operation,
            issue: "Headless direct CLI sessions cannot answer interactive approval or input requests.",
          }),
        )
      : missingSession(threadId);

  const stopSession: ProviderAdapterShape<ProviderAdapterError>["stopSession"] = (threadId) =>
    Effect.gen(function* () {
      const state = sessions.get(threadId);
      if (!state) return;
      if (state.activeChild) {
        yield* state.activeChild.kill({ forceKillAfter: "2 seconds" }).pipe(Effect.ignore);
      }
      sessions.delete(threadId);
    });

  const readThread: ProviderAdapterShape<ProviderAdapterError>["readThread"] = (threadId) => {
    const state = sessions.get(threadId);
    return state
      ? Effect.succeed({ threadId, turns: state.turns })
      : missingSession(threadId);
  };

  const rollbackThread: ProviderAdapterShape<ProviderAdapterError>["rollbackThread"] = (
    threadId,
    numTurns,
  ) => {
    const state = sessions.get(threadId);
    if (!state) return missingSession(threadId);
    if (numTurns === 0) return Effect.succeed({ threadId, turns: state.turns });
    return Effect.fail(
      new ProviderAdapterValidationError({
        provider: input.provider,
        operation: "rollbackThread",
        issue: "This direct CLI does not expose native conversation rollback.",
      }),
    );
  };

  const stopAll: ProviderAdapterShape<ProviderAdapterError>["stopAll"] = () =>
    Effect.forEach(
      Array.from(sessions.keys()),
      (threadId) => stopSession(threadId),
      { discard: true },
    );

  yield* Effect.addFinalizer(() => stopAll().pipe(Effect.ignore));

  return {
    provider: input.provider,
    capabilities: {
      sessionModelSwitch: "in-session",
      supportsConversationRollback: false,
    },
    startSession,
    sendTurn,
    interruptTurn,
    respondToRequest: (threadId) => unsupportedInteractive("respondToRequest", threadId),
    respondToUserInput: (threadId) => unsupportedInteractive("respondToUserInput", threadId),
    stopSession,
    listSessions: () => Effect.sync(() => Array.from(sessions.values(), (state) => state.session)),
    hasSession: (threadId) => Effect.succeed(sessions.has(threadId)),
    readThread,
    rollbackThread,
    stopAll,
    streamEvents: Stream.fromPubSub(events),
  } satisfies ProviderAdapterShape<ProviderAdapterError>;
});
