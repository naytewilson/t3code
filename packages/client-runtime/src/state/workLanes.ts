import type {
  EnvironmentId,
  OrchestrationLaneStreamItem,
  WorkLaneDetailSnapshot,
  WorkLaneId,
  WorkLaneShell,
} from "@t3tools/contracts";

/**
 * In-memory lane shells keyed by environment, mirroring thread shell storage.
 * Full lane detail is loaded on demand via HTTP/WS — not kept in the shell map.
 */
export type WorkLaneShellMap = ReadonlyMap<WorkLaneId, WorkLaneShell>;

export function emptyWorkLaneShellMap(): WorkLaneShellMap {
  return new Map();
}

export function upsertWorkLaneShell(map: WorkLaneShellMap, lane: WorkLaneShell): WorkLaneShellMap {
  const next = new Map(map);
  next.set(lane.id, lane);
  return next;
}

export function removeWorkLaneShell(map: WorkLaneShellMap, laneId: WorkLaneId): WorkLaneShellMap {
  if (!map.has(laneId)) return map;
  const next = new Map(map);
  next.delete(laneId);
  return next;
}

export function workLaneShellsFromSnapshot(
  lanes: ReadonlyArray<WorkLaneShell> | undefined,
): WorkLaneShellMap {
  const map = new Map<WorkLaneId, WorkLaneShell>();
  for (const lane of lanes ?? []) {
    map.set(lane.id, lane);
  }
  return map;
}

/**
 * Apply a lane detail stream item. Snapshot replaces local detail; events are
 * expected to be handled by reloading detail or by shell upserts for list views.
 */
export function applyLaneStreamItem(
  current: WorkLaneDetailSnapshot | null,
  item: OrchestrationLaneStreamItem,
): WorkLaneDetailSnapshot | null {
  switch (item.kind) {
    case "snapshot":
      return item.snapshot;
    case "synchronized":
      return current;
    case "event":
      // Detail bodies are reloaded after sequence catch-up; keep current until then.
      return current;
    default:
      return current;
  }
}

export type ScopedWorkLaneRef = {
  readonly environmentId: EnvironmentId;
  readonly laneId: WorkLaneId;
};
