import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import {
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";

import { makeDirectCliAdapter } from "./DirectCliAdapter.ts";
import {
  parseCommandCodeJsonLine,
  parseCommandCodeSessionLine,
} from "./CommandCodeAdapter.ts";

it.layer(NodeServices.layer)("direct CLI process adapter", (it) => {
  it.effect("spawns a real child process and streams a resumable turn", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const provider = ProviderDriverKind.make("commandcode");
        const instanceId = ProviderInstanceId.make("commandcode_process_test");
        const threadId = ThreadId.make("direct_cli_process_test");
        const sessionId = "fake-session-123";
        const script = [
          `console.error("session: ${sessionId}")`,
          `console.log('{"type":"event","event":{"type":"text_delta","text":"hello from child"}}')`,
          `console.log('{"type":"result","subtype":"success","sessionId":"${sessionId}","stopReason":"end_turn"}')`,
        ].join(";");

        const adapter = yield* makeDirectCliAdapter({
          provider,
          instanceId,
          binaryPath: process.execPath,
          environment: process.env,
          sessionIdMode: "reported-by-cli",
          buildArgs: () => ["-e", script],
          parseStdoutLine: parseCommandCodeJsonLine,
          parseSessionLine: parseCommandCodeSessionLine,
        });

        yield* adapter.startSession({
          threadId,
          provider,
          providerInstanceId: instanceId,
          runtimeMode: "full-access",
        });

        const eventsFiber = yield* adapter.streamEvents.pipe(
          Stream.take(5),
          Stream.runCollect,
          Effect.forkScoped({ startImmediately: true }),
        );
        const turn = yield* adapter.sendTurn({
          threadId,
          input: "hello",
          interactionMode: "default",
        });
        const events = Array.from(yield* Fiber.join(eventsFiber));

        assert.deepEqual(turn.resumeCursor, { sessionId });
        assert.deepEqual(
          events.map((event) => event.type),
          ["turn.started", "item.started", "content.delta", "item.completed", "turn.completed"],
        );
        const delta = events.find((event) => event.type === "content.delta");
        assert.equal(delta?.payload.delta, "hello from child");
        const snapshot = yield* adapter.readThread(threadId);
        assert.equal(snapshot.turns.length, 1);
      }),
    ),
  );
});
