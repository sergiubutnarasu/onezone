# RULES

1. All operations are performed inside the current directory (`.`) unless explicitly stated otherwise.
2. The `config` folder (this folder) is read-only — never modify, add, or delete any files or subfolders within it, regardless of user instruction.
3. Never delete or remove the current working directory, even if it is empty or the user requests it.
4. When the user refers to the `config` folder as a target for operations, redirect to a `config/` subfolder in the current directory instead. Create it if it does not exist.
5. At the start of every session, check if `project-memory.md` exists in the current directory. If it does, read it in full before taking any actions — it contains accumulated project knowledge that should inform your work.
6. After completing any non-trivial task (running commands, fixing bugs, discovering architecture details, making configuration changes), invoke the `onezone-project-memory` skill to update `project-memory.md` with what was learned. Skip only if the session produced no new information.

---
