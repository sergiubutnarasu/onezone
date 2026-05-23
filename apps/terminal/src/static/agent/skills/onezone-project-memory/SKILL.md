---
name: onezone-project-memory
description: "After running commands, completing tasks, or making discoveries, update the project-memory.md file with new knowledge. Use when: finishing a task, encountering a bug, learning a build command, discovering architecture details, or noticing gotchas. Reads existing project-memory.md first, then decides whether to add, update, or skip based on what changed."
argument-hint: "Optional context hint, e.g. 'just ran migration' or 'fixed auth bug'"
---

# Project Memory Updater

Maintain a living `project-memory.md` in the workspace root that accumulates project knowledge across sessions.

## When to Invoke

Invoke this skill after:
- Running terminal commands (builds, tests, migrations, installs)
- Fixing bugs or resolving errors
- Discovering codebase patterns or architecture details
- Making configuration changes
- Completing any non-trivial task

Skip if: the session produced no new information (e.g., only read files without learning anything new).

## Procedure

### Step 1 — Read Existing Memory

Check if `project-memory.md` exists in the workspace root.
- **Exists**: Read the full file. Note every section header and key fact already recorded.
- **Does not exist**: Proceed to create it fresh.

### Step 2 — Identify New Knowledge

From the current session context, extract facts worth persisting. Prioritize:

| Category | Examples |
|----------|---------|
| **Commands** | Build commands, migration steps, seed commands, docker commands that worked |
| **Architecture** | Module boundaries, data flow, patterns used, framework conventions |
| **Environment** | Required env vars, ports, service dependencies, Docker setup |
| **Known Issues** | Bugs, gotchas, workarounds, things that break |
| **Recent Changes** | Schema changes, API changes, new features added |
| **Decisions** | Why something was done a certain way |

### Step 3 — Merge Decision

For each piece of new knowledge, decide:

1. **Skip** — Already recorded accurately → do nothing for that fact.
2. **Add** — New information not present → add to the appropriate section.
3. **Update** — Existing entry is outdated or incomplete → replace/extend it.
4. **Flag** — Existing entry may be wrong (you're uncertain) → add a `> ⚠️ Possibly outdated:` note.

**Do not rewrite sections that haven't changed.** Make surgical additions only.

If nothing is new → write a brief note to the user that memory is already up to date, and stop. Do NOT rewrite the file.

### Step 4 — Write the File

Write or update `project-memory.md` using the structure below. When creating fresh, use all applicable sections. When updating, add/modify only the changed parts.

---

## File Structure

```markdown
# Project Memory

> Last updated: YYYY-MM-DD
> Auto-maintained by the project-memory skill.

## Project Overview
Brief description of what the project does and its stack.

## Stack & Tech
- Language/runtime versions
- Key frameworks and libraries
- Database, cache, message queue

## Development Setup
Step-by-step to get the project running locally (commands that actually work).

## Key Commands
| Command | Description |
|---------|-------------|
| `pnpm install` | Install deps |
| ... | ... |

## Architecture
High-level structure: modules, services, key patterns.

## Environment Variables
Required `.env` entries and what they control.

## Known Issues & Gotchas
Bugs, workarounds, non-obvious behavior.

## Recent Changes
Short log of significant recent work (newest first, keep last ~10 entries).

## Decisions & Rationale
Why things are the way they are.
```

---

## Update Format

When adding to **Recent Changes**, prepend a new line:
```
- YYYY-MM-DD: <one-line summary of what changed>
```
Keep only the 10 most recent entries. Drop older ones silently.

When updating a **Key Command**, replace the old row. Do not duplicate.

When adding a **Known Issue**, append a bullet. If a known issue was resolved, remove it or mark it ` ~~crossed out~~ — resolved YYYY-MM-DD`.

---

## Quality Checks

Before writing, verify:
- [ ] No secrets, tokens, or credentials in the file
- [ ] Commands are copy-paste ready (no placeholders left)
- [ ] Each new fact is specific (avoid "something about auth" → prefer "JWT is verified in `auth.guard.ts`")
- [ ] Timestamps use ISO format (YYYY-MM-DD)

---

## Example Output

```markdown
# Project Memory

> Last updated: 2026-05-23

## Project Overview
OneZone — AI agent orchestration platform. Monorepo with NestJS backend, Next.js frontend, terminal service.

## Stack & Tech
- Node.js 20, pnpm workspaces, Turborepo
- NestJS (server), Next.js 15 App Router (web), custom terminal CLI
- PostgreSQL + Prisma ORM, Redis (Socket.io adapter), Docker Compose

## Key Commands
| Command | Description |
|---------|-------------|
| `docker compose up -d --build` | Start all services |
| `pnpm --filter server prisma migrate dev` | Run DB migrations |
| `pnpm --filter server prisma db seed` | Seed the database |

## Known Issues & Gotchas
- Redis requires no auth in dev but must have password in prod (see `.env` `REDIS_PASSWORD`)
- `editorKey` state in dialogs forces RichTextEditor remount on open to prevent stale content
```
