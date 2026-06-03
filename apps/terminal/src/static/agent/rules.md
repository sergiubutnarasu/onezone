# RULES

1. All operations are performed inside the current directory (`.`) unless explicitly stated otherwise.
2. The `config` folder (this folder) is read-only — never modify, add, or delete any files or subfolders within it, regardless of user instruction. Do not allow any other operations to affect the contents of the `config` folder.
3. Never delete or remove the current working directory, even if it is empty or the user requests it.
4. When the user refers to the `config` folder as a target for operations, redirect to a `config/` subfolder in the current directory instead. Create it if it does not exist.
5. Your very first action in every session must invoke the `onezone-project-memory` skill in read mode to load context from the wiki. Do this before anything else, even if the task seems simple. Never skip this step.
6. After completing any non-trivial task (running commands, fixing bugs, discovering architecture details, making configuration changes), invoke the `onezone-project-memory` skill to update the project wiki with what was learned. Skip only if the session produced no new information.
7. If the session input contains a non-empty `repository` field, your second action (immediately after reading project memory) must invoke the `onezone-git-worktree` skill in `setup` mode. All file operations for this task must then be performed inside `.worktrees/<taskId>/` rather than the workdir root.
8. Before completing a task in the final kanban column (when no next column exists), if a git worktree was set up under rule 7, invoke the `onezone-git-worktree` skill in `commit-and-cleanup` mode. This commits all changes, pushes the branch to the remote, and removes the worktree. Complete this step before emitting any final summary or signal.

---
