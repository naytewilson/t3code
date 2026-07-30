# MacBrains Fork Identity and Release Isolation

## Objective

Ship MacBrains T3 Code beside upstream T3 Code without sharing application identity, user data, update channels, hosted control planes, package publication, credentials, or release artifacts by accident.

This document defines required isolation. Concrete public domains, Apple team configuration, package registry names, and signing credentials must be resolved from current MacBrains-owned resources during U0 implementation. Do not invent or publish them merely from examples below.

## Non-negotiable isolation boundaries

The fork must have independent values for:

- product display name;
- desktop executable and application name;
- macOS bundle identifier;
- Windows application/product identifiers;
- Linux desktop/AppImage identifiers;
- mobile iOS/Android bundle/package identifiers;
- desktop protocol/custom URL scheme;
- data/config/cache/log directories;
- Keychain/credential-service identifiers;
- IPC/socket/service names;
- npm/registry package names;
- GitHub release repository and updater metadata;
- stable/nightly/dev update channels;
- hosted web domains;
- relay/control-plane resources;
- authentication tenant and passkey relying-party domains;
- APNS/FCM application identifiers;
- analytics/OTLP service identity;
- service/unit/launch-agent names;
- signing/notarization credentials.

A visible logo or window-title change is not fork isolation.

## Recommended identity intent

The implementation should use a central typed identity manifest rather than scattered literals.

```ts
interface ForkIdentity {
  productName: string
  productSlug: string
  desktopAppName: string
  desktopBundleId: string
  mobileBundleId: string
  androidApplicationId: string
  urlScheme: string
  dataDirectoryName: string
  serviceName: string
  cliPackageName: string
  updateRepository: string | null
  hostedWebOrigin: string | null
  relayOrigin: string | null
  authTenant: string | null
  telemetryServiceName: string
}
```

Initial intent, subject to resource validation:

- product name: `MacBrains T3 Code`;
- product slug: `macbrains-t3code`;
- data root: distinct from `~/.t3`, for example a MacBrains-specific directory;
- application IDs: MacBrains-owned reverse-DNS namespace;
- updater repository: `naytewilson/t3code` or a later dedicated release repository;
- hosted/relay/auth origins: disabled unless explicitly configured with MacBrains-owned resources.

Do not hard-code placeholder domains or bundle IDs into production release artifacts. Fail closed or clearly mark local-only builds when required identity values are not configured.

## Data-directory isolation

### Requirements

- Never open upstream `~/.t3/userdata` read-write by default.
- A MacBrains install starts with its own empty data root.
- Import from upstream is an explicit one-time or repeatable operation.
- Import is copy-based, schema-validated, logged, and reversible.
- Never symlink active upstream state into the fork.
- Preserve original files and provide an import receipt.
- Detect when both apps are running and prevent shared database access.

### Import flow

1. Inspect source profile read-only.
2. Verify no upstream process has the SQLite source open when a consistent copy is required.
3. Copy SQLite database plus WAL/SHM consistently or use SQLite backup API.
4. Copy only supported secrets/settings through typed migration adapters.
5. Rewrite fork-specific endpoint/update/identity fields.
6. Validate and open the imported profile in isolation.
7. Produce a receipt listing imported, skipped, transformed, and failed records.
8. Preserve a rollback snapshot of the fork profile.

## CLI and package publication

The upstream release graph publishes npm package `t3` and relies on exact package versions for remote server self-update. The fork must not assume permission to publish that package.

Choose and verify a distinct package identity before enabling release self-update. Until then:

- development/local source launches are allowed;
- packaged desktop can supervise its bundled backend;
- remote self-update must be disabled or offer a MacBrains-specific manual command;
- no client should request `t3@<fork-version>` from upstream npm by accident.

The release invariant remains: a client must never advertise an automatic exact-version server update unless the matching fork server artifact is already available and verified.

## Desktop update channels

Use MacBrains-owned GitHub releases and updater metadata. Required separation:

- repository slug;
- stable/nightly channel names if upstream metadata names would collide;
- artifact names;
- update cache directory;
- public key/signature identity where supported;
- current installed-app identity.

The About screen must show:

- MacBrains product version;
- fork commit SHA;
- upstream base commit SHA;
- update channel;
- server version per environment;
- whether the build is local/dev, unsigned, signed, or notarized.

Do not silently fall back to upstream release feeds.

## Hosted web, relay, and authentication

The upstream release process refers to T3-owned Vercel domains, relay infrastructure, Clerk configuration, passkey domains, and production credentials. The fork must not use these implicitly.

Supported safe modes:

