import { expect, it } from "vite-plus/test";

import { parseLaneDeepLink } from "./CommandCenterShell";
import { COMMAND_CENTER_SECTION_ORDER } from "./sectionLabels";

it("parses lane deep links into branded environment and lane ids", () => {
  const parsed = parseLaneDeepLink("/lanes/env-mac-local/lane-f5-active");
  expect(parsed).not.toBeNull();
  expect(parsed?.environmentId).toBe("env-mac-local");
  expect(parsed?.laneId).toBe("lane-f5-active");
});

it("rejects non-lane deep links", () => {
  expect(parseLaneDeepLink("/command-center")).toBeNull();
  expect(parseLaneDeepLink("/lanes/only-one")).toBeNull();
});

it("keeps Projects home section order with distinct review and ready buckets", () => {
  expect(COMMAND_CENTER_SECTION_ORDER).toEqual([
    "needs-attention",
    "active",
    "ready-for-review",
    "ready-to-use",
    "node-activity",
  ]);
});
