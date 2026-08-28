# Pull the MacBrains T3 Code Work to the Mac

## What exists now

The fork contains the specification branch:

```text
macbrains/agent-workflow-overhaul
```

Do not implement directly in an unrelated local checkout without first confirming its remotes, branch, HEAD, dirty state, and worktrees.

## Existing local clone

Run from the existing local repository root:

```sh
git remote -v
git status --short --branch
git worktree list --porcelain
git fetch origin --prune
git rev-parse origin/macbrains/agent-workflow-overhaul
```

If `origin` is not `naytewilson/t3code`, do not continue until the correct fork remote is added or selected.

To inspect the specification without switching the primary checkout, create a separate worktree:

```sh
mkdir -p ../t3code-worktrees
git worktree add ../t3code-worktrees/macbrains-spec origin/macbrains/agent-workflow-overhaul
cd ../t3code-worktrees/macbrains-spec
git status --short --branch
git rev-parse HEAD
```

Read:

```sh
sed -n '1,240p' MACBRAINS.md
sed -n '1,220p' docs/macbrains/README.md
```

Then read every linked specification file before implementation.

## Fresh clone

Choose an explicit local parent directory and run:

```sh
git clone https://github.com/naytewilson/t3code.git
cd t3code
git fetch origin --prune
git switch --track origin/macbrains/agent-workflow-overhaul
git status --short --branch
git rev-parse HEAD
```

Do not assume the directory created by `git clone` is the desired permanent project location. Move or clone it into the intended projects directory before agents create long-lived worktrees.

## Start the first implementation lane

From a clean fork checkout:

```sh
git fetch origin --prune
git switch main
git pull --ff-only origin main
mkdir -p ../t3code-worktrees
git worktree add -b macbrains/f0-work-lane-contracts \
  ../t3code-worktrees/f0-work-lane-contracts \
  origin/macbrains/agent-workflow-overhaul
cd ../t3code-worktrees/f0-work-lane-contracts
```

The first agent must run source-truth preflight before installing dependencies or editing. It must verify whether implementation should branch from the specification branch or whether that branch has already been integrated into fork `main`.

Do not reuse the example branch/worktree when another active agent already owns F0. Create a new focused branch and worktree with a unique package identifier.

## Sync an agent branch onto the Mac

Given an agent branch named `<agent-branch>`:

```sh
git fetch origin --prune
git show-ref --verify "refs/remotes/origin/<agent-branch>"
git worktree add "../t3code-worktrees/<agent-branch-safe-name>" \
  "origin/<agent-branch>"
cd "../t3code-worktrees/<agent-branch-safe-name>"
git status --short --branch
git rev-parse HEAD
```

Replace placeholders explicitly. Do not paste the angle-bracket values literally.

If the branch already has a local tracking branch:

```sh
git switch <agent-branch>
git pull --ff-only origin <agent-branch>
```

Never use `git reset --hard`, `git clean`, or a forced branch switch merely to make the pull succeed. Inspect and preserve local changes first.

## Verify what was pulled

```sh
git log --oneline --decorate -n 20
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git status --short --branch
```

For the specification branch, verify these files exist:

```sh
for path in \
  MACBRAINS.md \
  docs/macbrains/README.md \
  docs/macbrains/FORK_BASELINE.md \
  docs/macbrains/DOCUMENTATION_AUDIT.md \
  docs/macbrains/PRODUCT_SPEC.md \
  docs/macbrains/DOMAIN_MODEL.md \
  docs/macbrains/IMPLEMENTATION_LEDGER.md \
  docs/macbrains/ACCEPTANCE_MATRIX.md \
  docs/macbrains/DEFAULT_POLICIES.json \
  docs/macbrains/FORK_IDENTITY_AND_RELEASE.md \
  docs/macbrains/AGENT_EXECUTION_PROMPT.md; do
  test -f "$path" || { printf 'missing: %s\n' "$path" >&2; exit 1; }
done
```

## Dependency setup

Use only commands proven by the current checkout's `AGENTS.md`, root `package.json`, lockfiles, and toolchain files. The analyzed baseline uses Vite+ `vp` and a worktree setup script, but the agent must re-verify current requirements before installation.

Never point a development server at live `~/.t3/userdata`. Worktree development should use its isolated `.t3` state or an explicit safe home directory.

## Pulling completed implementation to the integration lane

Do not merge from the primary checkout. Use a clean integration worktree:

```sh
git fetch origin --prune
git worktree add -b macbrains/integration-<date> \
  ../t3code-worktrees/macbrains-integration-<date> \
  origin/main
cd ../t3code-worktrees/macbrains-integration-<date>
```

Before integrating a package branch:

```sh
git status --short --branch
git log --oneline --decorate origin/main..origin/<agent-branch>
git diff --stat origin/main...origin/<agent-branch>
git diff --name-status origin/main...origin/<agent-branch>
```

Use the repository's chosen merge/rebase policy and rerun all checks invalidated by integration. Do not claim that an agent branch is integrated merely because it exists on GitHub.

## Safe cleanup

Only remove a worktree after proving it is not active and has no uncommitted work:

```sh
git -C <worktree-path> status --short --branch
git worktree list --porcelain
```

Then, using the exact inspected path:

```sh
git worktree remove <worktree-path>
git worktree prune --dry-run
```

Do not use process-name killing, wildcard deletion, `git clean`, or forced worktree removal as routine cleanup.

## Pull completion receipt

Record:

- local repository root;
- origin URL;
- branch;
- exact HEAD;
- worktree path;
- clean/dirty state;
- commits pulled;
- changed files;
- dependency setup result;
- checks run on the Mac;
- whether the branch is only present, reviewed, or actually integrated.

A successful fetch/pull does not count as implementation, integration, testing, or release completion.