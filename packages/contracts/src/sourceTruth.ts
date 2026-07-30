import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  ArtifactRefId,
  AgentAssignmentId,
  EnvironmentId,
  IsoDateTime,
  SourceTruthRevisionId,
  ThreadId,
  TrimmedNonEmptyString,
  WorkLaneId,
} from "./baseSchemas.ts";
import { RepositoryIdentity } from "./environment.ts";

/**
 * Canonical claim labels for machine-generated conclusions.
 * No synonyms such as confirmed/likely/validated may replace these in persisted evidence.
 */
export const ClaimLabel = Schema.Literals(["PROVEN", "INFERRED", "SUSPECTED", "UNKNOWN"]);
export type ClaimLabel = typeof ClaimLabel.Type;

/**
 * Opaque F0 artifact pointer. Does not implement the F1 receipt/blob store —
 * only a forward-compatible reference for large command output.
 */
export const ArtifactReference = Schema.Struct({
  id: ArtifactRefId,
  kind: Schema.Literals(["path", "blob", "log"]),
  ref: TrimmedNonEmptyString,
  contentType: Schema.optional(TrimmedNonEmptyString),
  byteLength: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
});
export type ArtifactReference = typeof ArtifactReference.Type;

export const GitOperationState = Schema.Literals([
  "none",
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
  "bisect",
]);
export type GitOperationState = typeof GitOperationState.Type;

export const WorktreeOwnershipOverlapResult = Schema.Literals([
  "exclusive",
  "overlap",
  "unknown",
  "not-applicable",
]);
export type WorktreeOwnershipOverlapResult = typeof WorktreeOwnershipOverlapResult.Type;

export const SourceTruthDirtyStatus = Schema.Struct({
  fingerprint: Schema.NullOr(TrimmedNonEmptyString),
  summary: Schema.NullOr(TrimmedNonEmptyString),
  isDirty: Schema.Boolean,
});
export type SourceTruthDirtyStatus = typeof SourceTruthDirtyStatus.Type;

export const SourceTruthFileReference = Schema.Struct({
  path: TrimmedNonEmptyString,
  role: Schema.optional(
    Schema.Literals(["instruction", "manifest", "relevant", "test", "generated", "vendored"]),
  ),
});
export type SourceTruthFileReference = typeof SourceTruthFileReference.Type;

export const SourceTruthRevision = Schema.Struct({
  id: SourceTruthRevisionId,
  laneId: WorkLaneId,
  repositoryIdentity: Schema.NullOr(RepositoryIdentity),
  repositoryRoot: Schema.NullOr(TrimmedNonEmptyString),
  branch: Schema.NullOr(TrimmedNonEmptyString),
  detached: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  headSha: Schema.NullOr(TrimmedNonEmptyString),
  baseSha: Schema.NullOr(TrimmedNonEmptyString),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  dirty: SourceTruthDirtyStatus,
  instructionFiles: Schema.Array(SourceTruthFileReference).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  manifests: Schema.Array(SourceTruthFileReference).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  buildTestCandidates: Schema.Array(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  relevantFiles: Schema.Array(SourceTruthFileReference).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  relevantTests: Schema.Array(SourceTruthFileReference).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  activeGitOperation: GitOperationState.pipe(Schema.withDecodingDefault(Effect.succeed("none"))),
  ownershipOverlap: WorktreeOwnershipOverlapResult.pipe(
    Schema.withDecodingDefault(Effect.succeed("unknown")),
  ),
  canonicalExternalSourceRefs: Schema.Array(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  unknownsThatChangeAction: Schema.Array(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  safeNextAction: Schema.NullOr(TrimmedNonEmptyString),
  producedAt: IsoDateTime,
  producerAssignmentId: Schema.NullOr(AgentAssignmentId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  producerThreadId: Schema.NullOr(ThreadId).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  environmentId: Schema.optional(EnvironmentId),
  rawOutputArtifactRef: Schema.NullOr(ArtifactReference).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  supersededAt: Schema.NullOr(IsoDateTime).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  supersedesRevisionId: Schema.NullOr(SourceTruthRevisionId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
});
export type SourceTruthRevision = typeof SourceTruthRevision.Type;

/** Compact shell fields — never embed full revision payloads in shell records. */
export const SourceTruthRevisionShellSummary = Schema.Struct({
  revisionId: SourceTruthRevisionId,
  branch: Schema.NullOr(TrimmedNonEmptyString),
  headSha: Schema.NullOr(TrimmedNonEmptyString),
  worktreePath: Schema.NullOr(TrimmedNonEmptyString),
  isDirty: Schema.Boolean,
  activeGitOperation: GitOperationState,
  ownershipOverlap: WorktreeOwnershipOverlapResult,
  producedAt: IsoDateTime,
});
export type SourceTruthRevisionShellSummary = typeof SourceTruthRevisionShellSummary.Type;
