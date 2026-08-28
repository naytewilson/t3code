import type { OrchestrationCommand, WorkLaneState } from "@t3tools/contracts";
import {
  isAllowedWorkLaneTransition,
  isWorkLaneTerminalState,
  isWorkLaneWorktreeOwningState,
  WORK_LANE_NORMAL_TRANSITIONS,
  WORK_LANE_TERMINAL_STATES,
  WORK_LANE_WORKTREE_OWNING_STATES,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { OrchestrationCommandInvariantError } from "./Errors.ts";

export {
  isAllowedWorkLaneTransition,
  isWorkLaneTerminalState,
  isWorkLaneWorktreeOwningState,
  WORK_LANE_NORMAL_TRANSITIONS,
  WORK_LANE_TERMINAL_STATES,
  WORK_LANE_WORKTREE_OWNING_STATES,
};

/**
 * Supersede is a terminal exit that is not listed in the normal matrix —
 * allowed from any non-terminal state.
 */
export function isAllowedWorkLaneSupersede(from: WorkLaneState): boolean {
  return !isWorkLaneTerminalState(from);
}

export function requireAllowedWorkLaneTransition(input: {
  readonly commandType: OrchestrationCommand["type"];
  readonly from: WorkLaneState;
  readonly to: WorkLaneState;
}): Effect.Effect<void, OrchestrationCommandInvariantError> {
  if (isAllowedWorkLaneTransition(input.from, input.to)) {
    return Effect.void;
  }
  return Effect.fail(
    new OrchestrationCommandInvariantError({
      commandType: input.commandType,
      detail: `Work lane transition from '${input.from}' to '${input.to}' is not allowed.`,
    }),
  );
}
