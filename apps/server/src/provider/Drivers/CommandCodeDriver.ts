import {
  CommandCodeSettings,
  ProviderDriverKind,
  type ServerProviderModel,
} from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { makeCommandCodeAdapter, parseCommandCodeModelList } from "../Layers/CommandCodeAdapter.ts";
import {
  makeDirectCliModelCapabilities,
  makeDirectCliServerProvider,
  makeUnsupportedTextGeneration,
} from "./DirectCliDriverSupport.ts";
import { mergeProviderInstanceEnvironment } from "../ProviderInstanceEnvironment.ts";
import { spawnAndCollect } from "../providerSnapshot.ts";
import { resolveSpawnCommand } from "@t3tools/shared/shell";
import {
  defaultProviderContinuationIdentity,
  type ProviderDriver,
  type ProviderInstance,
} from "../ProviderDriver.ts";

const DRIVER_KIND = ProviderDriverKind.make("commandcode");
const decodeSettings = Schema.decodeSync(CommandCodeSettings);
const MODEL_CAPABILITIES = makeDirectCliModelCapabilities(["low", "medium", "high", "xhigh"]);

export type CommandCodeDriverEnv = Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner;

export const CommandCodeDriver: ProviderDriver<CommandCodeSettings, CommandCodeDriverEnv> = {
  driverKind: DRIVER_KIND,
  metadata: {
    displayName: "Command Code",
    supportsMultipleInstances: true,
  },
  configSchema: CommandCodeSettings,
  defaultConfig: (): CommandCodeSettings => decodeSettings({}),
  create: ({ instanceId, displayName, accentColor, environment, enabled, config }) =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const processEnv = mergeProviderInstanceEnvironment(environment);
      const effectiveConfig = { ...config, enabled } satisfies CommandCodeSettings;
      const continuationIdentity = defaultProviderContinuationIdentity({
        driverKind: DRIVER_KIND,
        instanceId,
      });
      const adapter = yield* makeCommandCodeAdapter(effectiveConfig, {
        environment: processEnv,
        instanceId,
      });
      const snapshot = makeDirectCliServerProvider({
        provider: DRIVER_KIND,
        instanceId,
        displayName,
        accentColor,
        continuationGroupKey: continuationIdentity.continuationKey,
        presentationName: "Command Code",
        binaryPath: effectiveConfig.binaryPath,
        environment: processEnv,
        enabled,
        customModels: effectiveConfig.customModels,
        modelCapabilities: MODEL_CAPABILITIES,
        spawner,
        discoverModels: () =>
          Effect.gen(function* () {
            const resolved = yield* resolveSpawnCommand(
              effectiveConfig.binaryPath,
              ["--list-models"],
              { env: processEnv },
            );
            const result = yield* spawnAndCollect(
              effectiveConfig.binaryPath,
              ChildProcess.make(resolved.command, resolved.args, {
                env: processEnv,
                shell: resolved.shell,
                stdin: "ignore",
              }),
            ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));
            if (result.code !== 0) return [];
            return parseCommandCodeModelList(`${result.stdout}\n${result.stderr}`).map(
              (model): ServerProviderModel => ({
                slug: model.slug,
                name: model.shortName,
                shortName: model.shortName,
                aliases: [model.shortName],
                isCustom: false,
                capabilities: MODEL_CAPABILITIES,
              }),
            );
          }),
      });

      return {
        instanceId,
        driverKind: DRIVER_KIND,
        continuationIdentity,
        displayName,
        accentColor,
        enabled,
        snapshot,
        adapter,
        textGeneration: makeUnsupportedTextGeneration("Command Code"),
      } satisfies ProviderInstance;
    }),
};
