---
name: onezone-git-worktree
description: "Manage git worktree lifecycle for task isolation. Invoke in 'setup' mode at session start when the project has a repository; invoke in 'commit-and-cleanup' mode before completing the final column to commit, push, and remove the worktree."
argument-hint: "setup | commit-and-cleanup"
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

**Goal:** Create an isolated worktree for this task so all file edits happen on a dedicated branch.

### Step 0: Check if Already in a Worktree

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
git rev-parse --show-superproject-working-tree 2>/dev/null
```

- If `GIT_DIR != GIT_COMMON` **and** not a submodule: already in a linked worktree — skip to **Step 4** and record the current path as the working directory.
- Otherwise: continue to Step 1.

### Step 1: Ensure `.worktrees` Is Ignored

Before creating any worktree directory, verify it is in `.gitignore`:

```bash
grep -qxF '.worktrees' .gitignore 2>/dev/null || echo '.worktrees' >> .gitignore
```

If `.gitignore` was modified, commit the change immediately on the current branch:

```bash
git add .gitignore
git commit -m "chore: ignore .worktrees directory"
```

### Step 2: Derive the Branch Name

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

### Step 3: Create the Worktree

```bash
if [ -d "$WORKTREE_PATH" ]; then
  echo "Worktree already exists at $WORKTREE_PATH — reusing."
else
  git worktree add -b "$BRANCH" "$WORKTREE_PATH" 2>/dev/null || \
    git worktree add -B "$BRANCH" "$WORKTREE_PATH"
fi
```

### Step 4: Switch All Work to the Worktree

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
- Skip Step 0 — always detect existing isolation before creating a worktree
- Create a worktree without first ensuring `.worktrees` is in `.gitignore`
- Perform Step 3 (Remove the Worktree) from inside the worktree directory — always `cd` to the main workdir root first

**Always:**
- Include the first 8 chars of `taskId` as suffix in the branch name for uniqueness
- Use the same Conventional Commits type for both the branch name and the commit message
- Treat push failures as non-fatal — cleanup must still proceed
- Work exclusively in `.worktrees/<taskId>/` after setup is complete
