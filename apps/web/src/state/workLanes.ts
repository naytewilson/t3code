import { useAtomValue } from "@effect/atom-react";
import {
  createEnvironmentWorkLaneStateAtoms,
  createWorkLaneEnvironmentAtoms,
  EMPTY_ENVIRONMENT_WORK_LANE_STATE,
  type EnvironmentWorkLaneState,
} from "@t3tools/client-runtime/state/work-lanes";
import type { EnvironmentId, WorkLaneId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";

import { connectionAtomRuntime } from "../connection/runtime";

export const workLaneEnvironment = createWorkLaneEnvironmentAtoms(connectionAtomRuntime);
export const environmentWorkLanes = createEnvironmentWorkLaneStateAtoms(connectionAtomRuntime);

const EMPTY_WORK_LANE_STATE_ATOM = Atom.make(
  AsyncResult.success(EMPTY_ENVIRONMENT_WORK_LANE_STATE),
).pipe(Atom.withLabel("web-environment-work-lane:empty"));

export function useEnvironmentWorkLane(
  environmentId: EnvironmentId | null,
  laneId: WorkLaneId | null,
): EnvironmentWorkLaneState {
  const result = useAtomValue(
    environmentId !== null && laneId !== null
      ? environmentWorkLanes.stateAtom(environmentId, laneId)
      : EMPTY_WORK_LANE_STATE_ATOM,
  );
  return Option.getOrElse(
    AsyncResult.value(result),
    () => EMPTY_ENVIRONMENT_WORK_LANE_STATE,
  ) as EnvironmentWorkLaneState;
}
