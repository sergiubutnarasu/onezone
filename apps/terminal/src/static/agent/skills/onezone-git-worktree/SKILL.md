---
name: onezone-git-worktree
description: "Manage git worktree lifecycle for task isolation. Invoke in 'setup' mode at session start for every task, regardless of whether a repository is configured — it initializes a git repo with `git init` if one doesn't already exist, verifies you're in the correct worktree/branch for this task before reusing one, and syncs from the default branch before creating a new one. Invoke in 'commit-and-cleanup' mode before completing the final column to commit, push, and remove the worktree."
argument-hint: "setup | commit-and-cleanup"
license: MIT
metadata:
  author: Onezone
  version: "1.2"
---

# Git Worktree Management

Manages isolated git worktrees for task execution. Each task runs on its own branch inside a dedicated worktree, keeping changes isolated from the main branch until the task is complete.

## Input

`$ARGUMENTS[0]` — one of:
- `setup` — create the worktree at task start
- `commit-and-cleanup` — commit, push, and remove the worktree before task completion

The `taskId` and `taskName` values come from the onezone-runner session input.

---

## `setup` Mode

**Goal:** Create an isolated worktree for this task so all file edits happen on a dedicated branch — never leaving work uncommitted in a directory with no version control.

### Step 0: Ensure a Git Repository Exists

Work must never happen outside version control. Check whether the current directory is already inside a git repo, and initialize one if not:

```bash
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || git init
```

A freshly initialized repo has no commits yet, so `git worktree add` has nothing to branch from. Create an initial commit in that case:

```bash
git rev-parse HEAD >/dev/null 2>&1 || {
  git add -A
  git commit -m "chore: initial commit" --allow-empty
}
```

This step must run unconditionally, whether or not the task's `repository` field is set — a missing `repository` field only means there is no remote configured yet, not that git should be skipped.

### Step 1: Determine This Task's Expected Worktree Path and Branch

Choose a Conventional Commits type based on the task context (`taskName`, `taskDescription`, `kanbanColumnInstructions`):

| Type | When to use |
|---|---|
| `feat` | new feature or capability |
| `fix` | bug fix |
| `refactor` | code restructuring without behaviour change |
| `docs` | documentation only |
| `test` | adding or updating tests |
| `chore` | maintenance, tooling, dependency updates |
| `perf` | performance improvement |
| `ci` | CI/CD changes |

Build a kebab-case slug from `taskName` (lowercase, spaces → hyphens, strip special chars, max 40 chars), then append the first 8 characters of `taskId`:

```
BRANCH="<type>/<taskId[0:8]>-<slug>"  # e.g. feat/a1b2c3d4-add-user-authentication
WORKTREE_PATH=".worktrees/<taskId>"
```

### Step 2: Verify You're Already in the Correct Worktree/Branch

Never assume the current directory is right for this task — check it explicitly:

```bash
TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
```

- If `basename "$TOPLEVEL"` equals `<taskId>`, its parent directory is named `.worktrees`, **and** `$CURRENT_BRANCH` contains the `<taskId[0:8]>` slug: you're already in the correct place — skip straight to **Step 5** and report the current path.
- Otherwise (main workdir root, or a *different* task's leftover worktree): move back to the main workdir root before continuing, so the remaining steps run from a known location:

```bash
MAIN_ROOT=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
cd "$MAIN_ROOT"
```

### Step 3: Ensure `.worktrees` Is Ignored

Before creating any worktree directory, verify it is in `.gitignore`:

```bash
grep -qxF '.worktrees' .gitignore 2>/dev/null || echo '.worktrees' >> .gitignore
```

If `.gitignore` was modified, commit the change immediately on the current branch:

```bash
git add .gitignore
git commit -m "chore: ignore .worktrees directory"
```

### Step 4: Create the Worktree (Syncing the Default Branch First)

```bash
if [ -d "$WORKTREE_PATH" ]; then
  echo "Worktree already exists at $WORKTREE_PATH — reusing."
else
  # No worktree/branch for this task yet — sync the default branch before branching off
  # it, so the new branch starts from the latest upstream code, not a stale local HEAD.
  git fetch origin --prune 2>/dev/null
  DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | sed -n '/HEAD branch/s/.*: //p')

  if [ -n "$DEFAULT_BRANCH" ] && git rev-parse --verify "origin/$DEFAULT_BRANCH" >/dev/null 2>&1; then
    BASE_REF="origin/$DEFAULT_BRANCH"
  else
    BASE_REF="HEAD"  # no remote configured yet — branch off the local repo as-is
  fi

  git worktree add -b "$BRANCH" "$WORKTREE_PATH" "$BASE_REF" 2>/dev/null || \
    git worktree add -B "$BRANCH" "$WORKTREE_PATH" "$BASE_REF"
fi
```

### Step 5: Switch All Work to the Worktree

Change the working directory into the worktree **immediately**:

```bash
cd ".worktrees/<taskId>"
pwd  # confirm cwd is now inside the worktree
```

Report the result:

```
Worktree ready at .worktrees/<taskId> on branch <type>/<taskId[0:8]>-<slug>
Now working in: <absolute-path-to-worktree>
```

**All subsequent file reads and edits for this task must be performed with the worktree as the working directory.** Never reference the main workdir root for file operations after this point.

---

## `commit-and-cleanup` Mode

**Goal:** Persist the task's changes to the remote and release the worktree.

### Step 1: Stage and Commit All Changes

From inside the worktree directory (`.worktrees/<taskId>/`):

```bash
cd .worktrees/<taskId>
git add -A
git diff --cached --quiet || git commit -m "<type>: <description>"
```

The commit message must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
- Use the same `<type>` chosen for the branch name (e.g. `feat`, `fix`, `chore`).
- `<description>` is a short imperative sentence derived from `taskName` (lowercase, ≤72 chars).
- Example: `feat: add user authentication via JWT`

If there are no staged changes (diff is empty), skip the commit — no error. If changes were already committed during the task, that's fine — proceed to push.

### Step 2: Push the Branch

Still from inside the worktree directory:

```bash
git push origin "<type>/<taskId[0:8]>-<slug>" --set-upstream
```

If the push fails due to missing remote or auth issues, log the failure and continue with cleanup — do **not** abort.

### Step 3: Remove the Worktree

Switch to the **main workdir root** (the directory where the `.worktrees/` folder lives) before removing:

```bash
cd <workdir-root>
git worktree remove ".worktrees/<taskId>" --force
```

### Step 4: Report

```
✔ Changes committed and pushed to branch <type>/<taskId[0:8]>-<slug>
✔ Worktree .worktrees/<taskId> removed
```

---

## Red Flags

**Never:**
- Skip Step 0 — never do file work in a directory that isn't a git repository; `git init` it first
- Skip Step 2 — never assume an already-checked-out worktree or branch belongs to this task; verify the path and branch name match `taskId` before reusing it
- Create a *new* worktree/branch without first fetching and branching off the default branch (Step 4) — stale local state must never be the base for new work
- Create a worktree without first ensuring `.worktrees` is in `.gitignore`
- Perform Step 3 (Remove the Worktree) from inside the worktree directory — always `cd` to the main workdir root first

**Always:**
- Include the first 8 chars of `taskId` as suffix in the branch name for uniqueness
- Use the same Conventional Commits type for both the branch name and the commit message
- Treat push failures as non-fatal — cleanup must still proceed (there may be no remote configured yet)
- Work exclusively in `.worktrees/<taskId>/` after setup is complete
