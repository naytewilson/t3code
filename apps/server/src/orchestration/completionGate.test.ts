import {
  AcceptanceCriterionId,
  BlockerId,
  DeliverableId,
  EnvironmentId,
  PlanRevisionId,
  ProjectId,
  ReceiptId,
  SourceTruthRevisionId,
  WorkLaneId,
  type AcceptanceCriterion,
  type WorkLane,
} from "@t3tools/contracts";
import {
  CheckId,
  type LaneCheck,
  type LaneCompletionEvidence,
} from "@t3tools/contracts/completionGate";
import { describe, expect, it } from "@effect/vitest";

import { evaluateCompletionGate } from "./completionGate.ts";

const NOW = "2026-07-31T00:00:00.000Z";
const LANE_ID = WorkLaneId.make("lane-f2-demo");
const CRITERION_ID = AcceptanceCriterionId.make("crit-pending-demo");

function makeLane(overrides: Partial<WorkLane> = {}): WorkLane {
  return {
    id: LANE_ID,
    projectId: ProjectId.make("project-f2"),
    title: "F2 demo lane",
    taskContract: {
      objective: "Prove reject-then-accept completion",
      constraints: [],
      nonGoals: [],
      deliverableRequirement: "required",
      requiresPullRequest: false,
      requiresUserVisibleSurface: true,
      authorizedActions: ["edit", "test"],
      prohibitedActions: ["force-push"],
      completionReportRequired: true,
      objectiveDerivation: "PROVEN",
    },
    state: "deliverable-ready",
    priority: "normal",
    classification: "substantial",
    environmentId: EnvironmentId.make("env-f2"),
    repositoryIdentity: null,
    baseRef: null,
    branch: "macbrains/f2-completion-gate",
    worktreePath: "/tmp/worktrees/f2",
    ownerAssignmentId: null,
    advisorAssignmentIds: [],
    verifierAssignmentIds: [],
    sourceTruthRevisionId: SourceTruthRevisionId.make("str-f2"),
    sourceTruthActiveGitOperation: "none",
    sourceTruthOwnershipOverlap: "exclusive",
    activePlanRevisionId: PlanRevisionId.make("plan-f2"),
    acceptanceCriterionIds: [CRITERION_ID],
    requiredReceiptKinds: [],
    deliverableIds: [DeliverableId.make("deliverable-f2")],
    blockerIds: [],
    primaryThreadId: null,
    importedThreadId: null,
    threadIds: [],
    legacyExecutorRef: null,
    resumeState: null,
    supersedingLaneId: null,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    ...overrides,
  };
}

function makeCriterion(overrides: Partial<AcceptanceCriterion> = {}): AcceptanceCriterion {
  return {
    id: CRITERION_ID,
    laneId: LANE_ID,
    description: "Required demo criterion",
    category: "correctness",
    required: true,
    status: "pending",
    supportingReceiptIds: [],
    ...overrides,
  };
}

