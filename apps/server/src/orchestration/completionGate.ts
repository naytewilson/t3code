/**
 * F2 truthful completion gate — pure evaluation of whether a lane may complete.
 *
 * The decider calls this after structural preconditions (state, plan, source truth,
 * deliverable). Provider narrative cannot bypass these reasons.
 */
import type { AcceptanceCriterion, WorkLane } from "@t3tools/contracts";
import type {
  CheckStatus,
  LaneCheck,
  LaneCompletionEvidence,
} from "@t3tools/contracts/completionGate";

const BLOCKING_CHECK_STATUSES = new Set<CheckStatus>([
  "not-run",
  "running",
  "failed",
  "blocked",
  "stale",
  "superseded",
]);

export type CompletionGateDenial = {
  readonly ok: false;
  readonly reasons: ReadonlyArray<string>;
};

export type CompletionGateAcceptance = {
  readonly ok: true;
};

export type CompletionGateResult = CompletionGateAcceptance | CompletionGateDenial;

export type CompletionGateInput = {
  readonly lane: WorkLane;
  readonly acceptanceCriteria: ReadonlyArray<AcceptanceCriterion>;
  readonly checks: ReadonlyArray<LaneCheck>;
  readonly evidence: LaneCompletionEvidence | null;
};

function pushReason(reasons: Array<string>, reason: string): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function isCriterionSatisfied(criterion: AcceptanceCriterion): boolean {
  return criterion.status === "satisfied" || criterion.status === "waived";
}

/**
 * Evaluate completion evidence for a lane that is already structurally eligible
 * (deliverable-ready, plan, source-truth gate, deliverable requirement).
 */
export function evaluateCompletionGate(input: CompletionGateInput): CompletionGateResult {
  const reasons: Array<string> = [];
  const { lane, acceptanceCriteria, checks, evidence } = input;

  const laneCriteria = acceptanceCriteria.filter((criterion) => criterion.laneId === lane.id);
  const criteriaById = new Map(laneCriteria.map((criterion) => [criterion.id, criterion]));

  for (const criterionId of lane.acceptanceCriterionIds) {
    if (!criteriaById.has(criterionId)) {
      pushReason(
        reasons,
        `required acceptance criterion '${criterionId}' evidence is missing from the read model`,
      );
    }
  }

  for (const criterion of laneCriteria) {
    if (!criterion.required) {
      continue;
    }
    if (criterion.status === "pending" || criterion.status === "in-progress") {
      pushReason(
        reasons,
        `required acceptance criterion '${criterion.id}' is ${criterion.status}`,
      );
      continue;
    }
    if (criterion.status === "failed") {
      pushReason(reasons, `required acceptance criterion '${criterion.id}' is failed`);
      continue;
    }
    if (!isCriterionSatisfied(criterion)) {
      pushReason(
        reasons,
        `required acceptance criterion '${criterion.id}' is not satisfied (status: '${criterion.status}')`,
      );
    }
  }

  const laneChecks = checks.filter((check) => check.laneId === lane.id);
  for (const check of laneChecks) {
    if (!check.required) {
      continue;
    }
    if (check.status === "skipped-with-reason") {
      if (!check.skipPermitted) {
        pushReason(
          reasons,
          `required check '${check.id}' is skipped-with-reason without criterion permission`,
        );
      }
      continue;
    }
    if (check.status === "passed") {
      continue;
    }
    if (BLOCKING_CHECK_STATUSES.has(check.status)) {
      pushReason(reasons, `required check '${check.id}' is ${check.status}`);
    }
  }

  if (lane.blockerIds.length > 0) {
    pushReason(
      reasons,
      `lane has unresolved blocker(s): ${lane.blockerIds.join(", ")}`,
    );
  }

  const verifierDecision = evidence?.verifierDecision ?? "absent";
  if (verifierDecision === "absent") {
    pushReason(reasons, "verifier receipt is absent");
  } else if (verifierDecision === "pending") {
    pushReason(reasons, "verifier has not accepted completion");
  } else if (verifierDecision === "rejected") {
    pushReason(reasons, "verifier rejected completion");
  } else if (verifierDecision === "accepted" && evidence?.verifierReceiptId == null) {
    pushReason(reasons, "verifier acceptance requires a verifier receipt id");
  }

  if (lane.taskContract.requiresUserVisibleSurface) {
    const uiStatus = evidence?.uiAcceptanceStatus ?? "absent";
    if (uiStatus === "absent") {
      pushReason(reasons, "UI acceptance receipt is absent for a user-visible surface");
    } else if (uiStatus === "failed") {
      pushReason(reasons, "UI acceptance receipt failed");
    } else if (uiStatus !== "passed" && uiStatus !== "not-required") {
      pushReason(reasons, `UI acceptance status '${uiStatus}' does not permit completion`);
    }
  }

  if (lane.taskContract.completionReportRequired) {
    const report = evidence?.completionReport ?? null;
    if (report === null) {
      pushReason(reasons, "completion report evidence is missing");
    } else {
      const fields: Array<keyof typeof report> = [
        "proven",
        "missingEvidence",
        "possiblyWrongOrOverstated",
        "exactNextAction",
        "whatDoesNotCountAsCompletion",
        "safeContinuationContext",
      ];
      for (const field of fields) {
        if (report[field].trim().length === 0) {
          pushReason(reasons, `completion report field '${field}' is empty`);
        }
      }
    }
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }
  return { ok: true };
}

export function formatCompletionGateDenial(result: CompletionGateDenial): string {
  return result.reasons.join("; ");
}
