import { EnvironmentId, ProjectId, WorkLaneId, type WorkLaneShell } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import {
  attentionReasonForLane,
  classifyLaneShell,
  groupCardsBySection,
  nextActionForSection,
} from "./classify.ts";
import type { CommandCenterCard } from "./types.ts";

const NOW = "2026-07-31T18:00:00.000Z";

function shell(state: WorkLaneShell["state"]): WorkLaneShell {
  return {
    id: WorkLaneId.make(`lane-${state}`),
    projectId: ProjectId.make("project-1"),
    title: state,
    state,
    priority: "normal",
    classification: "substantial",
    environmentId: EnvironmentId.make("env-1"),
    branch: "macbrains/f5-command-center",
    worktreePath: "/tmp/lane",
    sourceTruthRevisionId: null,
    sourceTruthSummary: null,
    primaryThreadId: null,
    importedThreadId: null,
    objectiveSummary: "objective",
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
  };
}

it("keeps ready-for-review distinct from ready-to-use", () => {
  expect(classifyLaneShell(shell("reviewing"))).toBe("ready-for-review");
  expect(classifyLaneShell(shell("deliverable-ready"))).toBe("ready-to-use");
  expect(classifyLaneShell(shell("completed"), { hasReadyDeliverable: true })).toBe("ready-to-use");
});

it("routes blockers and failures into needs-attention", () => {
  expect(classifyLaneShell(shell("blocked"))).toBe("needs-attention");
  expect(classifyLaneShell(shell("failed"))).toBe("needs-attention");
  expect(classifyLaneShell(shell("executing"), { hasFailedCheck: true })).toBe("needs-attention");
  expect(attentionReasonForLane(shell("blocked"))).toBe("Lane blocked");
});

it("classifies ordinary lifecycle states as active", () => {
  expect(classifyLaneShell(shell("queued"))).toBe("active");
  expect(classifyLaneShell(shell("executing"))).toBe("active");
  expect(classifyLaneShell(shell("testing"))).toBe("active");
  expect(nextActionForSection("active", "planned")).toBe("Start execution");
});

it("groups cards by section without mixing review and ready", () => {
  const cards = [
    { section: "ready-for-review" },
    { section: "ready-to-use" },
    { section: "active" },
  ] as const satisfies ReadonlyArray<Pick<CommandCenterCard, "section">>;
  const grouped = groupCardsBySection(cards);
  expect(grouped["ready-for-review"]).toHaveLength(1);
  expect(grouped["ready-to-use"]).toHaveLength(1);
  expect(grouped.active).toHaveLength(1);
  expect(grouped["node-activity"]).toHaveLength(0);
});
