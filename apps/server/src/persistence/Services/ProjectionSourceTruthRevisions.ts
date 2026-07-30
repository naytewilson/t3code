/**
 * ProjectionSourceTruthRevisionRepository - Projection repository for source-truth revisions.
 *
 * @module ProjectionSourceTruthRevisions
 */
import {
  IsoDateTime,
  NonNegativeInt,
  SourceTruthRevision,
  SourceTruthRevisionId,
  WorkLaneId,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ProjectionSourceTruthRevision = Schema.Struct({
  id: SourceTruthRevisionId,
  laneId: WorkLaneId,
  revision: SourceTruthRevision,
  producedAt: IsoDateTime,
  supersededAt: Schema.NullOr(IsoDateTime),
  lastSequence: NonNegativeInt,
});
export type ProjectionSourceTruthRevision = typeof ProjectionSourceTruthRevision.Type;

export const GetProjectionSourceTruthRevisionInput = Schema.Struct({
  id: SourceTruthRevisionId,
});
export type GetProjectionSourceTruthRevisionInput =
  typeof GetProjectionSourceTruthRevisionInput.Type;

export const ListProjectionSourceTruthRevisionsByLaneInput = Schema.Struct({
  laneId: WorkLaneId,
});
export type ListProjectionSourceTruthRevisionsByLaneInput =
  typeof ListProjectionSourceTruthRevisionsByLaneInput.Type;

export interface ProjectionSourceTruthRevisionRepositoryShape {
  readonly upsert: (
    row: ProjectionSourceTruthRevision,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    input: GetProjectionSourceTruthRevisionInput,
  ) => Effect.Effect<Option.Option<ProjectionSourceTruthRevision>, ProjectionRepositoryError>;
  readonly listByLaneId: (
    input: ListProjectionSourceTruthRevisionsByLaneInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionSourceTruthRevision>, ProjectionRepositoryError>;
  readonly listAll: () => Effect.Effect<
    ReadonlyArray<ProjectionSourceTruthRevision>,
    ProjectionRepositoryError
  >;
}

export class ProjectionSourceTruthRevisionRepository extends Context.Service<
  ProjectionSourceTruthRevisionRepository,
  ProjectionSourceTruthRevisionRepositoryShape
>()(
  "t3/persistence/Services/ProjectionSourceTruthRevisions/ProjectionSourceTruthRevisionRepository",
) {}
