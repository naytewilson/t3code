import {
  MuseSettings,
  ProviderDriverKind,
} from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ChildProcessSpawner } from "effect/unstable/process";

import { makeMuseAdapter } from "../Layers/MuseAdapter.ts";
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

const DRIVER_KIND = ProviderDriverKind.make("muse");
const decodeSettings = Schema.decodeSync(MuseSettings);
const MODEL_CAPABILITIES = makeDirectCliModelCapabilities(["low", "medium", "high", "xhigh"]);

export type MuseDriverEnv = Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner;

export const MuseDriver: ProviderDriver<MuseSettings, MuseDriverEnv> = {
  driverKind: DRIVER_KIND,
  metadata: {
    displayName: "Muse Code",
    supportsMultipleInstances: true,
  },
  configSchema: MuseSettings,
  defaultConfig: (): MuseSettings => decodeSettings({}),
  create: ({ instanceId, displayName, accentColor, environment, enabled, config }) =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const processEnv = mergeProviderInstanceEnvironment(environment);
      const effectiveConfig = { ...config, enabled } satisfies MuseSettings;
      const continuationIdentity = defaultProviderContinuationIdentity({
        driverKind: DRIVER_KIND,
        instanceId,
      });
      const adapter = yield* makeMuseAdapter(effectiveConfig, {
        environment: processEnv,
        instanceId,
      });
      const snapshot = makeDirectCliServerProvider({
        provider: DRIVER_KIND,
        instanceId,
        displayName,
        accentColor,
        continuationGroupKey: continuationIdentity.continuationKey,
        presentationName: "Muse Code",
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
        textGeneration: makeUnsupportedTextGeneration("Muse Code"),
      } satisfies ProviderInstance;
    }),
};
