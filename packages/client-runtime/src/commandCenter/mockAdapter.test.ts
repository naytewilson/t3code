import { AgentAssignmentId, EnvironmentId, WorkLaneId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import { isAgentControlAvailable } from "./adapter.ts";
import { createMockCommandCenterAdapter } from "./mockAdapter.ts";

it("mock adapter exposes real WorkLaneShell cards across required sections", async () => {
  const adapter = createMockCommandCenterAdapter();
  expect(adapter.kind).toBe("mock");
  const snapshot = await adapter.getSnapshot();
  const sections = new Set(snapshot.cards.map((card) => card.section));
  expect(sections.has("active")).toBe(true);
  expect(sections.has("needs-attention")).toBe(true);
  expect(sections.has("ready-for-review")).toBe(true);
  expect(sections.has("ready-to-use")).toBe(true);
  expect(snapshot.nodeActivity.length).toBeGreaterThan(0);
  for (const card of snapshot.cards) {
    expect(card.deepLink.startsWith("/lanes/")).toBe(true);
    expect(card.lane.id.length).toBeGreaterThan(0);
    expect(card.project.id.length).toBeGreaterThan(0);
  }
});

it("lane workspace returns director/workers and control-ready assignments", async () => {
  const adapter = createMockCommandCenterAdapter();
  const env = EnvironmentId.make("env-mac-local");
  const workspace = await adapter.getLaneWorkspace(env, WorkLaneId.make("lane-f5-active"));
  expect(workspace).not.toBeNull();
  expect(workspace?.director?.role).toBe("director");
  expect(workspace?.workers.some((worker) => worker.role === "executor")).toBe(true);
  expect(workspace?.taskObjective.length).toBeGreaterThan(0);
  expect(workspace?.worktreePath).toContain("t3code-macbrains-f5-command-center");
});

it("agent controls mutate assignment status through the adapter seam", async () => {
  const adapter = createMockCommandCenterAdapter();
  const env = EnvironmentId.make("env-mac-local");
  const laneId = WorkLaneId.make("lane-f5-active");
  const assignmentId = AgentAssignmentId.make("assign-executor-1");

  expect(isAgentControlAvailable("active", "pause")).toBe(true);
  const paused = await adapter.dispatchAgentControl({
    action: "pause",
    assignmentId,
    laneId,
    environmentId: env,
  });
  expect(paused.ok).toBe(true);
  expect(paused.resultingStatus).toBe("paused");

  const resumed = await adapter.dispatchAgentControl({
    action: "resume",
    assignmentId,
    laneId,
    environmentId: env,
  });
  expect(resumed.ok).toBe(true);
  expect(resumed.resultingStatus).toBe("active");

  const steered = await adapter.dispatchAgentControl({
    action: "steer",
    assignmentId,
    laneId,
    environmentId: env,
    instruction: "Focus on Projects home cards",
  });
  expect(steered.ok).toBe(true);
});

it("refuses unavailable controls instead of silently succeeding", async () => {
  const adapter = createMockCommandCenterAdapter();
  const result = await adapter.dispatchAgentControl({
    action: "resume",
    assignmentId: AgentAssignmentId.make("assign-executor-1"),
    laneId: WorkLaneId.make("lane-f5-active"),
    environmentId: EnvironmentId.make("env-mac-local"),
  });
  expect(result.ok).toBe(false);
});
