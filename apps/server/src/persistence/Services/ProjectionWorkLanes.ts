/**
 * ProjectionWorkLaneRepository - Projection repository for work lanes.
 *
 * @module ProjectionWorkLanes
 */
import {
  EnvironmentId,
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  SourceTruthRevisionId,
  ThreadId,
  TrimmedNonEmptyString,
  WorkLane,
  WorkLaneClassification,
  WorkLaneId,
  WorkLaneState,
  WorkPriority,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ProjectionWorkLane = Schema.Struct({
  id: WorkLaneId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  state: WorkLaneState,
  priority: WorkPriority,
  classification: WorkLaneClassification,
  environmentId: EnvironmentId,
  branch: Schema.NullOr(TrimmedNonEmptyString),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  sourceTruthRevisionId: Schema.NullOr(SourceTruthRevisionId),
  primaryThreadId: Schema.NullOr(ThreadId),
  importedThreadId: Schema.NullOr(ThreadId),
  objectiveSummary: TrimmedNonEmptyString,
  lane: WorkLane,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  completedAt: Schema.NullOr(IsoDateTime),
  lastSequence: NonNegativeInt,
});
export type ProjectionWorkLane = typeof ProjectionWorkLane.Type;

export const GetProjectionWorkLaneInput = Schema.Struct({
  id: WorkLaneId,
});
export type GetProjectionWorkLaneInput = typeof GetProjectionWorkLaneInput.Type;

export interface ProjectionWorkLaneRepositoryShape {
  readonly upsert: (row: ProjectionWorkLane) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    input: GetProjectionWorkLaneInput,
  ) => Effect.Effect<Option.Option<ProjectionWorkLane>, ProjectionRepositoryError>;
  readonly listAll: () => Effect.Effect<ReadonlyArray<ProjectionWorkLane>, ProjectionRepositoryError>;
}

export class ProjectionWorkLaneRepository extends Context.Service<
  ProjectionWorkLaneRepository,
  ProjectionWorkLaneRepositoryShape
>()("t3/persistence/Services/ProjectionWorkLanes/ProjectionWorkLaneRepository") {}
