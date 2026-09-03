import {
  type CommandCodeSettings,
  type ModelCapabilities,
  type ServerProvider,
  type ServerProviderAuth,
  type ServerProviderModel,
} from "@t3tools/contracts";
import type * as EffectAcpSchema from "effect-acp/schema";
import { causeErrorTag } from "@t3tools/shared/observability";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { createModelCapabilities } from "@t3tools/shared/model";
import { resolveSpawnCommand } from "@t3tools/shared/shell";

import {
  buildServerProvider,
  isCommandMissingCause,
  parseGenericCliVersion,
  providerModelsFromSettings,
  spawnAndCollect,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  type ProviderMaintenanceCapabilities,
} from "../providerMaintenance.ts";
import { makeCommandCodeAcpRuntime } from "../acp/CommandCodeAcpSupport.ts";
import { sessionModelStateFromInitialize } from "../acp/AcpRuntimeModel.ts";

const COMMANDCODE_PRESENTATION = {
  displayName: "Command Code",
  badgeLabel: "Early Access",
  showInteractionModeToggle: true,
} as const;
const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const VERSION_PROBE_TIMEOUT_MS = 4_000;
const BRIDGE_PROBE_TIMEOUT_MS = 15_000;
// `initialize` is a single local round trip plus `cmd --list-models`.
const COMMANDCODE_ACP_INITIALIZE_TIMEOUT_MS = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface CommandCodeBridgeProbe {
  readonly authenticated: boolean | null;
  readonly bridge: string | null;
  readonly cmdVersion: string | null;
  readonly catalogModels: number;
  readonly defaultModel: string | null;
}

/** Parse `commandcode-acp --probe` JSON. Never carries credentials. */
export function parseCommandCodeBridgeProbe(output: string): CommandCodeBridgeProbe | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  const authenticated =
    typeof parsed["authenticated"] === "boolean" ? (parsed["authenticated"] as boolean) : null;
  return {
    authenticated,
    bridge: typeof parsed["bridge"] === "string" ? (parsed["bridge"] as string) : null,
    cmdVersion: typeof parsed["cmdVersion"] === "string" ? (parsed["cmdVersion"] as string) : null,
    catalogModels:
      typeof parsed["catalogModels"] === "number" ? (parsed["catalogModels"] as number) : 0,
    defaultModel:
      typeof parsed["defaultModel"] === "string" ? (parsed["defaultModel"] as string) : null,
  };
}

/**
 * Command Code model ids are used verbatim (exact `cmd --model` ids).
 * The current model is marked default, mirroring the bridge catalog.
 */
export function buildCommandCodeModelsFromSessionModelState(
  modelState: EffectAcpSchema.SessionModelState | null | undefined,
): ReadonlyArray<ServerProviderModel> {
  if (!modelState || modelState.availableModels.length === 0) {
    return [];
  }
  const currentModelId = modelState.currentModelId.trim();
  const seen = new Set<string>();
  return modelState.availableModels.flatMap((model): ServerProviderModel[] => {
    const slug = model.modelId.trim();
    if (!slug || seen.has(slug)) {
      return [];
    }
    seen.add(slug);
    return [
      {
        slug,
        name: model.name.trim() || slug,
        isCustom: false,
        ...(model.modelId.trim() === currentModelId ? { isDefault: true } : {}),
        capabilities: EMPTY_CAPABILITIES,
      },
    ];
  });
}

export function buildInitialCommandCodeProviderSnapshot(
  commandCodeSettings: CommandCodeSettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = providerModelsFromSettings(
      [],
      commandCodeSettings.customModels ?? [],
      EMPTY_CAPABILITIES,
    );

    if (!commandCodeSettings.enabled) {
      return buildServerProvider({
        presentation: COMMANDCODE_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "Command Code is disabled in T3 Code settings.",
        },
      });
    }

    return buildServerProvider({
      presentation: COMMANDCODE_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Checking commandcode-acp availability...",
      },
    });
  });
}

