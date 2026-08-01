import type { AgentAssignmentId, EnvironmentId, WorkLaneId } from "@t3tools/contracts";

import type {
  AgentControlRequest,
  AgentControlResult,
  CommandCenterSnapshot,
  LaneWorkspaceView,
} from "./types.ts";

/**
 * Replaceable data/control boundary for F5/F6 UI.
 * Wave 1 may use a mock implementation; Wave 2 acceptance requires a live
 * projection/provider adapter over the same methods and domain types.
 */
export interface CommandCenterAdapter {
  readonly kind: "mock" | "live";
  getSnapshot(): Promise<CommandCenterSnapshot>;
  getLaneWorkspace(
    environmentId: EnvironmentId,
    laneId: WorkLaneId,
  ): Promise<LaneWorkspaceView | null>;
  dispatchAgentControl(request: AgentControlRequest): Promise<AgentControlResult>;
  openDeliverable(
    environmentId: EnvironmentId,
    laneId: WorkLaneId,
    deliverableId: string,
  ): Promise<{ readonly ok: boolean; readonly path: string | null; readonly message: string }>;
}

export type CommandCenterAdapterFactory = () => CommandCenterAdapter;

let activeAdapter: CommandCenterAdapter | null = null;

/** Test/dev seam — production wiring should set the live adapter once. */
export function setCommandCenterAdapter(adapter: CommandCenterAdapter): void {
  activeAdapter = adapter;
}

export function getCommandCenterAdapter(): CommandCenterAdapter {
  if (activeAdapter === null) {
    throw new Error(
      "CommandCenterAdapter not configured. Call setCommandCenterAdapter(...) before rendering F5/F6 surfaces.",
    );
  }
  return activeAdapter;
}

export function clearCommandCenterAdapter(): void {
  activeAdapter = null;
}

export function isAgentControlAvailable(
  status: string,
  action: AgentControlRequest["action"],
): boolean {
  switch (action) {
    case "steer":
    case "queue":
      return status === "active" || status === "waiting";
    case "pause":
      return status === "active" || status === "waiting";
    case "resume":
      return status === "paused";
    case "stop":
      return (
        status === "active" || status === "waiting" || status === "paused" || status === "starting"
      );
    case "replace":
      return status === "failed" || status === "cancelled" || status === "paused";
    case "review":
      return status === "active" || status === "completed" || status === "waiting";
    case "open-result":
      return status === "completed";
  }
}

export function assertAssignmentId(id: AgentAssignmentId): AgentAssignmentId {
  return id;
}
