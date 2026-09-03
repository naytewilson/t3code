import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";

const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const child = spawn(process.execPath, [entry], {
  cwd: process.cwd(),
  env: { ...process.env },
  stdio: ["pipe", "pipe", "pipe"],
});

let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const lines = createInterface({ input: child.stdout });
const response = new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(new Error(`Timed out waiting for ACP initialize response. stderr=${stderr}`));
  }, 5_000);

  lines.once("line", (line) => {
    clearTimeout(timer);
    try {
      resolve(JSON.parse(line));
    } catch (error) {
      reject(new Error(`Invalid ACP JSON response: ${line}`, { cause: error }));
    }
  });

  child.once("exit", (code, signal) => {
    clearTimeout(timer);
    reject(
      new Error(
        `muse-acp exited before initialize response: code=${String(code)} signal=${String(signal)} stderr=${stderr}`,
      ),
    );
  });
});

child.stdin.write(
  `${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {},
    },
  })}\n`,
);

try {
  const message = await response;
  if (message?.id !== 1 || message?.result?.agentInfo?.name !== "muse-acp") {
    throw new Error(`Unexpected ACP initialize response: ${JSON.stringify(message)}`);
  }
  if (message.result.agentCapabilities?.loadSession !== true) {
    throw new Error(`muse-acp did not advertise loadSession: ${JSON.stringify(message)}`);
  }

  child.stdin.end();
  const [code, signal] = await Promise.race([
    once(child, "exit"),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`muse-acp did not exit after stdin EOF. stderr=${stderr}`)), 5_000),
    ),
  ]);
  if (code !== 0) {
    throw new Error(
      `muse-acp exited nonzero after smoke: code=${String(code)} signal=${String(signal)} stderr=${stderr}`,
    );
  }
  process.stdout.write("muse-acp ACP stdio smoke: PASS\n");
} finally {
  lines.close();
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}
