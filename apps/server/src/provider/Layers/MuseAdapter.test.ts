import { assert, describe, it } from "@effect/vitest";

import { buildMuseExecArgs, makeMuseJsonLineParser, parseMuseJsonLine } from "./MuseAdapter.ts";

describe("Muse direct CLI adapter protocol", () => {
  it("builds native muse exec JSONL args without a bridge", () => {
    assert.deepEqual(
      buildMuseExecArgs({
        prompt: "fix it",
        sessionId: "session-1",
        model: "default",
        reasoningEffort: "default",
      }),
      ["exec", "--json", "--session-id", "session-1", "fix it"],
    );

    assert.deepEqual(
      buildMuseExecArgs({
        prompt: "fix it",
        sessionId: "session-1",
        model: "muse-model",
        reasoningEffort: "high",
      }),
      [
        "exec",
        "--json",
        "--session-id",
        "session-1",
        "--model",
        "muse-model",
        "--reasoning-effort",
        "high",
        "fix it",
      ],
    );
  });

  it("parses Muse JSONL assistant deltas and ignores unknown records", () => {
    assert.deepEqual(
      parseMuseJsonLine(
        JSON.stringify({
          payload_type: "run.output.delta",
          payload: { kind: "run_output_delta", text: "hello" },
        }),
      ),
      { kind: "assistant_delta", text: "hello" },
    );

    assert.equal(parseMuseJsonLine('{"payload_type":"future.event","payload":{}}'), undefined);
  });

  it("preserves observed Muse tool identity, lifecycle, and result text", () => {
    const parse = makeMuseJsonLineParser();
    const proposed = JSON.stringify({
      payload_type: "task.lifecycle.proposed",
      payload: {
        event: {
          kind: "proposed",
          task_id: "task-read-1",
          task_kind: "tool.read_file",
        },
      },
    });
    const scheduled = JSON.stringify({
      payload_type: "task.lifecycle.scheduled",
      payload: {
        event: {
          kind: "scheduled",
          task_id: "task-read-1",
          idempotency_key: "tool:call-read-1",
        },
      },
    });
    const started = JSON.stringify({
      payload_type: "task.lifecycle.started",
      payload: { event: { kind: "started", task_id: "task-read-1" } },
    });
    const result = JSON.stringify({
      payload_type: "tool.result",
      payload: {
        kind: "tool_result",
        call_id: "call-read-1",
        correlation_facts: { outcome: "success", tool_name: "read_file" },
        text: "Read text file `README.md`.\n1|# fixture",
      },
    });

    assert.equal(parse(proposed), undefined);
    assert.deepEqual(parse(scheduled), {
      kind: "tool_call",
      toolCallId: "call-read-1",
      toolName: "read_file",
      status: "pending",
    });
    assert.deepEqual(parse(started), {
      kind: "tool_call",
      toolCallId: "call-read-1",
      toolName: "read_file",
      status: "inProgress",
    });
    assert.deepEqual(parse(result), {
      kind: "tool_call",
      toolCallId: "call-read-1",
      toolName: "read_file",
      status: "completed",
      output: "Read text file `README.md`.\n1|# fixture",
    });

    assert.deepEqual(parseMuseJsonLine(result), {
      kind: "tool_call",
      toolCallId: "call-read-1",
      toolName: "read_file",
      status: "completed",
      output: "Read text file `README.md`.\n1|# fixture",
    });
  });
});
