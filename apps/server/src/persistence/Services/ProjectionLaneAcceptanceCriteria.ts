/**
 * ProjectionLaneAcceptanceCriterionRepository - Projection repository for lane acceptance criteria.
 *
 * @module ProjectionLaneAcceptanceCriteria
 */
import {
  AcceptanceCriterion,
  AcceptanceCriterionId,
  NonNegativeInt,
  WorkLaneId,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ProjectionLaneAcceptanceCriterion = Schema.Struct({
  id: AcceptanceCriterionId,
  laneId: WorkLaneId,
  criterion: AcceptanceCriterion,
  lastSequence: NonNegativeInt,
});
export type ProjectionLaneAcceptanceCriterion = typeof ProjectionLaneAcceptanceCriterion.Type;

export const GetProjectionLaneAcceptanceCriterionInput = Schema.Struct({
  id: AcceptanceCriterionId,
});
export type GetProjectionLaneAcceptanceCriterionInput =
  typeof GetProjectionLaneAcceptanceCriterionInput.Type;

export const ListProjectionLaneAcceptanceCriteriaByLaneInput = Schema.Struct({
  laneId: WorkLaneId,
});
export type ListProjectionLaneAcceptanceCriteriaByLaneInput =
  typeof ListProjectionLaneAcceptanceCriteriaByLaneInput.Type;

export interface ProjectionLaneAcceptanceCriterionRepositoryShape {
  readonly upsert: (
    row: ProjectionLaneAcceptanceCriterion,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    input: GetProjectionLaneAcceptanceCriterionInput,
  ) => Effect.Effect<
    Option.Option<ProjectionLaneAcceptanceCriterion>,
    ProjectionRepositoryError
  >;
  readonly listByLaneId: (
    input: ListProjectionLaneAcceptanceCriteriaByLaneInput,
  ) => Effect.Effect<
    ReadonlyArray<ProjectionLaneAcceptanceCriterion>,
    ProjectionRepositoryError
  >;
  readonly listAll: () => Effect.Effect<
    ReadonlyArray<ProjectionLaneAcceptanceCriterion>,
    ProjectionRepositoryError
  >;
}

export class ProjectionLaneAcceptanceCriterionRepository extends Context.Service<
  ProjectionLaneAcceptanceCriterionRepository,
  ProjectionLaneAcceptanceCriterionRepositoryShape
>()(
  "t3/persistence/Services/ProjectionLaneAcceptanceCriteria/ProjectionLaneAcceptanceCriterionRepository",
) {}
