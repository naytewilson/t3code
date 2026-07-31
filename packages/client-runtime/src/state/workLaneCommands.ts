import * as Crypto from "effect/Crypto";
import { Atom } from "effect/unstable/reactivity";

import { createAtomCommandScheduler, createEnvironmentCommand } from "./runtime.ts";
import type { EnvironmentRegistry } from "../connection/registry.ts";
import {
  type ActivateWorkLanePlanInput,
  type CompleteWorkLaneInput,
  type CreateWorkLaneInput,
  type ProposeWorkLanePlanInput,
  type RecoverWorkLaneInput,
  type RefreshWorkLaneSourceTruthInput,
  type RequestWorkLanePreflightInput,
  type StartWorkLaneExecutionInput,
  activateWorkLanePlan,
  completeWorkLane,
  createWorkLane,
  proposeWorkLanePlan,
  recoverWorkLane,
  refreshWorkLaneSourceTruth,
  requestWorkLanePreflight,
  startWorkLaneExecution,
} from "../operations/commands.ts";

export type {
  ActivateWorkLanePlanInput,
  CompleteWorkLaneInput,
  CreateWorkLaneInput,
  ProposeWorkLanePlanInput,
  RecoverWorkLaneInput,
  RefreshWorkLaneSourceTruthInput,
  RequestWorkLanePreflightInput,
  StartWorkLaneExecutionInput,
} from "../operations/commands.ts";

export function createWorkLaneEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | Crypto.Crypto | R, E>,
) {
  const scheduler = createAtomCommandScheduler();
  const concurrency = {
    mode: "serial" as const,
    key: ({ environmentId, input }: { environmentId: string; input: { laneId: string } }) =>
      JSON.stringify([environmentId, input.laneId]),
  };

  return {
    create: createEnvironmentCommand(runtime, {
      label: "environment-data:commands:work-lane:create",
      execute: (input: CreateWorkLaneInput) => createWorkLane(input),
      scheduler,
      concurrency,
    }),
    requestPreflight: createEnvironmentCommand(runtime, {
      label: "environment-data:commands:work-lane:request-preflight",
      execute: (input: RequestWorkLanePreflightInput) => requestWorkLanePreflight(input),
      scheduler,
      concurrency,
    }),
    proposePlan: createEnvironmentCommand(runtime, {
      label: "environment-data:commands:work-lane:propose-plan",
      execute: (input: ProposeWorkLanePlanInput) => proposeWorkLanePlan(input),
      scheduler,
      concurrency,
    }),
    activatePlan: createEnvironmentCommand(runtime, {
      label: "environment-data:commands:work-lane:activate-plan",
      execute: (input: ActivateWorkLanePlanInput) => activateWorkLanePlan(input),
      scheduler,
      concurrency,
    }),
    startExecution: createEnvironmentCommand(runtime, {
      label: "environment-data:commands:work-lane:start-execution",
      execute: (input: StartWorkLaneExecutionInput) => startWorkLaneExecution(input),
      scheduler,
      concurrency,
    }),
    refreshSourceTruth: createEnvironmentCommand(runtime, {
      label: "environment-data:commands:work-lane:refresh-source-truth",
      execute: (input: RefreshWorkLaneSourceTruthInput) => refreshWorkLaneSourceTruth(input),
      scheduler,
      concurrency,
    }),
    complete: createEnvironmentCommand(runtime, {
      label: "environment-data:commands:work-lane:complete",
      execute: (input: CompleteWorkLaneInput) => completeWorkLane(input),
      scheduler,
      concurrency,
    }),
    recover: createEnvironmentCommand(runtime, {
      label: "environment-data:commands:work-lane:recover",
      execute: (input: RecoverWorkLaneInput) => recoverWorkLane(input),
      scheduler,
      concurrency,
    }),
  };
}
