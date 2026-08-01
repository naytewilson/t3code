import { describe, expect, it } from "@effect/vitest";
import * as Schema from "effect/Schema";

import { AgentAssignmentId, EnvironmentId, ThreadId, WorkLaneId } from "./baseSchemas.ts";
import { ProviderInstanceId } from "./providerInstance.ts";
import {
  AgentAssignment,
  AgentRole,
  DEFAULT_MODEL_INTENT_BY_ROLE,
  DirectorToolName,
  isSpawnableAgentRole,
} from "./agentAssignment.ts";

describe("agentAssignment contracts", () => {
  it("accepts durable director/executor/advisor/verifier/recovery roles", () => {
    expect(Schema.decodeSync(AgentRole)("director")).toBe("director");
    expect(Schema.decodeSync(AgentRole)("executor")).toBe("executor");
    expect(Schema.decodeSync(AgentRole)("advisor")).toBe("advisor");
    expect(Schema.decodeSync(AgentRole)("verifier")).toBe("verifier");
    expect(Schema.decodeSync(AgentRole)("recovery")).toBe("recovery");
    expect(isSpawnableAgentRole("director")).toBe(false);
    expect(isSpawnableAgentRole("executor")).toBe(true);
  });

  it("lists the nine director tools from the F3 launch packet", () => {
    const tools = Schema.decodeSync(Schema.Array(DirectorToolName))([
      "spawn_worker",
      "send_instruction",
      "request_status",
      "steer_worker",
      "pause_worker",
      "resume_worker",
      "stop_worker",
      "replace_worker",
      "request_review",
    ]);
    expect(tools).toHaveLength(9);
  });

  it("round-trips a started assignment with parent/thread binding", () => {
    const assignment = Schema.decodeSync(AgentAssignment)({
      id: AgentAssignmentId.make("aa-director-1"),
      laneId: WorkLaneId.make("lane-1"),
      role: "director",
      providerInstanceId: ProviderInstanceId.make("codex"),
      modelIntent: DEFAULT_MODEL_INTENT_BY_ROLE.director,
      resolvedModel: "gpt-5.4",
      reasoningLevel: "high",
      toolPolicyId: "director",
      environmentId: EnvironmentId.make("env-1"),
      threadId: ThreadId.make("thread-director"),
      parentAssignmentId: null,
      ownership: null,
      status: "active",
      contextHealth: "healthy",
      supersedesAssignmentId: null,
      worktreePath: "/tmp/lane-wt",
      taskSummary: "Direct lane work",
      lastResultSummary: null,
      lastTurnId: null,
      createdAt: "2026-07-31T00:00:00.000Z",
      updatedAt: "2026-07-31T00:00:00.000Z",
    });
    expect(assignment.role).toBe("director");
    expect(assignment.threadId).toBe("thread-director");
    expect(assignment.modelIntent.continuityRequired).toBe(true);
  });
});
