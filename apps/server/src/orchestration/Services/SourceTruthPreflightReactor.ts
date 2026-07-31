/**
 * SourceTruthPreflightReactor - produces source-truth receipts for workflow
 * preflight and refresh events.
 */
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";

export interface SourceTruthPreflightReactorShape {
  readonly start: () => Effect.Effect<void, never, Scope.Scope>;
}

export class SourceTruthPreflightReactor extends Context.Service<
  SourceTruthPreflightReactor,
  SourceTruthPreflightReactorShape
>()("t3/orchestration/Services/SourceTruthPreflightReactor") {}
