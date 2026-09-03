import {
  ProviderDriverKind,
  TextGenerationError,
  type ModelCapabilities,
  type ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { resolveSpawnCommand } from "@t3tools/shared/shell";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
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
}): ServerProviderShape {
  const probe = Effect.gen(function* () {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    const result = yield* Effect.gen(function* () {
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
    }).pipe(
      Effect.map((commandResult) => ({
        installed: true,
        version: parseGenericCliVersion(`${commandResult.stdout}\n${commandResult.stderr}`),
        status: commandResult.code === 0 ? ("ready" as const) : ("warning" as const),
        auth: { status: "unknown" as const },
        ...(commandResult.code === 0
          ? {}
          : { message: `Version probe exited with code ${commandResult.code}.` }),
      })),
      Effect.catchAll((cause) =>
        Effect.succeed(
          isCommandMissingCause(cause)
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
                message: `Could not probe ${input.presentationName}: ${String(cause)}`,
              },
        ),
      ),
    );

    const defaultModel = {
      slug: "default",
      name: "Default",
      shortName: "Default",
      isCustom: false,
      isDefault: true,
      capabilities: input.modelCapabilities,
    } as const;
    const draft = buildServerProvider({
      driver: input.provider,
      presentation: { displayName: input.presentationName },
      enabled: input.enabled,
      checkedAt,
      models: providerModelsFromSettings(
        [defaultModel],
        input.customModels,
        input.modelCapabilities,
      ),
      probe: result,
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
