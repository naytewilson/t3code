import { describe, expect, it } from "vite-plus/test";

import {
  EFFORT_CONFIG_ID,
  EFFORT_DEFAULT,
  effortConfigOption,
  parseEffortValue,
  toReasoningTier,
} from "../src/effort.js";

describe("muse reasoning effort", () => {
  it("advertises a thought_level select option defaulting to agent default", () => {
    expect(effortConfigOption(EFFORT_DEFAULT)).toMatchObject({
      id: EFFORT_CONFIG_ID,
      category: "thought_level",
      type: "select",
      currentValue: "default",
    });
    const option = effortConfigOption(EFFORT_DEFAULT);
    if (option.type !== "select") throw new Error("expected select option");
    expect(option.options.map((entry) => ("value" in entry ? entry.value : null))).toEqual([
      "default",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "ultra",
    ]);
  });

  it("accepts every advertised value and rejects unknown values closed", () => {
    for (const value of [
      "default",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "ultra",
    ] as const) {
      expect(parseEffortValue(value)).toBe(value);
    }
    expect(() => parseEffortValue("turbo")).toThrow();
    expect(() => parseEffortValue(undefined)).toThrow();
  });

  it("omits the SDK tier on default and forwards exact tiers otherwise", () => {
    expect(toReasoningTier("default")).toBeUndefined();
    expect(toReasoningTier("minimal")).toBe("minimal");
    expect(toReasoningTier("xhigh")).toBe("xhigh");
    expect(toReasoningTier("bogus")).toBeUndefined();
  });
});
