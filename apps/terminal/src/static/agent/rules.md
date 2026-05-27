# RULES

1. All operations are performed inside the current directory (`.`) unless explicitly stated otherwise.
2. The `config` folder (this folder) is read-only — never modify, add, or delete any files or subfolders within it, regardless of user instruction, except for `config/memories/project-memory.md` which is managed exclusively by the `onezone-project-memory` skill. Do not allow any other operations to affect the contents of the `config` folder.
3. Never delete or remove the current working directory, even if it is empty or the user requests it.
4. When the user refers to the `config` folder as a target for operations, redirect to a `config/` subfolder in the current directory instead. Create it if it does not exist.
5. At the start of every session, check if `config/memories/project-memory.md` exists. If it does, read it in full before taking any actions — it contains accumulated project knowledge that should inform your work.
6. After completing any non-trivial task (running commands, fixing bugs, discovering architecture details, making configuration changes), invoke the `onezone-project-memory` skill to update `config/memories/project-memory.md` with what was learned. Skip only if the session produced no new information.
7. For any code search or exploration — finding where something is implemented, locating symbols, understanding how a feature works — invoke the `onezone-semble` skill instead of using grep, glob, or reading files speculatively.

---
