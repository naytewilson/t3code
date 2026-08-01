import type { WorkLaneShell, WorkLaneState } from "@t3tools/contracts";

import type { CommandCenterSection } from "./types.ts";

const ATTENTION_STATES = new Set<WorkLaneState>(["blocked", "failed", "recovery-required"]);

const ACTIVE_STATES = new Set<WorkLaneState>([
  "queued",
  "preflight",
  "oriented",
  "planned",
  "executing",
  "testing",
]);

/**
 * Map a durable WorkLaneShell into a command-center section.
 * Ready-for-review (`reviewing`) and ready-to-use (`deliverable-ready` /
 * completed) stay distinct per acceptance K04.
 */
export function classifyLaneShell(
  lane: Pick<WorkLaneShell, "state">,
  options: {
    readonly hasOpenBlocker?: boolean;
    readonly hasFailedCheck?: boolean;
    readonly hasReadyDeliverable?: boolean;
  } = {},
): Exclude<CommandCenterSection, "node-activity"> {
  if (
    options.hasOpenBlocker === true ||
    options.hasFailedCheck === true ||
    ATTENTION_STATES.has(lane.state)
  ) {
    return "needs-attention";
  }
  if (lane.state === "reviewing") {
    return "ready-for-review";
  }
  if (lane.state === "deliverable-ready") {
    return "ready-to-use";
  }
  if (lane.state === "completed" && options.hasReadyDeliverable === true) {
    return "ready-to-use";
  }
  if (ACTIVE_STATES.has(lane.state)) {
    return "active";
  }
  // cancelled / superseded / completed-without-deliverable: still surface under
  // attention so nothing silently disappears from the home shell.
  return "needs-attention";
}

export function nextActionForSection(
  section: Exclude<CommandCenterSection, "node-activity">,
  state: WorkLaneState,
): string {
  switch (section) {
    case "needs-attention":
      if (state === "blocked") return "Resolve blocker";
      if (state === "failed") return "Open failure evidence";
      if (state === "recovery-required") return "Start recovery";
      return "Inspect attention item";
    case "active":
      if (state === "queued" || state === "preflight") return "Open preflight";
      if (state === "planned") return "Start execution";
      return "Open live lane";
    case "ready-for-review":
      return "Request or continue review";
    case "ready-to-use":
      return "Open deliverable";
  }
}

export function attentionReasonForLane(
  lane: Pick<WorkLaneShell, "state">,
  options: {
    readonly hasOpenBlocker?: boolean;
    readonly hasFailedCheck?: boolean;
  } = {},
): string | null {
  if (options.hasOpenBlocker === true) return "Open blocker";
  if (options.hasFailedCheck === true) return "Failed check";
  if (lane.state === "blocked") return "Lane blocked";
  if (lane.state === "failed") return "Lane failed";
  if (lane.state === "recovery-required") return "Recovery required";
  return null;
}

export function groupCardsBySection<T extends { readonly section: CommandCenterSection }>(
  cards: ReadonlyArray<T>,
): Record<CommandCenterSection, ReadonlyArray<T>> {
  const empty: Record<CommandCenterSection, T[]> = {
    "needs-attention": [],
    active: [],
    "ready-for-review": [],
    "ready-to-use": [],
    "node-activity": [],
  };
  for (const card of cards) {
    empty[card.section].push(card);
  }
  return empty;
}
