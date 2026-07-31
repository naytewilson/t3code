import type {
  EnvironmentId,
  OrchestrationEvent,
  OrchestrationLaneStreamItem,
  WorkLaneDetailSnapshot,
  WorkLaneId,
  WorkLaneShell,
} from "@t3tools/contracts";
import { BlockerId, ORCHESTRATION_WS_METHODS } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Atom } from "effect/unstable/reactivity";

import { EnvironmentRegistry } from "../connection/registry.ts";
import { subscribeDynamic } from "../rpc/client.ts";
import { followStreamInEnvironment } from "./runtime.ts";

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
 * Apply a lane detail stream item. Snapshot replaces local detail; events advance
 * snapshotSequence so reconnect cursors do not ignore progress while bodies are
 * reloaded separately.
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
      if (current === null) {
        return applyLaneDetailEvent(null, item.event);
      }
      if (item.event.sequence <= current.snapshotSequence) {
        return current;
      }
      if (item.event.aggregateKind !== "lane") {
        return { ...current, snapshotSequence: item.event.sequence };
      }
      return applyLaneDetailEvent(current, item.event);
    default:
      return current;
  }
}

/** Apply lane-domain events locally so an active lane stream does not require a refetch per event. */
export function applyLaneDetailEvent(
  current: WorkLaneDetailSnapshot | null,
  event: OrchestrationEvent,
): WorkLaneDetailSnapshot | null {
  if (event.aggregateKind !== "lane") {
    return current;
  }

  if (event.type === "lane.created" || event.type === "lane.imported") {
    return {
      snapshotSequence: event.sequence,
      detail: {
        lane: event.payload.lane,
        acceptanceCriteria: event.payload.acceptanceCriteria,
        sourceTruthRevisions: [],
      },
    };
  }
  if (current === null) {
    return null;
  }

  const lane = current.detail.lane;
  switch (event.type) {
    case "lane.state-changed": {
      const blockerIds =
        event.payload.blockerId === undefined || lane.blockerIds.includes(event.payload.blockerId)
          ? lane.blockerIds
          : [...lane.blockerIds, event.payload.blockerId];
      return {
        snapshotSequence: event.sequence,
        detail: {
          ...current.detail,
          lane: {
            ...lane,
            state: event.payload.toState,
            resumeState: event.payload.resumeState,
            blockerIds,
            ...(event.payload.supersedingLaneId !== undefined
              ? { supersedingLaneId: event.payload.supersedingLaneId }
              : {}),
            completedAt:
              event.payload.toState === "completed"
                ? event.payload.updatedAt
                : event.payload.fromState === "completed"
                  ? null
                  : lane.completedAt,
            updatedAt: event.payload.updatedAt,
          },
        },
      };
    }
    case "lane.task-contract-updated":
      return {
        snapshotSequence: event.sequence,
        detail: {
          ...current.detail,
          lane: { ...lane, taskContract: event.payload.taskContract, updatedAt: event.payload.updatedAt },
        },
      };
    case "lane.meta-updated":
      return {
        snapshotSequence: event.sequence,
        detail: {
          ...current.detail,
          lane: {
            ...lane,
            ...(event.payload.title !== undefined ? { title: event.payload.title } : {}),
            ...(event.payload.priority !== undefined ? { priority: event.payload.priority } : {}),
            ...(event.payload.classification !== undefined
              ? { classification: event.payload.classification }
              : {}),
            ...(event.payload.branch !== undefined ? { branch: event.payload.branch } : {}),
            ...(event.payload.worktreePath !== undefined
              ? { worktreePath: event.payload.worktreePath }
              : {}),
            ...(event.payload.baseRef !== undefined ? { baseRef: event.payload.baseRef } : {}),
            ...(event.payload.repositoryIdentity !== undefined
              ? { repositoryIdentity: event.payload.repositoryIdentity }
              : {}),
            updatedAt: event.payload.updatedAt,
          },
        },
      };
    case "lane.plan-proposed":
      return {
        snapshotSequence: event.sequence,
        detail: { ...current.detail, lane: { ...lane, updatedAt: event.payload.proposedAt } },
      };
    case "lane.plan-activated":
      return {
        snapshotSequence: event.sequence,
        detail: {
          ...current.detail,
          lane: {
            ...lane,
            activePlanRevisionId: event.payload.planRevisionId,
            updatedAt: event.payload.updatedAt,
          },
        },
      };
    case "lane.deliverable-registered":
      return {
        snapshotSequence: event.sequence,
        detail: {
          ...current.detail,
          lane: {
            ...lane,
            deliverableIds: lane.deliverableIds.includes(event.payload.deliverableId)
              ? lane.deliverableIds
              : [...lane.deliverableIds, event.payload.deliverableId],
            updatedAt: event.payload.updatedAt,
          },
        },
      };
    case "source-truth.preflight-recorded": {
      const revisions = current.detail.sourceTruthRevisions
        .map((revision) =>
          revision.id === event.payload.previousRevisionId
            ? { ...revision, supersededAt: event.payload.recordedAt }
            : revision,
        )
        .filter((revision) => revision.id !== event.payload.revision.id);
      return {
        snapshotSequence: event.sequence,
        detail: {
          ...current.detail,
          lane: {
            ...lane,
            sourceTruthRevisionId: event.payload.revision.id,
            sourceTruthActiveGitOperation: event.payload.revision.activeGitOperation,
            sourceTruthOwnershipOverlap:
              event.payload.revision.unknownsThatChangeAction.length > 0
                ? "unknown"
                : event.payload.revision.ownershipOverlap,
            updatedAt: event.payload.recordedAt,
          },
          sourceTruthRevisions: [...revisions, event.payload.revision],
        },
      };
    }
    case "source-truth.conflict-recorded": {
      const blockerId =
        event.payload.blockerId ?? BlockerId.make(`source-truth:${event.commandId}`);
      const blockerIds = lane.blockerIds.includes(blockerId)
        ? lane.blockerIds
        : [...lane.blockerIds, blockerId];
      const sourceTruthRevisions = current.detail.sourceTruthRevisions.map((revision) =>
        revision.id === lane.sourceTruthRevisionId
          ? { ...revision, supersededAt: event.payload.recordedAt }
          : revision,
      );
      return {
        snapshotSequence: event.sequence,
        detail: {
          ...current.detail,
          lane: {
            ...lane,
            sourceTruthRevisionId: null,
            sourceTruthActiveGitOperation: "none",
            sourceTruthOwnershipOverlap: "unknown",
            blockerIds,
            updatedAt: event.payload.recordedAt,
          },
          sourceTruthRevisions,
        },
      };
    }
    case "source-truth.refresh-requested": {
      const sourceTruthRevisions = current.detail.sourceTruthRevisions.map((revision) =>
        revision.id === lane.sourceTruthRevisionId
          ? { ...revision, supersededAt: event.payload.requestedAt }
          : revision,
      );
      return {
        snapshotSequence: event.sequence,
        detail: {
          ...current.detail,
          lane: {
            ...lane,
            sourceTruthRevisionId: null,
            sourceTruthActiveGitOperation: "none",
            sourceTruthOwnershipOverlap: "unknown",
            updatedAt: event.payload.requestedAt,
          },
          sourceTruthRevisions,
        },
      };
    }
    default:
      return { ...current, snapshotSequence: event.sequence };
  }
}

