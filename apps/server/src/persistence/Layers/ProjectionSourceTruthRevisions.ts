import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { SourceTruthRevision } from "@t3tools/contracts";
import { toPersistenceSqlError } from "../Errors.ts";
import {
  GetProjectionSourceTruthRevisionInput,
  ListProjectionSourceTruthRevisionsByLaneInput,
  ProjectionSourceTruthRevision,
  ProjectionSourceTruthRevisionRepository,
  type ProjectionSourceTruthRevisionRepositoryShape,
} from "../Services/ProjectionSourceTruthRevisions.ts";

const ProjectionSourceTruthRevisionDbRow = ProjectionSourceTruthRevision.mapFields(
  Struct.assign({
    revision: Schema.fromJsonString(SourceTruthRevision),
  }),
);
type ProjectionSourceTruthRevisionDbRow = typeof ProjectionSourceTruthRevisionDbRow.Type;

const makeProjectionSourceTruthRevisionRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertProjectionSourceTruthRevisionRow = SqlSchema.void({
    Request: ProjectionSourceTruthRevision,
    execute: (row) =>
      sql`
        INSERT INTO projection_source_truth_revisions (
          id,
          lane_id,
          revision_json,
          produced_at,
          superseded_at,
          last_sequence
        )
        VALUES (
          ${row.id},
          ${row.laneId},
          ${JSON.stringify(row.revision)},
          ${row.producedAt},
          ${row.supersededAt},
          ${row.lastSequence}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          lane_id = excluded.lane_id,
          revision_json = excluded.revision_json,
          produced_at = excluded.produced_at,
          superseded_at = excluded.superseded_at,
          last_sequence = excluded.last_sequence
      `,
  });

  const getProjectionSourceTruthRevisionRow = SqlSchema.findOneOption({
    Request: GetProjectionSourceTruthRevisionInput,
    Result: ProjectionSourceTruthRevisionDbRow,
    execute: ({ id }) =>
      sql`
        SELECT
          id,
          lane_id AS "laneId",
          revision_json AS "revision",
          produced_at AS "producedAt",
          superseded_at AS "supersededAt",
          last_sequence AS "lastSequence"
        FROM projection_source_truth_revisions
        WHERE id = ${id}
      `,
  });

  const listProjectionSourceTruthRevisionRowsByLane = SqlSchema.findAll({
    Request: ListProjectionSourceTruthRevisionsByLaneInput,
    Result: ProjectionSourceTruthRevisionDbRow,
    execute: ({ laneId }) =>
      sql`
        SELECT
          id,
          lane_id AS "laneId",
          revision_json AS "revision",
          produced_at AS "producedAt",
          superseded_at AS "supersededAt",
          last_sequence AS "lastSequence"
        FROM projection_source_truth_revisions
        WHERE lane_id = ${laneId}
        ORDER BY produced_at ASC, id ASC
      `,
  });

  const listProjectionSourceTruthRevisionRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionSourceTruthRevisionDbRow,
    execute: () =>
      sql`
        SELECT
          id,
          lane_id AS "laneId",
          revision_json AS "revision",
          produced_at AS "producedAt",
          superseded_at AS "supersededAt",
          last_sequence AS "lastSequence"
        FROM projection_source_truth_revisions
        ORDER BY produced_at ASC, id ASC
      `,
  });

  const upsert: ProjectionSourceTruthRevisionRepositoryShape["upsert"] = (row) =>
    upsertProjectionSourceTruthRevisionRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionSourceTruthRevisionRepository.upsert:query"),
      ),
    );

  const getById: ProjectionSourceTruthRevisionRepositoryShape["getById"] = (input) =>
    getProjectionSourceTruthRevisionRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionSourceTruthRevisionRepository.getById:query"),
      ),
    );

  const listByLaneId: ProjectionSourceTruthRevisionRepositoryShape["listByLaneId"] = (input) =>
    listProjectionSourceTruthRevisionRowsByLane(input).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionSourceTruthRevisionRepository.listByLaneId:query"),
      ),
    );

  const listAll: ProjectionSourceTruthRevisionRepositoryShape["listAll"] = () =>
    listProjectionSourceTruthRevisionRows(undefined).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionSourceTruthRevisionRepository.listAll:query"),
      ),
    );

  return {
    upsert,
    getById,
    listByLaneId,
    listAll,
  } satisfies ProjectionSourceTruthRevisionRepositoryShape;
});

export const ProjectionSourceTruthRevisionRepositoryLive = Layer.effect(
  ProjectionSourceTruthRevisionRepository,
  makeProjectionSourceTruthRevisionRepository,
);
