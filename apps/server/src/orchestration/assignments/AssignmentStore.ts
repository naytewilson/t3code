/**
 * Durable in-process assignment store for F3 director/worker topology.
 *
 * Persists assignment snapshots so a new DirectorRuntime can rehydrate after
 * reconnect without inventing fake transitions. Integrator may later replace
 * this with event-sourced projection rows.
 */
import type { AgentAssignmentId, WorkLaneId } from "@t3tools/contracts";
import {
  AgentAssignment as AgentAssignmentSchema,
  type AgentAssignment,
  type AgentTopologyProjection,
} from "@t3tools/contracts/agentAssignment";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

export class AssignmentStoreError extends Error {
  readonly _tag = "AssignmentStoreError";
  constructor(message: string) {
    super(message);
    this.name = "AssignmentStoreError";
  }
}

export interface AssignmentStoreShape {
  readonly upsert: (assignment: AgentAssignment) => Effect.Effect<AgentAssignment>;
  readonly get: (id: AgentAssignmentId) => Effect.Effect<Option.Option<AgentAssignment>>;
  readonly listByLane: (laneId: WorkLaneId) => Effect.Effect<ReadonlyArray<AgentAssignment>>;
  readonly listAll: () => Effect.Effect<ReadonlyArray<AgentAssignment>>;
  readonly replaceAll: (assignments: ReadonlyArray<AgentAssignment>) => Effect.Effect<void>;
  readonly snapshot: () => Effect.Effect<string>;
  readonly restore: (
    snapshot: string,
  ) => Effect.Effect<ReadonlyArray<AgentAssignment>, AssignmentStoreError>;
  readonly topologyForLane: (laneId: WorkLaneId) => Effect.Effect<AgentTopologyProjection>;
}

export class AssignmentStore extends Context.Service<AssignmentStore, AssignmentStoreShape>()(
  "t3/orchestration/assignments/AssignmentStore",
) {}

const SnapshotSchema = Schema.Struct({
  version: Schema.Literal(1),
  assignments: Schema.Array(AgentAssignmentSchema),
});

export const makeInMemoryAssignmentStore = Effect.fn("makeInMemoryAssignmentStore")(function* () {
  const state = yield* Ref.make(new Map<AgentAssignmentId, AgentAssignment>());

  const upsert: AssignmentStoreShape["upsert"] = (assignment) =>
    Ref.modify(state, (map) => {
      const next = new Map(map);
      next.set(assignment.id, assignment);
      return [assignment, next] as const;
    });

  const get: AssignmentStoreShape["get"] = (id) =>
    Ref.get(state).pipe(Effect.map((map) => Option.fromNullishOr(map.get(id))));

  const listAll: AssignmentStoreShape["listAll"] = () =>
    Ref.get(state).pipe(Effect.map((map) => Array.from(map.values())));

  const listByLane: AssignmentStoreShape["listByLane"] = (laneId) =>
    listAll().pipe(Effect.map((all) => all.filter((row) => row.laneId === laneId)));

  const replaceAll: AssignmentStoreShape["replaceAll"] = (assignments) =>
    Ref.set(state, new Map(assignments.map((row) => [row.id, row] as const)));

  const snapshot: AssignmentStoreShape["snapshot"] = () =>
    listAll().pipe(
      Effect.map((assignments) =>
        JSON.stringify({
          version: 1 as const,
          assignments,
        }),
      ),
    );

  const restore: AssignmentStoreShape["restore"] = (raw) =>
    Effect.try({
      try: () => JSON.parse(raw) as unknown,
      catch: (cause) =>
        new AssignmentStoreError(
          `AssignmentStore.restore JSON parse failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
    }).pipe(
      Effect.flatMap((parsed) =>
        Schema.decodeUnknownEffect(SnapshotSchema)(parsed).pipe(
          Effect.mapError(
            (cause) =>
              new AssignmentStoreError(`AssignmentStore.restore decode failed: ${String(cause)}`),
          ),
        ),
      ),
      Effect.tap((decoded) => replaceAll(decoded.assignments)),
      Effect.map((decoded) => decoded.assignments),
    );

  const topologyForLane: AssignmentStoreShape["topologyForLane"] = (laneId) =>
    listByLane(laneId).pipe(
      Effect.map((assignments) => {
        const director = assignments.find((row) => row.role === "director") ?? null;
        return {
          laneId,
          directorAssignmentId: director?.id ?? null,
          nodes: assignments.map((row) => ({
            assignmentId: row.id,
            role: row.role,
            status: row.status,
            parentAssignmentId: row.parentAssignmentId,
            threadId: row.threadId,
            worktreePath: row.worktreePath,
            taskSummary: row.taskSummary,
            lastResultSummary: row.lastResultSummary,
          })),
        } satisfies AgentTopologyProjection;
      }),
    );

  return {
    upsert,
    get,
    listByLane,
    listAll,
    replaceAll,
    snapshot,
    restore,
    topologyForLane,
  } satisfies AssignmentStoreShape;
});
