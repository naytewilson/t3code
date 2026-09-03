import { assert, describe, it } from "@effect/vitest";

import {
  buildCommandCodeArgs,
  parseCommandCodeJsonLine,
  parseCommandCodeSessionLine,
} from "./CommandCodeAdapter.ts";

describe("Command Code direct CLI adapter protocol", () => {
  it("builds native headless NDJSON args with resume, model, effort, and full access", () => {
    assert.deepEqual(
      buildCommandCodeArgs({
        prompt: "fix it",
        sessionId: "session-1",
        model: "command-model",
        reasoningEffort: "high",
        runtimeMode: "full-access",
        interactionMode: "default",
      }),
      [
        "-p",
        "fix it",
        "--output-format",
        "json",
        "--verbose",
        "--skip-onboarding",
        "--trust",
        "--resume",
        "session-1",
        "--model",
        "command-model",
        "--effort",
        "high",
        "--yolo",
      ],
    );
  });

  it("lets plan mode override full-access execution", () => {
    const args = buildCommandCodeArgs({
      prompt: "plan it",
      model: "default",
      reasoningEffort: "default",
      runtimeMode: "full-access",
      interactionMode: "plan",
    });

    assert.include(args, "--permission-mode");
    assert.include(args, "plan");
    assert.notInclude(args, "--yolo");
  });

  it("parses the early verbose session id", () => {
    assert.equal(parseCommandCodeSessionLine("session: 9f4e1c0a-test"), "9f4e1c0a-test");
    assert.equal(parseCommandCodeSessionLine("other: noise"), undefined);
  });

  it("parses NDJSON text deltas and final results", () => {
    assert.deepEqual(
      parseCommandCodeJsonLine(
        JSON.stringify({
          type: "event",
          event: { type: "text_delta", text: "hello" },
        }),
      ),
      { kind: "assistant_delta", text: "hello" },
    );

    assert.deepEqual(
      parseCommandCodeJsonLine(
        JSON.stringify({
          type: "result",
          subtype: "success",
          sessionId: "session-1",
          stopReason: "end_turn",
          finalText: "done",
        }),
      ),
      {
        kind: "result",
        subtype: "success",
        sessionId: "session-1",
        stopReason: "end_turn",
        finalText: "done",
      },
    );
  });
});