function makeCheck(overrides: Partial<LaneCheck> = {}): LaneCheck {
  return {
    id: CheckId.make("check-f2-1"),
    laneId: LANE_ID,
    criterionId: CRITERION_ID,
    title: "focused completionGate tests",
    required: true,
    status: "not-run",
    skipPermitted: false,
    fingerprint: null,
    supportingReceiptIds: [],
    updatedAt: NOW,
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<LaneCompletionEvidence> = {}): LaneCompletionEvidence {
  return {
    laneId: LANE_ID,
    verifierDecision: "absent",
    verifierReceiptId: null,
    uiAcceptanceStatus: "absent",
    uiAcceptanceReceiptId: null,
    completionReport: null,
    updatedAt: NOW,
    ...overrides,
  };
}

const passingReport = {
  proven: "Gate rejects pending criteria and accepts only after evidence.",
  missingEvidence: "None for this unit demo.",
  possiblyWrongOrOverstated: "ProjectionSnapshotQuery still returns empty evidence arrays.",
  exactNextAction: "Integrator wires criteria/checks/evidence into command read model.",
  whatDoesNotCountAsCompletion: "Provider narrative or deliverable-only completion.",
  safeContinuationContext: "Continue F2 on this branch with projection wiring next.",
} as const;

describe("evaluateCompletionGate", () => {
  it("rejects completion while a required criterion is pending", () => {
    const result = evaluateCompletionGate({
      lane: makeLane(),
      acceptanceCriteria: [makeCriterion({ status: "pending" })],
      checks: [makeCheck({ status: "not-run" })],
      evidence: makeEvidence(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected denial");
    }
    expect(result.reasons.some((reason) => reason.includes("pending"))).toBe(true);
  });

  it("rejects when tests/evidence exist but verifier has not accepted", () => {
    const result = evaluateCompletionGate({
      lane: makeLane(),
      acceptanceCriteria: [
        makeCriterion({
          status: "satisfied",
          supportingReceiptIds: [ReceiptId.make("receipt-criterion")],
        }),
      ],
      checks: [
        makeCheck({
          status: "passed",
          supportingReceiptIds: [ReceiptId.make("receipt-check")],
        }),
      ],
      evidence: makeEvidence({
        verifierDecision: "pending",
        uiAcceptanceStatus: "passed",
        uiAcceptanceReceiptId: ReceiptId.make("receipt-ui"),
        completionReport: { ...passingReport },
      }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected denial");
    }
    expect(result.reasons.some((reason) => reason.includes("verifier"))).toBe(true);
  });

  it("accepts after criterion satisfied, checks passed, verifier accepted, UI + report present", () => {
    const result = evaluateCompletionGate({
      lane: makeLane(),
      acceptanceCriteria: [
        makeCriterion({
          status: "satisfied",
          supportingReceiptIds: [ReceiptId.make("receipt-criterion")],
        }),
      ],
      checks: [
        makeCheck({
          status: "passed",
          supportingReceiptIds: [ReceiptId.make("receipt-check")],
        }),
      ],
      evidence: makeEvidence({
        verifierDecision: "accepted",
        verifierReceiptId: ReceiptId.make("receipt-verifier"),
        uiAcceptanceStatus: "passed",
        uiAcceptanceReceiptId: ReceiptId.make("receipt-ui"),
        completionReport: { ...passingReport },
      }),
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects unresolved blockers and failed required checks", () => {
    const result = evaluateCompletionGate({
      lane: makeLane({
        blockerIds: [BlockerId.make("blocker-1")],
      }),
      acceptanceCriteria: [makeCriterion({ status: "satisfied" })],
      checks: [makeCheck({ status: "failed" })],
      evidence: makeEvidence({
        verifierDecision: "accepted",
        verifierReceiptId: ReceiptId.make("receipt-verifier"),
        uiAcceptanceStatus: "passed",
        uiAcceptanceReceiptId: ReceiptId.make("receipt-ui"),
        completionReport: { ...passingReport },
      }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected denial");
    }
    expect(result.reasons.some((reason) => reason.includes("blocker"))).toBe(true);
    expect(result.reasons.some((reason) => reason.includes("failed"))).toBe(true);
  });

  it("demonstrates reject-then-accept for the Wave 1 F2 demo", () => {
    const lane = makeLane();
    const pending = evaluateCompletionGate({
      lane,
      acceptanceCriteria: [makeCriterion({ status: "pending" })],
      checks: [makeCheck({ status: "not-run" })],
      evidence: makeEvidence({ verifierDecision: "absent" }),
    });
    expect(pending.ok).toBe(false);

    const accepted = evaluateCompletionGate({
      lane,
      acceptanceCriteria: [
        makeCriterion({
          status: "satisfied",
          supportingReceiptIds: [ReceiptId.make("receipt-criterion")],
        }),
      ],
      checks: [
        makeCheck({
          status: "passed",
          supportingReceiptIds: [ReceiptId.make("receipt-check")],
        }),
      ],
      evidence: makeEvidence({
        verifierDecision: "accepted",
        verifierReceiptId: ReceiptId.make("receipt-verifier"),
        uiAcceptanceStatus: "passed",
        uiAcceptanceReceiptId: ReceiptId.make("receipt-ui"),
        completionReport: { ...passingReport },
      }),
    });
    expect(accepted).toEqual({ ok: true });
  });
});