const runBridgeCommand = (
  commandCodeSettings: CommandCodeSettings,
  args: ReadonlyArray<string>,
  environment: NodeJS.ProcessEnv,
) =>
  Effect.gen(function* () {
    const command = commandCodeSettings.binaryPath?.trim() || "commandcode-acp";
    const spawnCommand = yield* resolveSpawnCommand(command, args, { env: environment });
    return yield* spawnAndCollect(
      command,
      ChildProcess.make(spawnCommand.command, spawnCommand.args, {
        env: environment,
        shell: spawnCommand.shell,
      }),
    );
  });

/**
 * Reads models from `initialize._meta.modelState`. This never calls
 * `authenticate` or `session/new`, so a probe can never start an
 * interactive login or spawn a `cmd` turn.
 */
const discoverCommandCodeModelsViaAcpInitialize = (
  commandCodeSettings: CommandCodeSettings,
  environment: NodeJS.ProcessEnv,
) =>
  Effect.gen(function* () {
    const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const acp = yield* makeCommandCodeAcpRuntime({
      commandCodeSettings,
      environment,
      childProcessSpawner,
      cwd: process.cwd(),
      clientInfo: { name: "t3-code-provider-probe", version: "0.0.0" },
    });
    const initialized = yield* acp.initialize();
    return buildCommandCodeModelsFromSessionModelState(
      sessionModelStateFromInitialize(initialized),
    );
  }).pipe(Effect.scoped);

