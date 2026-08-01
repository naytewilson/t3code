import { EnvironmentId, WorkLaneId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import {
  commandCenterHomePath,
  laneAgentPath,
  laneDeliverablePath,
  laneWorkspacePath,
} from "./deepLinks.ts";

it("builds stable command-center and lane deep links", () => {
  const env = EnvironmentId.make("env-1");
  const lane = WorkLaneId.make("lane-1");
  expect(commandCenterHomePath()).toBe("/command-center");
  expect(laneWorkspacePath(env, lane)).toBe("/lanes/env-1/lane-1");
  expect(laneDeliverablePath(env, lane, "d1")).toBe("/lanes/env-1/lane-1/deliverables/d1");
  expect(laneAgentPath(env, lane, "a1")).toBe("/lanes/env-1/lane-1/agents/a1");
});
