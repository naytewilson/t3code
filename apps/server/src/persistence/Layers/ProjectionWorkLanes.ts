import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { WorkLane } from "@t3tools/contracts";
import { toPersistenceSqlError } from "../Errors.ts";
import {
  GetProjectionWorkLaneInput,
  ProjectionWorkLane,
  ProjectionWorkLaneRepository,
  type ProjectionWorkLaneRepositoryShape,
} from "../Services/ProjectionWorkLanes.ts";

const ProjectionWorkLaneDbRow = ProjectionWorkLane.mapFields(
  Struct.assign({
    lane: Schema.fromJsonString(WorkLane),
  }),
);
type ProjectionWorkLaneDbRow = typeof ProjectionWorkLaneDbRow.Type;

const makeProjectionWorkLaneRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertProjectionWorkLaneRow = SqlSchema.void({
    Request: ProjectionWorkLane,
    execute: (row) =>
      sql`
        INSERT INTO projection_work_lanes (
          id,
          project_id,
          title,
          state,
          priority,
          classification,
          environment_id,
          branch,
          worktree_path,
          source_truth_revision_id,
          primary_thread_id,
          imported_thread_id,
          objective_summary,
          lane_json,
          created_at,
          updated_at,
          completed_at,
          last_sequence
        )
        VALUES (
          ${row.id},
          ${row.projectId},
          ${row.title},
          ${row.state},
          ${row.priority},
          ${row.classification},
          ${row.environmentId},
          ${row.branch},
          ${row.worktreePath},
          ${row.sourceTruthRevisionId},
          ${row.primaryThreadId},
          ${row.importedThreadId},
          ${row.objectiveSummary},
          ${JSON.stringify(row.lane)},
          ${row.createdAt},
          ${row.updatedAt},
          ${row.completedAt},
          ${row.lastSequence}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          project_id = excluded.project_id,
          title = excluded.title,
          state = excluded.state,
          priority = excluded.priority,
          classification = excluded.classification,
          environment_id = excluded.environment_id,
          branch = excluded.branch,
          worktree_path = excluded.worktree_path,
          source_truth_revision_id = excluded.source_truth_revision_id,
          primary_thread_id = excluded.primary_thread_id,
          imported_thread_id = excluded.imported_thread_id,
          objective_summary = excluded.objective_summary,
          lane_json = excluded.lane_json,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at,
          last_sequence = excluded.last_sequence
        WHERE excluded.last_sequence >= projection_work_lanes.last_sequence
      `,
  });

  const getProjectionWorkLaneRow = SqlSchema.findOneOption({
    Request: GetProjectionWorkLaneInput,
    Result: ProjectionWorkLaneDbRow,
    execute: ({ id }) =>
      sql`
        SELECT
          id,
          project_id AS "projectId",
          title,
          state,
          priority,
          classification,
          environment_id AS "environmentId",
          branch,
          worktree_path AS "worktreePath",
          source_truth_revision_id AS "sourceTruthRevisionId",
          primary_thread_id AS "primaryThreadId",
          imported_thread_id AS "importedThreadId",
          objective_summary AS "objectiveSummary",
          lane_json AS "lane",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          completed_at AS "completedAt",
          last_sequence AS "lastSequence"
        FROM projection_work_lanes
        WHERE id = ${id}
      `,
  });

  const listProjectionWorkLaneRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionWorkLaneDbRow,
    execute: () =>
      sql`
        SELECT
          id,
          project_id AS "projectId",
          title,
          state,
          priority,
          classification,
          environment_id AS "environmentId",
          branch,
          worktree_path AS "worktreePath",
          source_truth_revision_id AS "sourceTruthRevisionId",
          primary_thread_id AS "primaryThreadId",
          imported_thread_id AS "importedThreadId",
          objective_summary AS "objectiveSummary",
          lane_json AS "lane",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          completed_at AS "completedAt",
          last_sequence AS "lastSequence"
        FROM projection_work_lanes
        ORDER BY created_at ASC, id ASC
      `,
  });

  const upsert: ProjectionWorkLaneRepositoryShape["upsert"] = (row) =>
    upsertProjectionWorkLaneRow(row).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionWorkLaneRepository.upsert:query")),
    );

  const getById: ProjectionWorkLaneRepositoryShape["getById"] = (input) =>
    getProjectionWorkLaneRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionWorkLaneRepository.getById:query")),
    );

  const listAll: ProjectionWorkLaneRepositoryShape["listAll"] = () =>
    listProjectionWorkLaneRows(undefined).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionWorkLaneRepository.listAll:query")),
    );

  return {
    upsert,
    getById,
    listAll,
  } satisfies ProjectionWorkLaneRepositoryShape;
});

export const ProjectionWorkLaneRepositoryLive = Layer.effect(
  ProjectionWorkLaneRepository,
  makeProjectionWorkLaneRepository,
);