export type EnvironmentWorkLaneState = {
  readonly data: WorkLaneDetailSnapshot | null;
  readonly status: "empty" | "live";
};

export const EMPTY_ENVIRONMENT_WORK_LANE_STATE: EnvironmentWorkLaneState = {
  data: null,
  status: "empty",
};

function reduceEnvironmentWorkLaneState(
  current: EnvironmentWorkLaneState,
  item: OrchestrationLaneStreamItem,
): EnvironmentWorkLaneState {
  if (item.kind === "snapshot") {
    return { data: item.snapshot, status: "live" };
  }
  if (item.kind === "synchronized") {
    return current.data === null ? current : { ...current, status: "live" };
  }
  const data = applyLaneStreamItem(current.data, item);
  return { data, status: data === null ? "empty" : "live" };
}

export function createEnvironmentWorkLaneStateAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  const family = Atom.family((key: string) => {
    const separator = key.indexOf("\u0000");
    const environmentId = key.slice(0, separator) as EnvironmentId;
    const laneId = key.slice(separator + 1) as WorkLaneId;
    const stream = subscribeDynamic(
      ORCHESTRATION_WS_METHODS.subscribeLane,
      () => Effect.succeed({ laneId }),
    ).pipe(
      Stream.mapAccum(
        () => EMPTY_ENVIRONMENT_WORK_LANE_STATE,
        (current, item) => {
          const next = reduceEnvironmentWorkLaneState(current, item);
          return [next, [next]] as const;
        },
      ),
    );
    return runtime
      .atom(followStreamInEnvironment(environmentId, stream), {
        initialValue: EMPTY_ENVIRONMENT_WORK_LANE_STATE,
      })
      .pipe(
        Atom.setIdleTTL(5 * 60_000),
        Atom.withLabel(`environment-work-lane-state:${environmentId}:${laneId}`),
      );
  });

  return {
    stateAtom: (environmentId: EnvironmentId, laneId: WorkLaneId) =>
      family(`${environmentId}\u0000${laneId}`),
  };
}

export * from "./workLaneCommands.ts";

export type ScopedWorkLaneRef = {
  readonly environmentId: EnvironmentId;
  readonly laneId: WorkLaneId;
};
