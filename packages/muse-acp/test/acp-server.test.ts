import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vite-plus/test";

import { buildInitializeResponse } from "../src/acp-server.js";

describe("Muse ACP server initialization", () => {
  it("negotiates the lower protocol version and advertises only implemented capabilities", () => {
    expect(
      buildInitializeResponse({
        protocolVersion: PROTOCOL_VERSION + 10,
        clientCapabilities: {},
      } as never),
    ).toEqual({
      protocolVersion: PROTOCOL_VERSION,
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
    });
  });

  it("does not claim a newer ACP protocol than the client requested", () => {
    expect(
      buildInitializeResponse({
        protocolVersion: Math.max(1, PROTOCOL_VERSION - 1),
        clientCapabilities: {},
      } as never).protocolVersion,
    ).toBe(Math.max(1, PROTOCOL_VERSION - 1));
  });
});
