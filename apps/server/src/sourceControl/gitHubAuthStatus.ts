import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const GitHubAuthStatusAccountSchema = Schema.Struct({
  state: Schema.String,
  error: Schema.optional(Schema.String),
  active: Schema.Boolean,
  host: Schema.String,
  login: Schema.String,
});

const GitHubAuthStatusSchema = Schema.Struct({
  hosts: Schema.Record(Schema.String, Schema.Array(GitHubAuthStatusAccountSchema)),
});

const decodeGitHubAuthStatusJson = Schema.decodeUnknownOption(
  Schema.fromJsonString(GitHubAuthStatusSchema),
);

export interface GitHubAuthStatusAccount {
  readonly host: string;
  readonly account: string;
  readonly authenticated: boolean;
  readonly active: boolean;
  readonly error: string | null;
}

export interface GitHubAuthStatus {
  readonly parsed: boolean;
  readonly accounts: ReadonlyArray<GitHubAuthStatusAccount>;
}

function nonEmptyString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseGitHubAuthStatusJson(text: string): GitHubAuthStatus | undefined {
  return Option.match(decodeGitHubAuthStatusJson(text), {
    onNone: () => undefined,
    onSome: (status) =>
      ({
        parsed: true,
        accounts: Object.values(status.hosts).flatMap((accounts) =>
          accounts.flatMap((account) => {
            const host = nonEmptyString(account.host);
            const login = nonEmptyString(account.login);
            if (host === null || login === null) return [];

            return [
              {
                host: host.toLowerCase(),
                account: login,
                authenticated: account.state === "success",
                active: account.active,
                error: account.error?.trim() || null,
              },
            ];
          }),
        ),
      }) satisfies GitHubAuthStatus,
  });
}

function parseGitHubAuthStatusText(text: string): GitHubAuthStatus {
  const accounts: GitHubAuthStatusAccount[] = [];
  let current: GitHubAuthStatusAccount | undefined;

  const flush = () => {
    if (current !== undefined) {
      accounts.push(current);
      current = undefined;
    }
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const loggedIn = /logged in to\s+([^\s]+)\s+account\s+([^\s(]+)/iu.exec(line);
    if (loggedIn) {
      const host = loggedIn[1];
      const account = loggedIn[2];
      if (host === undefined || account === undefined) continue;

      flush();
      current = {
        host: host.toLowerCase(),
        account,
        authenticated: true,
        active: true,
        error: null,
      };
      continue;
    }

    if (current === undefined) continue;

    const active = /active account:\s*(true|false)\b/iu.exec(line);
    if (active) {
      const activeValue = active[1];
      if (activeValue !== undefined) {
        current = { ...current, active: activeValue.toLowerCase() === "true" };
      }
    }
  }

  flush();
  return { parsed: accounts.length > 0, accounts };
}

export function parseGitHubAuthStatus(text: string): GitHubAuthStatus {
  return parseGitHubAuthStatusJson(text) ?? parseGitHubAuthStatusText(text);
}

export function findAuthenticatedGitHubAccount(
  accounts: ReadonlyArray<GitHubAuthStatusAccount>,
): GitHubAuthStatusAccount | undefined {
  return (
    accounts.find((account) => account.authenticated && account.active) ??
    accounts.find((account) => account.authenticated)
  );
}
