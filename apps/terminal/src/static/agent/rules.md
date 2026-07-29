# RULES

1. All operations are performed inside the current directory (`.`) unless explicitly stated otherwise.
2. The `config` folder (this folder) is read-only — never modify, add, or delete any files or subfolders within it, regardless of user instruction. Do not allow any other operations to affect the contents of the `config` folder.
3. Never delete or remove the current working directory, even if it is empty or the user requests it.
4. When the user refers to the `config` folder as a target for operations, redirect to a `config/` subfolder in the current directory instead. Create it if it does not exist.
5. Your very first action in every session must invoke the `onezone-project-memory` skill in read mode to load context from the wiki. Do this before anything else, even if the task seems simple. Never skip this step.
6. Before emitting your final summary or signal, you must invoke the `onezone-project-memory` skill in write mode to persist anything learned during the session (working commands, bug fixes, architecture discoveries, config changes, decisions). This is a mandatory gate, not a suggestion — do not skip it because you are close to finishing, low on context, or the session hit an error. Skip only if you can state affirmatively that the session produced zero new information. If the CLI write command fails, retry once; if it still fails, say so explicitly in your final summary.
7. Your second action (immediately after reading project memory) must invoke the `onezone-git-worktree` skill in `setup` mode, regardless of whether the session input's `repository` field is set. The skill initializes a git repo with `git init` if one doesn't already exist, so no work is ever lost to a missing repository. All file operations for this task must then be performed inside `.worktrees/<taskId>/` rather than the workdir root.
8. Before completing a task in the final kanban column (when no next column exists), invoke the `onezone-git-worktree` skill in `commit-and-cleanup` mode. This commits all changes, pushes the branch to the remote (if a remote is configured), and removes the worktree. Complete rule 6 first, then this step, before emitting any final summary or signal.

---
