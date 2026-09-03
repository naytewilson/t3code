import { type CommandCodeSettings, ProviderDriverKind, type RuntimeMode } from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import * as EffectAcpErrors from "effect-acp/errors";
import type * as EffectAcpSchema from "effect-acp/schema";

import * as AcpSessionRuntime from "./AcpSessionRuntime.ts";

const COMMANDCODE_AUTH_METHOD_ID = "commandcode_cli";

type CommandCodeAcpRuntimeCommandCodeSettings = Pick<CommandCodeSettings, "binaryPath">;

interface CommandCodeAcpRuntimeInput extends Omit<
  AcpSessionRuntime.AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly commandCodeSettings: CommandCodeAcpRuntimeCommandCodeSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
}

export const COMMANDCODE_RESUME_VERSION = 1 as const;

export interface CommandCodeResumeCursor {
  readonly schemaVersion: typeof COMMANDCODE_RESUME_VERSION;
  readonly cmdSessionId: string;
  readonly host: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCommandCodeResume(raw: unknown): CommandCodeResumeCursor | undefined {
  if (!isRecord(raw)) return undefined;
  if (raw["schemaVersion"] !== COMMANDCODE_RESUME_VERSION) return undefined;
  if (typeof raw["cmdSessionId"] !== "string" || !raw["cmdSessionId"].trim()) return undefined;
  if (typeof raw["host"] !== "string" || !raw["host"].trim()) return undefined;
  return {
    schemaVersion: COMMANDCODE_RESUME_VERSION,
    cmdSessionId: raw["cmdSessionId"].trim(),
    host: raw["host"].trim(),
  };
}

/**
 * Bridge modes advertised by commandcode-acp `session/new` (`modes`).
 * `full-access` deliberately maps to `auto-accept`, never to `cmd --yolo`:
 * the bridge offers no yolo mode and T3 must not silently escalate to one.
 */
export function resolveCommandCodeModeId(input: {
  readonly interactionMode: "plan" | undefined;
  readonly runtimeMode: RuntimeMode;
}): string {
  if (input.interactionMode === "plan") return "plan";
  if (input.runtimeMode === "full-access" || input.runtimeMode === "auto-accept-edits") {
    return "auto-accept";
  }
  return "default";
}

export function buildCommandCodeAcpSpawnInput(
  commandCodeSettings: CommandCodeAcpRuntimeCommandCodeSettings | null | undefined,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
): AcpSessionRuntime.AcpSpawnInput {
  return {
    command: commandCodeSettings?.binaryPath?.trim() || "commandcode-acp",
    args: [],
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}

export const makeCommandCodeAcpRuntime = (
  input: CommandCodeAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError,
  Crypto.Crypto | Scope.Scope
> =>
  Effect.gen(function* () {
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildCommandCodeAcpSpawnInput(
          input.commandCodeSettings,
          input.cwd,
          input.environment,
        ),
        authMethodId: COMMANDCODE_AUTH_METHOD_ID,
      }).pipe(
        Layer.provide(
          Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, input.childProcessSpawner),
        ),
      ),
    );
    return yield* Effect.service(AcpSessionRuntime.AcpSessionRuntime).pipe(
      Effect.provide(acpContext),
    );
  });

interface CommandCodeAcpModelSelectionRuntime {
  readonly getConfigOptions: AcpSessionRuntime.AcpSessionRuntime["Service"]["getConfigOptions"];
  readonly setConfigOption: (
    configId: string,
    value: string | boolean,
  ) => Effect.Effect<unknown, EffectAcpErrors.AcpError>;
  readonly setModel: (model: string) => Effect.Effect<unknown, EffectAcpErrors.AcpError>;
}

/**
 * Command Code model ids are used verbatim (exact `cmd --model` ids, e.g.
 * `moonshotai/kimi-k2.5`); no product-slug translation like Grok's
 * `grok-build`. Effort travels as the bridge `effort` config option.
 */
export function applyCommandCodeAcpModelSelection<E>(input: {
  readonly runtime: CommandCodeAcpModelSelectionRuntime;
  readonly model: string | null | undefined;
  readonly effort: string | null | undefined;
  readonly mapError: (context: {
    cause: EffectAcpErrors.AcpError;
    step: "set-model" | "set-effort";
  }) => E;
}): Effect.Effect<void, E> {
  return Effect.gen(function* () {
    const model = input.model?.trim();
    if (model) {
      yield* input.runtime
        .setModel(model)
        .pipe(Effect.mapError((cause) => input.mapError({ cause, step: "set-model" })));
    }
    const effort = input.effort?.trim();
    if (effort) {
      yield* input.runtime
        .setConfigOption("effort", effort)
        .pipe(Effect.mapError((cause) => input.mapError({ cause, step: "set-effort" })));
    }
  });
}

export function commandCodeModelFromSessionSetup(input: {
  readonly configOptions: ReadonlyArray<EffectAcpSchema.SessionConfigOption>;
  readonly modelState: { readonly currentModelId?: string } | null | undefined;
}): string | undefined {
  const fromModelState = input.modelState?.currentModelId?.trim();
  if (fromModelState) return fromModelState;
  const modelOption = input.configOptions.find(
    (option) => option.id.trim().toLowerCase() === "model",
  );
  if (
    modelOption &&
    "currentValue" in modelOption &&
    typeof modelOption.currentValue === "string"
  ) {
    const current = modelOption.currentValue.trim();
    if (current) return current;
  }
  return undefined;
}
