import {
  CommandCodeSettings,
  ProviderDriverKind,
} from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ChildProcessSpawner } from "effect/unstable/process";

import { makeCommandCodeAdapter } from "../Layers/CommandCodeAdapter.ts";
import {
  makeDirectCliModelCapabilities,
  makeDirectCliServerProvider,
  makeUnsupportedTextGeneration,
} from "./DirectCliDriverSupport.ts";
import { mergeProviderInstanceEnvironment } from "../ProviderInstanceEnvironment.ts";
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
