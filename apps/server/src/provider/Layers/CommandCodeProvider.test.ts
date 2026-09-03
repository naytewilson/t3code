import { describe, expect, it } from "@effect/vitest";

import {
  buildCommandCodeModelsFromSessionModelState,
  parseCommandCodeBridgeProbe,
} from "./CommandCodeProvider.ts";

describe("parseCommandCodeBridgeProbe", () => {
  it("parses a full probe payload", () => {
    expect(
      parseCommandCodeBridgeProbe(
        JSON.stringify({
          bridge: "0.1.0",
          cmdBin: "cmd",
          cmdVersion: "1.15.1",
          cmdExit: 0,
          authenticated: true,
          model: "poolside/laguna-s-2.1-free",
          catalogModels: 52,
          defaultModel: "poolside/laguna-s-2.1-free",
        }),
      ),
    ).toEqual({
      authenticated: true,
      bridge: "0.1.0",
      cmdVersion: "1.15.1",
      catalogModels: 52,
      defaultModel: "poolside/laguna-s-2.1-free",
    });
  });

  it("tolerates missing fields and malformed JSON", () => {
    expect(parseCommandCodeBridgeProbe("not json")).toBeUndefined();
    expect(parseCommandCodeBridgeProbe("[1,2]")).toBeUndefined();
    expect(parseCommandCodeBridgeProbe("{}")).toEqual({
      authenticated: null,
      bridge: null,
      cmdVersion: null,
      catalogModels: 0,
      defaultModel: null,
    });
  });
});

describe("buildCommandCodeModelsFromSessionModelState", () => {
  it("preserves exact cmd model ids and marks the current default", () => {
    const models = buildCommandCodeModelsFromSessionModelState({
      currentModelId: "moonshotai/kimi-k2.5",
      availableModels: [
        { modelId: "poolside/laguna-s-2.1-free", name: "poolside/laguna-s-2.1-free" },
        { modelId: "moonshotai/kimi-k2.5", name: "moonshotai/kimi-k2.5" },
        { modelId: "moonshotai/kimi-k2.5", name: "duplicate" },
      ],
    });
    expect(models.map((m) => m.slug)).toEqual([
      "poolside/laguna-s-2.1-free",
      "moonshotai/kimi-k2.5",
    ]);
    expect(models.find((m) => m.slug === "moonshotai/kimi-k2.5")?.isDefault).toBe(true);
    expect(models.find((m) => m.slug === "poolside/laguna-s-2.1-free")?.isDefault).toBeUndefined();
  });

  it("returns empty for missing state", () => {
    expect(buildCommandCodeModelsFromSessionModelState(null)).toEqual([]);
    expect(
      buildCommandCodeModelsFromSessionModelState({ currentModelId: "x", availableModels: [] }),
    ).toEqual([]);
  });
});
