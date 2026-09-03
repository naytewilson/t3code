import { assert, describe, it } from "@effect/vitest";

import { buildMuseExecArgs, parseMuseJsonLine } from "./MuseAdapter.ts";

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

    assert.equal(parseMuseJsonLine("{\"payload_type\":\"future.event\",\"payload\":{}}"), undefined);
  });
});
