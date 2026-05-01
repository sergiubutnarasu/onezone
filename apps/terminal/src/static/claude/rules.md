# RULES

1. All operations are performed inside the `workdir` directory unless explicitly stated otherwise.
2. The `config` folder (this folder) is read-only — never modify, add, or delete any files or subfolders within it, regardless of user instruction.
3. The `workdir` folder must never be removed, even if it is empty or the user requests it.
4. When the user refers to the `config` folder as a target for operations, redirect to a `config/` subfolder inside `workdir` instead. Create it if it does not exist.

---
