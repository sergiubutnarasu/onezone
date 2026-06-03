---
name: onezone-project-memory
description: "Maintain a living knowledge wiki for the project. Read at session start; write after completing tasks, discovering patterns, or fixing bugs. Uses a Karpathy-style wiki: raw/ for staged facts, wiki/ for compiled topic articles, INDEX.md as a navigable map. Stored remotely via the onezone-terminal memory command."
argument-hint: "Optional context hint, e.g. 'just ran migration', 'fixed auth bug', 'read' (read-only mode)"
---

# Project Memory Wiki

Maintain a living knowledge base for the project. Inspired by Karpathy's LLM Knowledge Base workflow: raw facts are staged, then compiled by the LLM into a structured wiki of topic articles with cross-links.

**All memory files are stored remotely via the `onezone-terminal memory` command.**
There are no local memory files. Use the CLI commands below to read and write.

```
memories/
  INDEX.md          ← navigable map of all wiki articles (auto-maintained)
  raw/              ← staging area: unprocessed facts dumped here first
    YYYY-MM-DD-<slug>.md
  wiki/             ← compiled knowledge articles (organized by topic)
    architecture.md
    commands.md
    environment.md
    issues.md
    decisions.md
    changelog.md
    <topic>.md      ← create new articles as the project grows
```

---

## When to Invoke

**Read mode** (argument contains "read" or no argument at session start):
- Read `INDEX.md` first; load only the articles relevant to the current task.

**Write mode** (after completing work):
- Running terminal commands (builds, tests, migrations, installs)
- Fixing bugs or resolving errors
- Discovering codebase patterns or architecture details
- Making configuration changes
- Completing any non-trivial task

Skip writing if the session produced no new information.

---

## CLI Commands

Use `onezone-terminal memory` to interact with project memory:

```sh
# List memory files
onezone-terminal memory list --project <project-id> [--prefix wiki/]

# Read a memory file
onezone-terminal memory read --project <project-id> --key <key>

# Write a memory file (inline content)
onezone-terminal memory write --project <project-id> --key <key> --content '<content>'

# Write a memory file from a local file
onezone-terminal memory write --project <project-id> --key <key> --file <path>

# Delete a memory file
onezone-terminal memory delete --project <project-id> --key <key>
```

The `--server` flag can be added to any command if the server is not at the default URL.

---

## Procedure

### READ — Loading Context at Session Start

1. Read `INDEX.md`:
   ```sh
   onezone-terminal memory read --project <project-id> --key INDEX.md
   ```
   If it does not exist, the wiki is empty — proceed with an empty context.
2. From the index, identify which wiki articles are relevant to the current task (e.g., if the task touches auth, load `wiki/architecture.md` and `wiki/decisions.md`).
3. Load only those articles using `memory read`. Do NOT load the entire wiki upfront — it wastes context. Load additional articles on demand as needed.

### WRITE — After Completing Work

Follow these four steps in order.

#### Step 1 — Stage raw facts

Create a new file in `raw/` named `YYYY-MM-DD-<slug>.md` where `<slug>` is a 2–5 word kebab-case description of what was learned (e.g., `2026-05-23-auth-jwt-flow.md`).

Dump every new fact from the session as bullet points. No formatting required — this is a staging area. Include:
- Commands that worked (exact invocations)
- Bug causes and fixes
- Architecture discoveries
- Config changes made
- Decisions and rationale

Skip facts already present in an existing wiki article.

Use `memory write` to upload the file:
```sh
onezone-terminal memory write --project <project-id> --key raw/YYYY-MM-DD-<slug>.md --content '<content>'
```

#### Step 2 — Compile raw into wiki

For each fact in the new raw file, decide which wiki article it belongs to:

| Fact type | Target article |
|-----------|---------------|
| Build/run/test commands | `wiki/commands.md` |
| Module structure, data flow, patterns | `wiki/architecture.md` |
| Env vars, ports, service config | `wiki/environment.md` |
| Bugs, gotchas, workarounds | `wiki/issues.md` |
| Why something was built a certain way | `wiki/decisions.md` |
| What changed recently | `wiki/changelog.md` |
| A new cohesive topic with 3+ facts | `wiki/<topic>.md` (create new) |

For each target article:
- **Exists**: Read it with `memory read`. Make surgical additions only — do not rewrite unchanged sections.
- **Does not exist**: Create it with `memory write` using the structure shown below.

Add **backlinks** at the bottom of each article pointing to related articles (e.g., `See also: [architecture.md](architecture.md)`).

#### Step 3 — Update INDEX.md

Rewrite `INDEX.md` to reflect the current state of the wiki. Format:

```markdown
# Project Wiki Index

> Last compiled: YYYY-MM-DD

## Articles
- [architecture.md](wiki/architecture.md) — Module structure, data flow, key patterns
- [commands.md](wiki/commands.md) — Build, run, test, migration commands
- [environment.md](wiki/environment.md) — Env vars, ports, service dependencies
- [issues.md](wiki/issues.md) — Known bugs, gotchas, workarounds
- [decisions.md](wiki/decisions.md) — Design decisions and rationale
- [changelog.md](wiki/changelog.md) — Recent significant changes
- [<topic>.md](wiki/<topic>.md) — <one-line description>

## Raw (uncompiled)
List any raw/ files not yet merged into the wiki, if any.
```

Keep descriptions to one line. The index is a navigation aid, not a summary.

Upload with:
```sh
onezone-terminal memory write --project <project-id> --key INDEX.md --content '<content>'
```

#### Step 4 — Lint (opportunistic, not mandatory every session)

When the wiki has grown significantly, run a health check over it:
- Flag entries that may be outdated (reference code that may have changed)
- Identify related facts in different articles that should be cross-linked
- Note potential new article candidates (3+ related facts scattered across articles)
- Mark resolved issues as `~~resolved YYYY-MM-DD~~`

Report findings as a brief note — do not auto-fix unless confident.

---

## Wiki Article Structure

```markdown
# <Topic Title>

> Last updated: YYYY-MM-DD

<One paragraph overview of this topic.>

## <Section>
...content...

## See Also
- [related-article.md](related-article.md) — why it's related
```

**Rules:**
- No secrets, tokens, or credentials ever.
- Commands must be copy-paste ready.
- Facts must be specific: not "something about auth" but "JWT is verified in `auth.guard.ts` using `JwtAuthGuard`".
- Timestamps in ISO format (YYYY-MM-DD).
- When a section hasn't changed, do not rewrite it.

---

## Merge Decision Per Fact

1. **Skip** — Already recorded accurately in a wiki article → do nothing.
2. **Add** — New fact not present anywhere → append to the appropriate article section.
3. **Update** — Existing entry is outdated → replace it in place.
4. **Flag** — Uncertain if still accurate → add `> ⚠️ Possibly outdated as of YYYY-MM-DD:` before the entry.

---

## Example wiki/commands.md

```markdown
# Commands

> Last updated: 2026-05-23

## Development
| Command | Description |
|---------|-------------|
| `docker compose up -d --build` | Start all services |
| `pnpm dev` | Start all apps in watch mode |

## Database
| Command | Description |
|---------|-------------|
| `pnpm --filter server prisma migrate dev` | Run DB migrations |
| `pnpm --filter server prisma db seed` | Seed the database |

## See Also
- [environment.md](environment.md) — Required env vars before running
- [architecture.md](architecture.md) — Service overview
```
