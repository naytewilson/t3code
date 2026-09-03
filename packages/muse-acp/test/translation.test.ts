import { describe, expect, it } from "vite-plus/test";

import {
  approvalChoicesToAcpOptions,
  museDeltaToAcpUpdate,
  museItemToAcpUpdate,
  museOutcomeToAcpStopReason,
  promptBlocksToText,
} from "../src/translation.js";

describe("Muse MSP -> ACP translation", () => {
  it("joins text prompt blocks without inventing non-text content", () => {
    expect(
      promptBlocksToText([
        { type: "text", text: "first" },
        { type: "image", data: "ignored", mimeType: "image/png" },
        { type: "text", text: "second" },
      ]),
    ).toBe("first\n\nsecond");
  });

  it("streams Muse agent messages as ACP assistant chunks", () => {
    expect(
      museDeltaToAcpUpdate("agentMessage", {
        itemId: "item-a",
        delta: "hello",
      }),
    ).toEqual({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "hello" },
    });
  });

  it("streams Muse reasoning as ACP thought chunks", () => {
    expect(
      museDeltaToAcpUpdate("reasoning", {
        itemId: "item-r",
        field: "summary.0",
        delta: "checking repository state",
      }),
    ).toEqual({
      sessionUpdate: "agent_thought_chunk",
      content: { type: "text", text: "checking repository state" },
    });
  });

  it("represents Muse tool calls as ACP tool lifecycle rows", () => {
    expect(
      museItemToAcpUpdate({
        itemId: "tool-1",
        kind: "toolCall",
        revision: 1,
        status: "inProgress",
        tool: "shell",
        visibleOutput: "",
      }),
    ).toMatchObject({
      sessionUpdate: "tool_call",
      toolCallId: "tool-1",
      title: "shell",
      status: "in_progress",
    });

    expect(
      museItemToAcpUpdate({
        itemId: "tool-1",
        kind: "toolCall",
        revision: 2,
        status: "completed",
        tool: "shell",
        visibleOutput: "done",
      }),
    ).toMatchObject({
      sessionUpdate: "tool_call_update",
      toolCallId: "tool-1",
      status: "completed",
    });
  });

  it("surfaces Muse subagents/workflows as tool-like activity instead of flattening them into prose", () => {
    expect(
      museItemToAcpUpdate({
        itemId: "sub-1",
        kind: "subagent",
        revision: 1,
        status: "inProgress",
        role: "reviewer",
        objective: "review the provider adapter",
      }),
    ).toMatchObject({
      sessionUpdate: "tool_call",
      toolCallId: "sub-1",
      kind: "other",
      status: "in_progress",
    });

    expect(
      museItemToAcpUpdate({
        itemId: "wf-1",
        kind: "workflow",
        revision: 2,
        status: "completed",
        message: "workflow finished",
      }),
    ).toMatchObject({
      sessionUpdate: "tool_call_update",
      toolCallId: "wf-1",
      status: "completed",
    });
  });

  it("maps only server-offered approval choices and keeps their ids intact", () => {
    expect(
      approvalChoicesToAcpOptions([
        { choiceId: "allow_once", decision: "approved", label: "Allow once", scope: "once" },
        { choiceId: "deny", decision: "denied", label: "Deny", scope: "once" },
      ]),
    ).toEqual([
      { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
      { optionId: "deny", name: "Deny", kind: "reject_once" },
    ]);
  });

  it("maps session and policy-amendment approvals to durable allow options", () => {
    expect(
      approvalChoicesToAcpOptions([
        {
          choiceId: "allow_session",
          decision: "approvedForSession",
          label: "Allow session",
          scope: "session",
        },
        {
          choiceId: "allow_prefix",
          decision: "approvedPolicyAmendment",
          label: "Always allow here",
          scope: "workspace",
        },
        { choiceId: "abort", decision: "abort", label: "Reject", scope: "once" },
      ]),
    ).toEqual([
      { optionId: "allow_session", name: "Allow session", kind: "allow_always" },
      { optionId: "allow_prefix", name: "Always allow here", kind: "allow_always" },
      { optionId: "abort", name: "Reject", kind: "reject_once" },
    ]);
  });

  it("maps Muse terminals to ACP stop reasons without inventing success", () => {
    expect(museOutcomeToAcpStopReason({ kind: "completed", terminal: "completed" })).toBe(
      "end_turn",
    );
    expect(museOutcomeToAcpStopReason({ kind: "completed", terminal: "cancelled" })).toBe(
      "cancelled",
    );
    expect(museOutcomeToAcpStopReason({ kind: "unqueued" })).toBe("cancelled");
    expect(museOutcomeToAcpStopReason({ kind: "terminalUnknown" })).toBe("cancelled");
  });
});
