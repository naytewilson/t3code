/**
 * F2 completion-gate contracts — checks, verifier decision, and closeout evidence.
 *
 * Exported via package subpath `@t3tools/contracts/completionGate` (not the root barrel)
 * until the Integrator promotes a root export.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  AcceptanceCriterionId,
  IsoDateTime,
  ReceiptId,
  TrimmedNonEmptyString,
  WorkLaneId,
} from "./baseSchemas.ts";

/** Branded check identity — local to the completion-gate surface (F2). */
export const CheckId = TrimmedNonEmptyString.pipe(Schema.brand("CheckId"));
export type CheckId = typeof CheckId.Type;

/** Canonical check status vocabulary (H01 / PRODUCT_SPEC). */
export const CheckStatus = Schema.Literals([
  "not-run",
  "running",
  "passed",
  "failed",
  "skipped-with-reason",
  "blocked",
  "stale",
  "superseded",
]);
export type CheckStatus = typeof CheckStatus.Type;

export const LaneCheck = Schema.Struct({
  id: CheckId,
  laneId: WorkLaneId,
  criterionId: Schema.NullOr(AcceptanceCriterionId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  title: TrimmedNonEmptyString,
  required: Schema.Boolean,
  status: CheckStatus.pipe(Schema.withDecodingDefault(Effect.succeed("not-run" as const))),
  /** When true, a required check may remain `skipped-with-reason` without blocking completion. */
  skipPermitted: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  fingerprint: Schema.NullOr(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  supportingReceiptIds: Schema.Array(ReceiptId).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  updatedAt: IsoDateTime,
});
export type LaneCheck = typeof LaneCheck.Type;

export const VerifierDecision = Schema.Literals([
  "accepted",
  "rejected",
  "pending",
  "absent",
]);
export type VerifierDecision = typeof VerifierDecision.Type;

export const UiAcceptanceStatus = Schema.Literals([
  "passed",
  "failed",
  "not-required",
  "absent",
]);
export type UiAcceptanceStatus = typeof UiAcceptanceStatus.Type;

/** Six mandated closeout fields (H06 / MACBRAINS completion report). */
export const CompletionReportEvidence = Schema.Struct({
  proven: TrimmedNonEmptyString,
  missingEvidence: TrimmedNonEmptyString,
  possiblyWrongOrOverstated: TrimmedNonEmptyString,
  exactNextAction: TrimmedNonEmptyString,
  whatDoesNotCountAsCompletion: TrimmedNonEmptyString,
  safeContinuationContext: TrimmedNonEmptyString,
});
export type CompletionReportEvidence = typeof CompletionReportEvidence.Type;

/**
 * Per-lane evidence bundle consulted by the completion gate.
 * Criteria and checks are stored alongside so the command read model can
 * evaluate without loading full lane detail projections.
 */
export const LaneCompletionEvidence = Schema.Struct({
  laneId: WorkLaneId,
  verifierDecision: VerifierDecision.pipe(
    Schema.withDecodingDefault(Effect.succeed("absent" as const)),
  ),
  verifierReceiptId: Schema.NullOr(ReceiptId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  uiAcceptanceStatus: UiAcceptanceStatus.pipe(
    Schema.withDecodingDefault(Effect.succeed("absent" as const)),
  ),
  uiAcceptanceReceiptId: Schema.NullOr(ReceiptId).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  completionReport: Schema.NullOr(CompletionReportEvidence).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  updatedAt: IsoDateTime,
});
export type LaneCompletionEvidence = typeof LaneCompletionEvidence.Type;