1. **Local/private-only mode** — desktop/local web plus direct Tailscale/LAN/SSH endpoints; hosted MacBrains control plane disabled.
2. **Self-hosted web mode** — MacBrains-owned HTTPS web origin connecting directly to authenticated environments.
3. **MacBrains relay mode** — enabled only after separate relay, auth tenant, DNS, secrets, notifications, and operational ownership are configured.

Default the fork to local/private-only mode until MacBrains-owned hosted resources are proven.

Any UI referencing upstream T3 Connect must be hidden, disabled with a clear reason, or explicitly configurable. Never send environment metadata or user credentials to upstream services as a side effect of branding the fork.

## Mobile identity

Mobile release requires independent:

- iOS bundle ID and provisioning profile;
- associated domains/passkey configuration;
- APNS topic/key/team ownership;
- Android application ID and signing key;
- deep-link schemes and universal/app links;
- push notification environment;
- app store/TestFlight identity.

Local development may use a clearly marked dev identity. Do not claim mobile distribution complete from simulator-only or upstream TestFlight behavior.

## Service identity

Linux systemd and macOS launch/service integration must use fork-specific unit names, paths, logs, and runtime directories. Service management must not stop or rewrite an upstream T3 service.

Before install/update/uninstall:

- verify the exact service owner/path;
- preserve existing unrelated units;
- use captured PID/service identity, never name-pattern process killing;
- record a command receipt.

## Telemetry and privacy

Use a separate OTLP service name and endpoint configuration. No telemetry endpoint is enabled by default unless the user configured it. Persisted local traces must live under the fork data root.

The evidence/receipt subsystem is not analytics. Receipts remain user-owned local project evidence unless explicitly exported.

## Branding assets

Use the official MacBrains logo and wordmark supplied by the project owner. Do not invent substitutes in implementation branches. Generate required platform sizes from one canonical source asset and verify icon export scripts.

Required surfaces:

- desktop app icon/window/About;
- web favicon/PWA/metadata;
- mobile icons/splash/About;
- installer/release artifacts;
- command center empty/loading/error surfaces;
- notification identity.

Branding must not regress accessibility or performance.

## Upstream synchronization strategy

Maintain remotes:

- `origin` -> Nayte's fork;
- `upstream` -> `pingdotgg/t3code`.

Recommended durable branches:

- fork `main`: integrated, proven MacBrains baseline;
- `upstream-sync/<date>`: temporary import branch from current upstream;
- package branches/worktrees: focused implementation;
- release branches/tags: only after full gate.

Sync procedure:

1. Fetch origin and upstream.
2. Record current fork main, upstream main, merge base, and divergence.
3. Create isolated upstream-sync worktree/branch.
4. Integrate upstream without rewriting proven fork history.
5. Resolve conflicts by preserving MacBrains contracts and current upstream correctness.
6. Run schema migrations and package-focused checks.
7. Run provider, connection, persistence, command-center, and E0 regression gates as affected.
8. Independent verifier reviews the source diff and acceptance impact.
9. Merge only with a sync receipt that lists upstream commits, conflicts, superseded fork patches, tests, and unresolved gaps.

Do not routinely rebase long-lived integrated fork main onto upstream. Focused feature branches may rebase before integration when safe.

## Release channels

Define at least:

- `dev`: local source builds, isolated data root, no updater;
- `preview`: internal MacBrains desktop/mobile artifacts, explicit warnings, private update feed if configured;
- `stable`: only after full acceptance matrix and signing/notarization requirements.

Nightly is optional. Do not create an automated nightly channel until tests, artifact retention, update rollback, and remote server version coordination are proven.

## Release gate additions

In addition to the acceptance matrix, release requires:

- side-by-side upstream/fork install test;
- data-directory collision test;
- protocol/deep-link collision test;
- service collision test;
- clean uninstall preserving upstream and user projects;
- updater repository/feed verification;
- hosted network audit showing no unintended upstream endpoints;
- signed/notarized identity inspection when distributing signed builds;
- mobile bundle/push/deep-link verification;
- rollback from new release to last-known-good where schema permits;
- exact matching remote server package/artifact available before client update action.

## Failure behavior

When fork identity configuration is incomplete:

- build local/dev artifacts with explicit local-only labeling, or fail the release job;
- do not substitute upstream values;
- do not publish;
- do not enable self-update;
- do not enable relay/auth features;
- show the missing configuration in release receipts.

## Completion criterion

U0 is `PROVEN` only when a MacBrains build and upstream T3 Code can coexist on the same Mac without sharing application identity, mutable state, services, update feeds, credentials, protocols, or hosted control-plane traffic, and the MacBrains build can be identified and updated through its own verified release path.