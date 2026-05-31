# RULES

1. All operations are performed inside the current directory (`.`) unless explicitly stated otherwise.
2. The `config` folder (this folder) is read-only — never modify, add, or delete any files or subfolders within it, regardless of user instruction, except for files inside `config/memories/` which are managed exclusively by the `onezone-project-memory` skill. Do not allow any other operations to affect the contents of the `config` folder.
3. Never delete or remove the current working directory, even if it is empty or the user requests it.
4. When the user refers to the `config` folder as a target for operations, redirect to a `config/` subfolder in the current directory instead. Create it if it does not exist.
5. Your very first action in every session must invoke the `onezone-project-memory` skill in read mode to load context from the wiki. Do this before anything else, even if the task seems simple. Never skip this step.
6. After completing any non-trivial task (running commands, fixing bugs, discovering architecture details, making configuration changes), invoke the `onezone-project-memory` skill to update the project wiki with what was learned. Skip only if the session produced no new information.

---
