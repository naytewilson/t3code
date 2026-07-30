import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { AcceptanceCriterion } from "@t3tools/contracts";
import { toPersistenceSqlError } from "../Errors.ts";
import {
  GetProjectionLaneAcceptanceCriterionInput,
  ListProjectionLaneAcceptanceCriteriaByLaneInput,
  ProjectionLaneAcceptanceCriterion,
  ProjectionLaneAcceptanceCriterionRepository,
  type ProjectionLaneAcceptanceCriterionRepositoryShape,
} from "../Services/ProjectionLaneAcceptanceCriteria.ts";

const ProjectionLaneAcceptanceCriterionDbRow = ProjectionLaneAcceptanceCriterion.mapFields(
  Struct.assign({
    criterion: Schema.fromJsonString(AcceptanceCriterion),
  }),
);
type ProjectionLaneAcceptanceCriterionDbRow = typeof ProjectionLaneAcceptanceCriterionDbRow.Type;

const makeProjectionLaneAcceptanceCriterionRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertProjectionLaneAcceptanceCriterionRow = SqlSchema.void({
    Request: ProjectionLaneAcceptanceCriterion,
    execute: (row) =>
      sql`
        INSERT INTO projection_lane_acceptance_criteria (
          id,
          lane_id,
          criterion_json,
          last_sequence
        )
        VALUES (
          ${row.id},
          ${row.laneId},
          ${JSON.stringify(row.criterion)},
          ${row.lastSequence}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          lane_id = excluded.lane_id,
          criterion_json = excluded.criterion_json,
          last_sequence = excluded.last_sequence
      `,
  });

  const getProjectionLaneAcceptanceCriterionRow = SqlSchema.findOneOption({
    Request: GetProjectionLaneAcceptanceCriterionInput,
    Result: ProjectionLaneAcceptanceCriterionDbRow,
    execute: ({ id }) =>
      sql`
        SELECT
          id,
          lane_id AS "laneId",
          criterion_json AS "criterion",
          last_sequence AS "lastSequence"
        FROM projection_lane_acceptance_criteria
        WHERE id = ${id}
      `,
  });

  const listProjectionLaneAcceptanceCriterionRowsByLane = SqlSchema.findAll({
    Request: ListProjectionLaneAcceptanceCriteriaByLaneInput,
    Result: ProjectionLaneAcceptanceCriterionDbRow,
    execute: ({ laneId }) =>
      sql`
        SELECT
          id,
          lane_id AS "laneId",
          criterion_json AS "criterion",
          last_sequence AS "lastSequence"
        FROM projection_lane_acceptance_criteria
        WHERE lane_id = ${laneId}
        ORDER BY id ASC
      `,
  });

  const listProjectionLaneAcceptanceCriterionRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionLaneAcceptanceCriterionDbRow,
    execute: () =>
      sql`
        SELECT
          id,
          lane_id AS "laneId",
          criterion_json AS "criterion",
          last_sequence AS "lastSequence"
        FROM projection_lane_acceptance_criteria
        ORDER BY lane_id ASC, id ASC
      `,
  });

  const upsert: ProjectionLaneAcceptanceCriterionRepositoryShape["upsert"] = (row) =>
    upsertProjectionLaneAcceptanceCriterionRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionLaneAcceptanceCriterionRepository.upsert:query"),
      ),
    );

  const getById: ProjectionLaneAcceptanceCriterionRepositoryShape["getById"] = (input) =>
    getProjectionLaneAcceptanceCriterionRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionLaneAcceptanceCriterionRepository.getById:query"),
      ),
    );

  const listByLaneId: ProjectionLaneAcceptanceCriterionRepositoryShape["listByLaneId"] = (
    input,
  ) =>
    listProjectionLaneAcceptanceCriterionRowsByLane(input).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionLaneAcceptanceCriterionRepository.listByLaneId:query"),
      ),
    );

  const listAll: ProjectionLaneAcceptanceCriterionRepositoryShape["listAll"] = () =>
    listProjectionLaneAcceptanceCriterionRows(undefined).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionLaneAcceptanceCriterionRepository.listAll:query"),
      ),
    );

  return {
    upsert,
    getById,
    listByLaneId,
    listAll,
  } satisfies ProjectionLaneAcceptanceCriterionRepositoryShape;
});

export const ProjectionLaneAcceptanceCriterionRepositoryLive = Layer.effect(
  ProjectionLaneAcceptanceCriterionRepository,
  makeProjectionLaneAcceptanceCriterionRepository,
);
