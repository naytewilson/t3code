import type { EnvironmentId, WorkLaneId } from "@t3tools/contracts";

/**
 * Proposed app routes — Integrator must wire navigation root / route tree.
 * Cards and lane screens use these strings so deep-links stay stable.
 */
export function commandCenterHomePath(): string {
  return "/command-center";
}

export function laneWorkspacePath(environmentId: EnvironmentId, laneId: WorkLaneId): string {
  return `/lanes/${environmentId}/${laneId}`;
}

export function laneDeliverablePath(
  environmentId: EnvironmentId,
  laneId: WorkLaneId,
  deliverableId: string,
): string {
  return `/lanes/${environmentId}/${laneId}/deliverables/${deliverableId}`;
}

export function laneAgentPath(
  environmentId: EnvironmentId,
  laneId: WorkLaneId,
  assignmentId: string,
): string {
  return `/lanes/${environmentId}/${laneId}/agents/${assignmentId}`;
}
