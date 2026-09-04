import {
  ProviderDriverKind,
  TextGenerationError,
  type ModelCapabilities,
  type ProviderInstanceId,
  type ServerProvider,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { resolveSpawnCommand } from "@t3tools/shared/shell";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import type * as TextGeneration from "../../textGeneration/TextGeneration.ts";
import {
  buildSelectOptionDescriptor,
  buildServerProvider,
  isCommandMissingCause,
  parseGenericCliVersion,
  providerModelsFromSettings,
  spawnAndCollect,
} from "../providerSnapshot.ts";
import { makeManualOnlyProviderMaintenanceCapabilities } from "../providerMaintenance.ts";
import type { ServerProviderShape } from "../Services/ServerProvider.ts";
import { withInstanceIdentity } from "./instanceIdentity.ts";

export const DIRECT_CLI_REASONING_OPTION_ID = "reasoningEffort";

export function makeDirectCliModelCapabilities(
  effortValues: ReadonlyArray<string>,
): ModelCapabilities {
  return {
    optionDescriptors: [
      buildSelectOptionDescriptor({
        id: DIRECT_CLI_REASONING_OPTION_ID,
        label: "Reasoning effort",
        description: "Native CLI reasoning effort for this turn.",
        options: [
          { value: "default", label: "Default", isDefault: true },
          ...effortValues.map((value) => ({
            value,
            label: value === "xhigh" ? "Extra high" : value[0]!.toUpperCase() + value.slice(1),
          })),
        ],
      }),
    ],
  };
}

export function makeUnsupportedTextGeneration(
  label: string,
): TextGeneration.TextGeneration["Service"] {
  const unsupported = (operation: string) =>
    Effect.fail(
      new TextGenerationError({
        operation,
        detail: `${label} direct CLI instances do not provide auxiliary text-generation operations.`,
      }),
    );

  return {
    generateCommitMessage: () => unsupported("generateCommitMessage"),
    generatePrContent: () => unsupported("generatePrContent"),
    generateBranchName: () => unsupported("generateBranchName"),
    generateThreadTitle: () => unsupported("generateThreadTitle"),
  };
}

export function makeDirectCliServerProvider(input: {
  readonly provider: ProviderDriverKind;
  readonly instanceId: ProviderInstanceId;
  readonly displayName: string | undefined;
  readonly accentColor: string | undefined;
  readonly continuationGroupKey: string;
  readonly presentationName: string;
  readonly binaryPath: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly enabled: boolean;
  readonly customModels: ReadonlyArray<string>;
  readonly modelCapabilities: ModelCapabilities;
  readonly spawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  /**
   * Optional live model discovery. Runs inside the snapshot probe (and
   * therefore on every provider refresh). Return discovered
   * `ServerProviderModel` entries, or an empty array / failure when
   * discovery is unsupported or genuinely fails — the probe keeps the
   * bounded "Default" fallback in that case. The `default` slug is
   * reserved for the fallback and filtered out of discovery results.
   */
  readonly discoverModels?: () => Effect.Effect<ReadonlyArray<ServerProviderModel>>;
}): ServerProviderShape {
  const probe = Effect.gen(function* () {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    const probeResult = yield* Effect.gen(function* () {
      const resolved = yield* resolveSpawnCommand(input.binaryPath, ["--version"], {
        env: input.environment,
      });
      return yield* spawnAndCollect(
        input.binaryPath,
        ChildProcess.make(resolved.command, resolved.args, {
          env: input.environment,
          shell: resolved.shell,
          stdin: "ignore",
        }),
      ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, input.spawner));
    }).pipe(Effect.result);

    const probe = Result.isFailure(probeResult)
      ? isCommandMissingCause(probeResult.failure)
        ? {
            installed: false,
            version: null,
            status: "error" as const,
            auth: { status: "unknown" as const },
            message: `${input.presentationName} CLI was not found at '${input.binaryPath}'.`,
          }
        : {
            installed: true,
            version: null,
            status: "warning" as const,
            auth: { status: "unknown" as const },
            message: `Could not probe ${input.presentationName}: ${String(probeResult.failure)}`,
          }
      : {
          installed: true,
          version: parseGenericCliVersion(
            `${probeResult.success.stdout}\n${probeResult.success.stderr}`,
          ),
          status: probeResult.success.code === 0 ? ("ready" as const) : ("warning" as const),
          auth: { status: "unknown" as const },
          ...(probeResult.success.code === 0
            ? {}
            : { message: `Version probe exited with code ${probeResult.success.code}.` }),
        };

    const defaultModel = {
      slug: "default",
      name: "Default",
      shortName: "Default",
      isCustom: false,
      isDefault: true,
      capabilities: input.modelCapabilities,
    } as const;
    const discoveredModels = yield* (input.discoverModels?.() ?? Effect.succeed([])).pipe(
      Effect.orElseSucceed((): ReadonlyArray<ServerProviderModel> => []),
      Effect.map((models) => models.filter((model) => model.slug !== "default")),
    );
    const builtInModels: ReadonlyArray<ServerProviderModel> =
      discoveredModels.length > 0 ? [...discoveredModels] : [defaultModel];
    const draft = buildServerProvider({
      driver: input.provider,
      presentation: { displayName: input.presentationName },
      enabled: input.enabled,
      checkedAt,
      models: providerModelsFromSettings(
        builtInModels,
        input.customModels,
        input.modelCapabilities,
      ),
      probe,
    });
    const snapshot = withInstanceIdentity({
      instanceId: input.instanceId,
      driverKind: input.provider,
      displayName: input.displayName,
      accentColor: input.accentColor,
      continuationGroupKey: input.continuationGroupKey,
    })(draft);
    return {
      ...snapshot,
      supportsConversationRollback: false,
      supportsTextGeneration: false,
      setup: { canAuthenticate: false, canInstall: false },
    } satisfies ServerProvider;
  });

  return {
    maintenanceCapabilities: makeManualOnlyProviderMaintenanceCapabilities({
      provider: input.provider,
      packageName: null,
    }),
    getSnapshot: probe,
    refresh: probe,
    streamChanges: Stream.empty,
  };
}
