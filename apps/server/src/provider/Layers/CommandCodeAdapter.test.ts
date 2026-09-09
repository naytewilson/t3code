import { assert, describe, it } from "@effect/vitest";

import {
  buildCommandCodeArgs,
  parseCommandCodeJsonLine,
  parseCommandCodeModelList,
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

  it("preserves Command Code thought and tool lifecycle records", () => {
    const toolCallId = "call-read-1";
    const lines = [
      {
        type: "event",
        event: { type: "thinking_delta", text: "I will inspect the file first." },
      },
      {
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
      },
      {
        type: "event",
        event: {
          type: "tool_queued",
          toolCallId,
          toolName: "read_file",
          input: { file_path: "/workspace/README.md" },
        },
      },
      {
        type: "event",
        event: {
          type: "tool_running",
          toolCallId,
          toolName: "read_file",
        },
      },
      {
        type: "event",
        event: {
          type: "tool_completed",
          toolCallId,
          toolName: "read_file",
          result: [{ type: "text", text: "PASEO CLI fidelity fixture" }],
        },
      },
    ];

    const parsed = lines.flatMap((line) => {
      const value = parseCommandCodeJsonLine(JSON.stringify(line));
      return Array.isArray(value) ? value : value === undefined ? [] : [value];
    });

    assert.deepEqual(parsed, [
      { kind: "thought_delta", text: "I will inspect the file first." },
      {
        kind: "tool_call",
        toolCallId,
        toolName: "read_file",
        status: "pending",
        input: { file_path: "/workspace/README.md" },
      },
      {
        kind: "tool_call",
        toolCallId,
        toolName: "read_file",
        status: "pending",
        input: { file_path: "/workspace/README.md" },
      },
      { kind: "tool_call", toolCallId, toolName: "read_file", status: "inProgress" },
      {
        kind: "tool_call",
        toolCallId,
        toolName: "read_file",
        status: "completed",
        output: [{ type: "text", text: "PASEO CLI fidelity fixture" }],
      },
    ]);
  });

  it("parses --list-models output structurally without a hardcoded model list", () => {
    const output = [
      "Available models  ·  3 models",
      "",
      "Open Source",
      "",
      "deepseek/deepseek-v4-flash           fast hybrid-attention reasoning (default)",
      "moonshotai/kimi-k2.5                 multimodal frontend coding",
      "",
      "Meta",
      "",
      "meta/muse-spark-1.2                  coding-optimized for agentic workflows",
      "",
      "Anthropic",
      "",
      "claude-opus-5                          most intelligent Opus for agents and coding",
      "gpt-5.4-mini                           fast, cost-effective model",
      "",
      'Pass the full id, or just the short name after the last "/":',
      "cmd --model moonshotai/kimi-k2.5",
      "Docs:  https://commandcode.ai/docs/reference/cli/models",
    ].join("\n");

    assert.deepEqual(parseCommandCodeModelList(output), [
      { slug: "deepseek/deepseek-v4-flash", shortName: "deepseek-v4-flash" },
      { slug: "moonshotai/kimi-k2.5", shortName: "kimi-k2.5" },
      { slug: "meta/muse-spark-1.2", shortName: "muse-spark-1.2" },
      { slug: "claude-opus-5", shortName: "claude-opus-5" },
      { slug: "gpt-5.4-mini", shortName: "gpt-5.4-mini" },
    ]);
  });

  it("ignores duplicates, prose, and empty output when parsing --list-models", () => {
    assert.deepEqual(
      parseCommandCodeModelList(
        ["x/y  first", "x/y  duplicate", "Prose without slash  desc", "", "  "].join("\n"),
      ),
      [{ slug: "x/y", shortName: "y" }],
    );
    assert.deepEqual(parseCommandCodeModelList(""), []);
    assert.deepEqual(parseCommandCodeModelList("update available: v9.9.9\n"), []);
  });
});
