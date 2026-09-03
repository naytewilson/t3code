import { describe, expect, it } from "vite-plus/test";

import {
  MuseAcpAgent,
  type AcpClientPort,
  type MuseBackend,
  type MuseBackendSession,
  type MuseBackendTurn,
} from "../src/agent.js";
import type { MuseItemLike } from "../src/translation.js";

async function* values<T>(items: ReadonlyArray<T>): AsyncIterableIterator<T> {
  for (const item of items) yield item;
}

class FakeClient implements AcpClientPort {
  readonly updates: Array<Record<string, unknown>> = [];
  readonly permissionRequests: Array<Record<string, unknown>> = [];
  selectedPermissionOption = "allow_once";

  async sessionUpdate(payload: Record<string, unknown>): Promise<void> {
    this.updates.push(payload);
  }

  async requestPermission(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.permissionRequests.push(payload);
    return { outcome: { outcome: "selected", optionId: this.selectedPermissionOption } };
  }
}

class FakeSession implements MuseBackendSession {
  approvalHandler:
    | ((request: Record<string, unknown>) => Promise<{ choiceId: string }>)
    | undefined;

  constructor(
    readonly sessionId: string,
    readonly turn: MuseBackendTurn,
  ) {}

  onApproval(handler: (request: Record<string, unknown>) => Promise<{ choiceId: string }>): void {
    this.approvalHandler = handler;
  }

  async sendText(text: string): Promise<MuseBackendTurn> {
    expect(text).toBe("do the work");
    return this.turn;
  }
}

class FakeBackend implements MuseBackend {
  readonly starts: string[] = [];
  readonly resumes: string[] = [];
  readonly cancels: Array<{ sessionId: string; turnId: string }> = [];

  constructor(readonly session: FakeSession) {}

  async startSession(workspaceRoot: string): Promise<MuseBackendSession> {
    this.starts.push(workspaceRoot);
    return this.session;
  }

  async resumeSession(sessionId: string): Promise<MuseBackendSession> {
    this.resumes.push(sessionId);
    return this.session;
  }

  async cancel(sessionId: string, turnId: string): Promise<void> {
    this.cancels.push({ sessionId, turnId });
  }

  async close(): Promise<void> {}
}

function completedTurn(): MuseBackendTurn {
  const items: MuseItemLike[] = [
    { itemId: "thought", kind: "reasoning", revision: 1, status: "inProgress" },
    { itemId: "answer", kind: "agentMessage", revision: 1, status: "inProgress" },
    {
      itemId: "tool",
      kind: "toolCall",
      revision: 1,
      status: "inProgress",
      tool: "shell",
    },
  ];
  return {
    turnId: "turn-1",
    items: () => values(items),
    deltas: () =>
      values([
        { itemId: "thought", delta: "checking" },
        { itemId: "answer", delta: "done" },
      ]),
    completed: Promise.resolve({ kind: "completed", terminal: "completed" }),
  };
}

describe("Muse ACP agent", () => {
  it("uses the native Muse session id for ACP and streams structured events", async () => {
    const client = new FakeClient();
    const session = new FakeSession("muse-session-1", completedTurn());
    const backend = new FakeBackend(session);
    const agent = new MuseAcpAgent(client, backend);

    const created = await agent.newSession({ cwd: "/repo", mcpServers: [] } as never);
    expect(created.sessionId).toBe("muse-session-1");
    expect(backend.starts).toEqual(["/repo"]);

    const response = await agent.prompt({
      sessionId: "muse-session-1",
      prompt: [{ type: "text", text: "do the work" }],
    } as never);

    expect(response.stopReason).toBe("end_turn");
    expect(client.updates).toContainEqual({
      sessionId: "muse-session-1",
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "checking" },
      },
    });
    expect(client.updates).toContainEqual({
      sessionId: "muse-session-1",
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "done" },
      },
    });
    expect(client.updates).toContainEqual(
      expect.objectContaining({
        sessionId: "muse-session-1",
        update: expect.objectContaining({ sessionUpdate: "tool_call", toolCallId: "tool" }),
      }),
    );
  });

  it("resumes the exact Muse session instead of minting a replacement", async () => {
    const client = new FakeClient();
    const session = new FakeSession("muse-session-1", completedTurn());
    const backend = new FakeBackend(session);
    const agent = new MuseAcpAgent(client, backend);

    await agent.loadSession({ sessionId: "muse-session-1", cwd: "/repo", mcpServers: [] } as never);
    expect(backend.resumes).toEqual(["muse-session-1"]);
  });

  it("forwards cancellation to the active native Muse turn", async () => {
    const client = new FakeClient();
    let settle!: (value: { kind: "completed"; terminal: "cancelled" }) => void;
    const turn: MuseBackendTurn = {
      turnId: "turn-cancel",
      items: () => values([]),
      deltas: () => values([]),
      completed: new Promise((resolve) => {
        settle = resolve;
      }),
    };
    const session = new FakeSession("muse-session-1", turn);
    const backend = new FakeBackend(session);
    const agent = new MuseAcpAgent(client, backend);
    await agent.newSession({ cwd: "/repo", mcpServers: [] } as never);

    const pending = agent.prompt({
      sessionId: "muse-session-1",
      prompt: [{ type: "text", text: "do the work" }],
    } as never);
    await Promise.resolve();
    await agent.cancel({ sessionId: "muse-session-1" } as never);
    expect(backend.cancels).toEqual([{ sessionId: "muse-session-1", turnId: "turn-cancel" }]);
    settle({ kind: "completed", terminal: "cancelled" });
    await expect(pending).resolves.toMatchObject({ stopReason: "cancelled" });
  });

  it("round-trips only a Muse-offered approval choice id", async () => {
    const client = new FakeClient();
    const session = new FakeSession("muse-session-1", completedTurn());
    const backend = new FakeBackend(session);
    const agent = new MuseAcpAgent(client, backend);
    await agent.newSession({ cwd: "/repo", mcpServers: [] } as never);

    const approval = await session.approvalHandler?.({
      approvalId: "approval-1",
      itemId: "tool-1",
      tool: "shell",
      availableChoices: [
        { choiceId: "allow_once", decision: "approved", label: "Allow once", scope: "once" },
        { choiceId: "deny", decision: "denied", label: "Deny", scope: "once" },
      ],
    });

    expect(approval).toEqual({ choiceId: "allow_once" });
    expect(client.permissionRequests[0]).toMatchObject({
      sessionId: "muse-session-1",
      toolCall: { toolCallId: "tool-1", title: "shell" },
    });
  });
});
