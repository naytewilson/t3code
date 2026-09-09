import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { ProviderDriverKind, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";

import { makeDirectCliAdapter } from "./DirectCliAdapter.ts";
import { parseCommandCodeJsonLine, parseCommandCodeSessionLine } from "./CommandCodeAdapter.ts";

it.layer(NodeServices.layer)("direct CLI process adapter", (it) => {
  it.effect("spawns a real child process and streams a resumable turn", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const provider = ProviderDriverKind.make("commandcode");
        const instanceId = ProviderInstanceId.make("commandcode_process_test");
        const threadId = ThreadId.make("direct_cli_process_test");
        const sessionId = "fake-session-123";
        const toolCallId = "tool-read-123";
        const script = [
          `console.error("session: ${sessionId}")`,
          `console.log(${JSON.stringify(
            JSON.stringify({
              type: "event",
              event: { type: "thinking_delta", text: "inspect first" },
            }),
          )})`,
          `console.log(${JSON.stringify(
            JSON.stringify({
              type: "event",
              event: {
                type: "message_update",
                content: [
                  {
                    type: "tool_use",
                    id: toolCallId,
                    name: "read_file",
                    input: { file_path: "/workspace/README.md" },
                  },
                ],
              },
            }),
          )})`,
          `console.log(${JSON.stringify(
            JSON.stringify({
              type: "event",
              event: { type: "tool_running", toolCallId, toolName: "read_file" },
            }),
          )})`,
          `console.log(${JSON.stringify(
            JSON.stringify({
              type: "event",
              event: {
                type: "tool_completed",
                toolCallId,
                toolName: "read_file",
                result: [{ type: "text", text: "read output" }],
              },
            }),
          )})`,
          `console.log(${JSON.stringify(
            JSON.stringify({
              type: "event",
              event: { type: "text_delta", text: "hello from child" },
            }),
          )})`,
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
          Stream.take(9),
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
          [
            "turn.started",
            "item.started",
            "content.delta",
            "item.started",
            "item.updated",
            "item.completed",
            "content.delta",
            "item.completed",
            "turn.completed",
          ],
        );
        const deltas = events.filter((event) => event.type === "content.delta");
        assert.equal(deltas[0]?.payload.streamKind, "reasoning_text");
        assert.equal(deltas[0]?.payload.delta, "inspect first");
        assert.equal(deltas[1]?.payload.streamKind, "assistant_text");
        assert.equal(deltas[1]?.payload.delta, "hello from child");
        const toolStarted = events.find(
          (event) => event.type === "item.started" && String(event.itemId) === toolCallId,
        );
        if (toolStarted?.type !== "item.started") throw new Error("tool start event missing");
        assert.equal(toolStarted.payload.itemType, "dynamic_tool_call");
        assert.equal(toolStarted.payload.title, "read_file");
        assert.deepEqual(
          (toolStarted.payload.data as { rawInput?: unknown } | undefined)?.rawInput,
          { file_path: "/workspace/README.md" },
        );
        const toolCompleted = events.find(
          (event) => event.type === "item.completed" && String(event.itemId) === toolCallId,
        );
        if (toolCompleted?.type !== "item.completed")
          throw new Error("tool completion event missing");
        assert.equal(toolCompleted.payload.status, "completed");
        assert.deepEqual(
          (toolCompleted.payload.data as { rawOutput?: unknown } | undefined)?.rawOutput,
          [{ type: "text", text: "read output" }],
        );
        assert.deepEqual(
          (toolCompleted.payload.data as { rawInput?: unknown } | undefined)?.rawInput,
          { file_path: "/workspace/README.md" },
        );
        const snapshot = yield* adapter.readThread(threadId);
        assert.equal(snapshot.turns.length, 1);
      }),
    ),
  );
});