export const checkCommandCodeProviderStatus = Effect.fn("checkCommandCodeProviderStatus")(
  function* (
    commandCodeSettings: CommandCodeSettings,
    environment: NodeJS.ProcessEnv = process.env,
  ): Effect.fn.Return<
    ServerProviderDraft,
    never,
    ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto
  > {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    const fallbackModels = providerModelsFromSettings(
      [],
      commandCodeSettings.customModels ?? [],
      EMPTY_CAPABILITIES,
    );

    if (!commandCodeSettings.enabled) {
      return buildServerProvider({
        presentation: COMMANDCODE_PRESENTATION,
        enabled: false,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "Command Code is disabled in T3 Code settings.",
        },
      });
    }

    const versionResult = yield* runBridgeCommand(
      commandCodeSettings,
      ["--version"],
      environment,
    ).pipe(Effect.timeoutOption(VERSION_PROBE_TIMEOUT_MS), Effect.result);

    if (Result.isFailure(versionResult)) {
      const error = versionResult.failure;
      yield* Effect.logWarning("Command Code bridge health check failed.", {
        errorTag: error._tag,
      });
      return buildServerProvider({
        presentation: COMMANDCODE_PRESENTATION,
        enabled: commandCodeSettings.enabled,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: !isCommandMissingCause(error),
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: isCommandMissingCause(error)
            ? "commandcode-acp is not installed or not on PATH."
            : "Failed to execute the Command Code bridge health check.",
        },
      });
    }

    if (Option.isNone(versionResult.success)) {
      return buildServerProvider({
        presentation: COMMANDCODE_PRESENTATION,
        enabled: commandCodeSettings.enabled,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: true,
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: "commandcode-acp timed out while running `--version`.",
        },
      });
    }

    const versionOutput = versionResult.success.value;
    const version = parseGenericCliVersion(`${versionOutput.stdout}\n${versionOutput.stderr}`);
    if (versionOutput.code !== 0) {
      return buildServerProvider({
        presentation: COMMANDCODE_PRESENTATION,
        enabled: commandCodeSettings.enabled,
        checkedAt,
        models: fallbackModels,
        probe: {
          installed: true,
          version,
          status: "error",
          auth: { status: "unknown" },
          message: "commandcode-acp is installed but failed to run.",
        },
      });
    }

    // `--probe` reports cmd auth + catalog without credentials and without sessions.
    const probeResult = yield* runBridgeCommand(commandCodeSettings, ["--probe"], environment).pipe(
      Effect.timeoutOption(BRIDGE_PROBE_TIMEOUT_MS),
      Effect.result,
    );
    const probeOutput =
      Result.isSuccess(probeResult) &&
      Option.isSome(probeResult.success) &&
      probeResult.success.value.code === 0
        ? probeResult.success.value
        : undefined;
    const bridgeProbe = probeOutput
      ? parseCommandCodeBridgeProbe(`${probeOutput.stdout}`)
      : undefined;
    if (!probeOutput || !bridgeProbe) {
      yield* Effect.logWarning("Command Code bridge probe failed or timed out.");
    }

    const auth: ServerProviderAuth =
      bridgeProbe?.authenticated === true
        ? { status: "authenticated", type: "cached_token", label: "Command Code account" }
        : bridgeProbe?.authenticated === false
          ? { status: "unauthenticated" }
          : { status: "unknown" };

    const acpExit = yield* discoverCommandCodeModelsViaAcpInitialize(
      commandCodeSettings,
      environment,
    ).pipe(Effect.timeoutOption(COMMANDCODE_ACP_INITIALIZE_TIMEOUT_MS), Effect.exit);
    const acpModels = Exit.isSuccess(acpExit) ? Option.getOrElse(acpExit.value, () => []) : [];
    const acpFailed = Exit.isFailure(acpExit) || Option.isNone(acpExit.value);
    if (acpFailed) {
      yield* Effect.logWarning("Command Code ACP initialize probe failed or timed out.", {
        errorTag: Exit.isFailure(acpExit) ? causeErrorTag(acpExit.cause) : "Timeout",
      });
    }

    const models =
      acpModels.length > 0
        ? providerModelsFromSettings(
            acpModels,
            commandCodeSettings.customModels ?? [],
            EMPTY_CAPABILITIES,
          )
        : fallbackModels;

    if (auth.status === "unauthenticated") {
      return buildServerProvider({
        presentation: COMMANDCODE_PRESENTATION,
        enabled: commandCodeSettings.enabled,
        checkedAt,
        models,
        probe: {
          installed: true,
          version: bridgeProbe?.bridge ?? version,
          status: "error",
          auth,
          message:
            "commandcode-acp is installed but Command Code is not logged in. Run `cmd login` or set COMMAND_CODE_API_KEY.",
        },
      });
    }

    return buildServerProvider({
      presentation: COMMANDCODE_PRESENTATION,
      enabled: commandCodeSettings.enabled,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: bridgeProbe?.bridge ?? version,
        status: acpFailed ? "warning" : "ready",
        auth,
        ...(acpFailed
          ? {
              message:
                "commandcode-acp is installed but ACP initialize failed. Model options may be incomplete.",
            }
          : {}),
      },
    });
  },
);

export const enrichCommandCodeSnapshot = (input: {
  readonly snapshot: ServerProvider;
  readonly maintenanceCapabilities: ProviderMaintenanceCapabilities;
  readonly enableProviderUpdateChecks?: boolean;
  readonly publishSnapshot: (snapshot: ServerProvider) => Effect.Effect<void>;
  readonly httpClient: HttpClient.HttpClient;
}): Effect.Effect<void> => {
  const { snapshot, publishSnapshot } = input;

  return enrichProviderSnapshotWithVersionAdvisory(snapshot, input.maintenanceCapabilities, {
    enableProviderUpdateChecks: input.enableProviderUpdateChecks,
  }).pipe(
    Effect.provideService(HttpClient.HttpClient, input.httpClient),
    Effect.flatMap((enrichedSnapshot) => publishSnapshot(enrichedSnapshot)),
    Effect.catchCause((cause) =>
      Effect.logWarning("Command Code version advisory enrichment failed", {
        errorTag: causeErrorTag(cause),
      }),
    ),
    Effect.asVoid,
  );
};
