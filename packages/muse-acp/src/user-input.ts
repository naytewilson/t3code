export interface MuseUserInputOption {
  readonly label: string;
  readonly [key: string]: unknown;
}

export interface MuseUserInputSelection {
  readonly mode: "single" | "multiple";
  readonly minSelections?: number;
  readonly maxSelections?: number;
}

export interface MuseUserInputQuestion {
  readonly id: string;
  readonly header: string;
  readonly question: string;
  readonly selection: MuseUserInputSelection;
  readonly options: ReadonlyArray<MuseUserInputOption>;
}

export interface MuseUserInputRequest {
  readonly sessionId: string;
  readonly userInputId: string;
  readonly turnId: string;
  readonly itemId: string;
  readonly questions: ReadonlyArray<MuseUserInputQuestion>;
  readonly autoResolutionMs?: number;
}

export type AcpElicitationResponse =
  | {
      readonly action: "accept";
      readonly content: Readonly<Record<string, unknown>>;
    }
  | { readonly action: "decline" }
  | { readonly action: "cancel" };

export interface MuseUserInputCommand {
  readonly method: "userInput/answer" | "userInput/cancel";
  readonly params: Record<string, unknown>;
}

function offeredLabels(question: MuseUserInputQuestion): string[] {
  const labels = question.options.map((option) => option.label);
  if (labels.length === 0) {
    throw new Error(`Muse user-input question ${question.id} offered no options`);
  }
  if (new Set(labels).size !== labels.length) {
    throw new Error(`Muse user-input question ${question.id} offered duplicate labels`);
  }
  return labels;
}

function boundedSelectionCount(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function museUserInputToAcpElicitation(
  request: MuseUserInputRequest,
): Record<string, unknown> {
  if (request.questions.length === 0) {
    throw new Error("Muse userInput/request carried no questions");
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const question of request.questions) {
    if (question.id.length === 0) throw new Error("Muse user-input question id was empty");
    if (question.id in properties) {
      throw new Error(`Muse user-input question id ${question.id} was duplicated`);
    }
    const labels = offeredLabels(question);
    required.push(question.id);

    if (question.selection.mode === "single") {
      properties[question.id] = {
        type: "string",
        title: question.header,
        description: question.question,
        enum: labels,
      };
      continue;
    }

    const minItems = boundedSelectionCount(question.selection.minSelections);
    const maxItems = boundedSelectionCount(question.selection.maxSelections);
    properties[question.id] = {
      type: "array",
      title: question.header,
      description: question.question,
      ...(minItems === undefined ? {} : { minItems }),
      ...(maxItems === undefined ? {} : { maxItems }),
      items: { type: "string", enum: labels },
    };
  }

  return {
    mode: "form",
    sessionId: request.sessionId,
    toolCallId: request.itemId,
    message: "Muse needs input",
    requestedSchema: {
      type: "object",
      properties,
      required,
    },
    _meta: {
      "muse/userInputId": request.userInputId,
      "muse/turnId": request.turnId,
      ...(request.autoResolutionMs === undefined
        ? {}
        : { "muse/autoResolutionMs": request.autoResolutionMs }),
    },
  };
}

function assertOffered(question: MuseUserInputQuestion, label: string): void {
  if (!offeredLabels(question).includes(label)) {
    throw new Error(
      `ACP selected label ${JSON.stringify(label)} that Muse did not offer for ${question.id}`,
    );
  }
}

function validateCount(question: MuseUserInputQuestion, values: ReadonlyArray<string>): void {
  const min = boundedSelectionCount(question.selection.minSelections);
  const max = boundedSelectionCount(question.selection.maxSelections);
  if (min !== undefined && values.length < min) {
    throw new Error(`ACP selected fewer than Muse's minimum for ${question.id}`);
  }
  if (max !== undefined && values.length > max) {
    throw new Error(`ACP selected more than Muse's maximum for ${question.id}`);
  }
}

function cancelCommand(
  request: MuseUserInputRequest,
  reason: string,
): MuseUserInputCommand {
  return {
    method: "userInput/cancel",
    params: {
      sessionId: request.sessionId,
      userInputId: request.userInputId,
      reason,
    },
  };
}

export function acpElicitationToMuseCommand(
  request: MuseUserInputRequest,
  response: AcpElicitationResponse,
): MuseUserInputCommand {
  if (response.action === "decline") {
    return cancelCommand(request, "ACP client declined the Muse user-input request");
  }
  if (response.action === "cancel") {
    return cancelCommand(request, "ACP client cancelled the Muse user-input request");
  }

  const answers: Array<Record<string, unknown>> = [];
  for (const question of request.questions) {
    const value = response.content[question.id];
    if (question.selection.mode === "single") {
      if (typeof value !== "string") {
        throw new Error(`ACP returned a non-string selection for Muse question ${question.id}`);
      }
      assertOffered(question, value);
      answers.push({ questionId: question.id, selectedLabel: value });
      continue;
    }

    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
      throw new Error(`ACP returned a non-string-array selection for Muse question ${question.id}`);
    }
    const selected = value as string[];
    if (new Set(selected).size !== selected.length) {
      throw new Error(`ACP returned duplicate selections for Muse question ${question.id}`);
    }
    validateCount(question, selected);
    for (const label of selected) assertOffered(question, label);
    answers.push({ questionId: question.id, selectedLabels: selected });
  }

  return {
    method: "userInput/answer",
    params: {
      sessionId: request.sessionId,
      userInputId: request.userInputId,
      answers,
    },
  };
}
