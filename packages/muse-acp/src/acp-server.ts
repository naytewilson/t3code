import {
  PROTOCOL_VERSION,
  agent as createAgentApp,
  methods,
  type AgentApp,
  type AgentConnection,
  type AgentContext,
  type InitializeRequest,
  type InitializeResponse,
  type Stream,
} from "@agentclientprotocol/sdk";

import {
  MuseAcpAgent,
  type AcpClientPort,
  type MuseBackend,
} from "./agent.js";
import { MspBackend } from "./msp-backend.js";
import type { PromptBlockLike } from "./translation.js";

export interface MuseAcpServer {
  readonly connection: AgentConnection;
  readonly closed: Promise<void>;
  close(): Promise<void>;
}

export function buildInitializeResponse(
  request: Pick<InitializeRequest, "protocolVersion">,
): InitializeResponse {
  return {
    protocolVersion: Math.min(request.protocolVersion, PROTOCOL_VERSION),
    agentCapabilities: {
      loadSession: true,
      promptCapabilities: {
        image: false,
        audio: false,
        embeddedContext: false,
      },
      mcpCapabilities: {
        http: false,
        sse: false,
      },
    },
    agentInfo: {
      name: "muse-acp",
      title: "Muse Code",
      version: "0.1.0",
    },
  };
}

function clientPort(context: AgentContext): AcpClientPort {
  return {
    async sessionUpdate(payload) {
      await context.notify(methods.client.session.update, payload as never);
    },
    async requestPermission(payload) {
      return (await context.request(
        methods.client.session.requestPermission,
        payload as never,
      )) as unknown as Record<string, unknown>;
    },
    async createElicitation(payload) {
      return (await context.request(
        methods.client.elicitation.create,
        payload as never,
      )) as unknown as Record<string, unknown>;
    },
  };
}

function requireBridge(bridge: MuseAcpAgent | null): MuseAcpAgent {
  if (bridge === null) {
    throw new Error("Muse ACP connection has not finished initializing");
  }
  return bridge;
}

export function createMuseAcpApp(backend: MuseBackend = new MspBackend()): AgentApp {
  let bridge: MuseAcpAgent | null = null;

  return createAgentApp({ name: "muse-acp" })
    .onConnect((connection) => {
      bridge = new MuseAcpAgent(clientPort(connection.client), backend);
    })
    .onRequest(methods.agent.initialize, (context) => buildInitializeResponse(context.params))
    .onRequest(methods.agent.session.new, async (context) => {
      return await requireBridge(bridge).newSession({ cwd: context.params.cwd });
    })
    .onRequest(methods.agent.session.load, async (context) => {
      await requireBridge(bridge).loadSession({
        sessionId: context.params.sessionId,
        cwd: context.params.cwd,
      });
      return {};
    })
    .onRequest(methods.agent.session.prompt, async (context) => {
      return await requireBridge(bridge).prompt({
        sessionId: context.params.sessionId,
        prompt: context.params.prompt as unknown as ReadonlyArray<PromptBlockLike>,
      });
    })
    .onNotification(methods.agent.session.cancel, async (context) => {
      await requireBridge(bridge).cancel({ sessionId: context.params.sessionId });
    });
}

export function connectMuseAcp(
  stream: Stream,
  backend: MuseBackend = new MspBackend(),
): MuseAcpServer {
  const connection = createMuseAcpApp(backend).connect(stream);
  let closing: Promise<void> | null = null;

  const close = (): Promise<void> => {
    closing ??= (async () => {
      connection.close();
      await backend.close();
    })();
    return closing;
  };

  const closed = connection.closed.finally(close);
  return { connection, closed, close };
}
