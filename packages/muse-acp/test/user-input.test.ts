import { describe, expect, it } from "vite-plus/test";

import {
  acpElicitationToMuseCommand,
  museUserInputToAcpElicitation,
  type MuseUserInputRequest,
} from "../src/user-input.js";

const request: MuseUserInputRequest = {
  sessionId: "session-1",
  userInputId: "input-1",
  turnId: "turn-1",
  itemId: "tool-1",
  autoResolutionMs: 120_000,
  questions: [
    {
      id: "target",
      header: "Target",
      question: "Which target?",
      selection: { mode: "single", minSelections: 1, maxSelections: 1 },
      options: [{ label: "A" }, { label: "B" }],
    },
    {
      id: "checks",
      header: "Checks",
      question: "Which checks?",
      selection: { mode: "multiple", minSelections: 1, maxSelections: 2 },
      options: [{ label: "Lint" }, { label: "Test" }, { label: "Build" }],
    },
  ],
};

describe("Muse user input <-> ACP elicitation", () => {
  it("maps Muse single/multiple selections to one ACP form without inventing options", () => {
    expect(museUserInputToAcpElicitation(request)).toEqual({
      mode: "form",
      sessionId: "session-1",
      toolCallId: "tool-1",
      message: "Muse needs input",
      requestedSchema: {
        type: "object",
        properties: {
          target: {
            type: "string",
            title: "Target",
            description: "Which target?",
            enum: ["A", "B"],
          },
          checks: {
            type: "array",
            title: "Checks",
            description: "Which checks?",
            minItems: 1,
            maxItems: 2,
            items: { type: "string", enum: ["Lint", "Test", "Build"] },
          },
        },
        required: ["target", "checks"],
      },
      _meta: {
        "muse/userInputId": "input-1",
        "muse/turnId": "turn-1",
        "muse/autoResolutionMs": 120_000,
      },
    });
  });

  it("turns an accepted ACP form into a native Muse answer using only offered labels", () => {
    expect(
      acpElicitationToMuseCommand(request, {
        action: "accept",
        content: { target: "B", checks: ["Lint", "Test"] },
      }),
    ).toEqual({
      method: "userInput/answer",
      params: {
        sessionId: "session-1",
        userInputId: "input-1",
        answers: [
          { questionId: "target", selectedLabel: "B" },
          { questionId: "checks", selectedLabels: ["Lint", "Test"] },
        ],
      },
    });
  });

  it("fails closed when ACP returns a label Muse never offered", () => {
    expect(() =>
      acpElicitationToMuseCommand(request, {
        action: "accept",
        content: { target: "C", checks: ["Lint"] },
      }),
    ).toThrow(/not offered/i);
  });

  it("maps ACP decline/cancel to Muse userInput\/cancel instead of leaving the turn stuck", () => {
    expect(acpElicitationToMuseCommand(request, { action: "decline" })).toEqual({
      method: "userInput/cancel",
      params: {
        sessionId: "session-1",
        userInputId: "input-1",
        reason: "ACP client declined the Muse user-input request",
      },
    });

    expect(acpElicitationToMuseCommand(request, { action: "cancel" })).toEqual({
      method: "userInput/cancel",
      params: {
        sessionId: "session-1",
        userInputId: "input-1",
        reason: "ACP client cancelled the Muse user-input request",
      },
    });
  });
});
