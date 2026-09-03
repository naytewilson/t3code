# Muse Code over ACP

`packages/muse-acp` is a thin ACP adapter around Meta's **official Muse Code MSP host**.

```text
T3 Code / Paseo
      | ACP stdio
      v
   muse-acp
      | official @muse-code/sdk / MSP
      v
  muse serve
      v
Muse Code harness + coding-plan authentication
```

The adapter is intentionally not an agent runtime. Muse Code still owns its model loop, context, tools,
approvals, sandbox, subagents/workflows, session durability, and subscription authentication.

## Pinned protocol dependencies

- `@agentclientprotocol/sdk` `1.4.0`
- `@muse-code/sdk` `0.1.1`

The Muse SDK is pre-1.0 and experimental. Keep it pinned exactly and rerun this package's gate before
upgrading it.

## Prerequisites

1. Install the official `muse` CLI on the machine that runs the ACP process.
2. Authenticate Muse Code normally with the coding subscription. Do not extract or transplant the
   subscription credential into T3 or Paseo.
3. Confirm `muse` is on that process's `PATH`, or set `MUSE_BIN` to the absolute official Muse binary
   path.
4. Use Node.js 24.13.1 and pnpm 11.10.0, matching the cloud gate.

## Build and cloud-equivalent checks

From the T3 repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @nayte/muse-acp test
pnpm --filter @nayte/muse-acp typecheck
pnpm --filter @nayte/muse-acp build
pnpm --filter @nayte/muse-acp smoke
```

The smoke test is credential-free. It launches the compiled `dist/index.js`, performs a real ACP
`initialize` round trip over stdin/stdout, then proves the process exits cleanly when stdin closes.
It deliberately does not start `muse serve`.

## Run directly

```sh
node /ABSOLUTE/PATH/TO/t3code/packages/muse-acp/dist/index.js
```

Do not print/debug to stdout around this process. stdout is the ACP transport. Bridge failures are
written to stderr.

### Optional Muse binary override

```sh
MUSE_BIN=/absolute/path/to/muse \
  node /ABSOLUTE/PATH/TO/t3code/packages/muse-acp/dist/index.js
```

## T3 Code

This branch includes T3's generic ACP provider stack. Create an ACP provider instance named
**Muse Code** and configure:

- **Command:** the absolute Node binary path, or `node` when Node is reliably on the T3 server PATH.
- **Arguments:** the absolute path to `packages/muse-acp/dist/index.js`.

Using an absolute script path is recommended. T3 tokenizes the Arguments field and spawns the ACP
process directly; shell variables such as `$HOME` are not expanded by a shell.

The bridge advertises `loadSession: true`, so T3 resumes the exact native Muse session ID rather than
minting a replacement session.

T3's ACP runtime preserves `agent_thought_chunk` as `reasoning_text` internally. Current upstream T3
still intentionally omits reasoning streams from its normal chat transcript projection; that is a T3
presentation decision, not a loss in the Muse bridge.

## Paseo

No Paseo source patch is required. Add a **custom ACP provider** that launches the same compiled
adapter, for example conceptually:

```json
{
  "command": "node",
  "args": ["/ABSOLUTE/PATH/TO/t3code/packages/muse-acp/dist/index.js"]
}
```

If the Paseo daemon cannot resolve `muse` from its PATH, provide `MUSE_BIN` in the custom provider's
environment using the absolute official Muse binary path.

Both T3 and Paseo may point at the same adapter executable. Each ACP process owns its own MSP host
connection; Muse's native session ID is what provides continuation/resume identity.

## Preserved behavior

The bridge currently preserves:

- native Muse session start and exact-ID resume;
- native Muse turn submission and terminal outcome;
- assistant text streaming;
- Muse reasoning as ACP thought chunks;
- tool/user-shell lifecycle events;
- subagent and workflow activity as structured tool-like ACP activity;
- server-minted approval choice IDs, with fail-closed validation;
- turn cancellation using the exact native Muse session + turn IDs;
- structured Muse `userInput/request` through ACP form elicitation;
- Meta's required request-reply-before-`userInput/answer` ordering;
- Muse SDK durability/host-death semantics rather than re-deriving them locally.

## Deliberately not advertised

- ACP image input: not implemented yet, so `promptCapabilities.image` is `false`.
- ACP-supplied MCP servers: not bridged. Muse Code keeps using its own Muse CLI/harness MCP/config
  environment, so ACP `mcpCapabilities` are `false`.
- Generic ACP model switching: the adapter uses Muse Code's own configured/default model. T3 shows
  **Agent default** until/if the bridge later exposes Muse model configuration as ACP session state.

Failing to advertise an unimplemented capability is intentional. A pretty checkbox that lies is not a
feature.

## Local live-runtime acceptance

Cloud CI can prove the protocol adapter without the user's paid Muse session, but final runtime closure
must be performed on the authenticated machine:

1. Start a new Muse task through T3 and verify assistant/tool streaming.
2. Trigger an approval and round-trip allow/deny.
3. Trigger structured user input and answer it through the client.
4. Cancel a running Muse turn.
5. Restart the outer client and resume the same native Muse session ID.
6. Exercise a Muse subagent/workflow and verify activity survives through ACP.
7. Repeat the representative path from Paseo using the same adapter binary.
8. Confirm the underlying Muse session/event log shows native Muse harness continuity.

Do not call the integration runtime-proven until those authenticated local checks pass.
