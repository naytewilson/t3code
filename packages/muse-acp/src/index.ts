#!/usr/bin/env node

import { Readable, Writable } from "node:stream";

import { ndJsonStream } from "@agentclientprotocol/sdk";

import { connectMuseAcp } from "./acp-server.js";

const writable = Writable.toWeb(process.stdout);
const readable = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
const server = connectMuseAcp(ndJsonStream(writable, readable));

let stopping = false;
const stop = (): void => {
  if (stopping) return;
  stopping = true;
  void server.close();
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  await server.closed;
} catch (error) {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`muse-acp: ${detail}\n`);
  process.exitCode = 1;
} finally {
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
  await server.close().catch(() => undefined);
}
