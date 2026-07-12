---
name: gitmoji
description: Pick the right gitmoji and write a commit message in pact-web's style — emoji prefix + lowercase imperative subject, optional body. Use ONLY for commits in pact-web; every other repo uses plain subjects with no emoji.
---

# Gitmoji Commit Messages

**Scope: pact-web only.** This convention applies to this repository and nowhere else - in any other repo, write plain subjects with no emoji, even if that repo's history contains stray gitmoji commits.

This repo uses [gitmoji](https://gitmoji.dev/) emoji prefixes on commit subjects. One emoji, then a single space, then a lowercase imperative subject. No conventional-commits scope (`feat:`, `fix:`) — the emoji replaces it.

## Format

```
<emoji> <imperative subject under ~72 chars>

<optional body explaining why, wrapped at ~80>
```

- **Emoji as a glyph** (`✨`), not as a code (`:sparkles:`). Glyphs render correctly in `git log`, GitHub, and Linear.
- **Imperative mood**: "add", "fix", "remove" — never "added" / "adds" / "adding".
- **No trailing period** on the subject.
- **One emoji** per commit. If the change spans concerns, split the commit.
- **Body explains _why_**, not _what_. The diff already shows what.

## Picking the right emoji

Pick from this short list first — these cover ~95% of commits in this repo:

| Emoji | Code | When to use |
| --- | --- | --- |
| ✨ | `:sparkles:` | Introduce a new user-visible feature or capability |
| 🐛 | `:bug:` | Fix a bug |
| ♻️ | `:recycle:` | Refactor — same behaviour, cleaner code |
| 🎨 | `:art:` | Improve code structure / formatting (no behaviour change) |
| ⚡️ | `:zap:` | Improve performance |
| 🔥 | `:fire:` | Remove code or files |
| 📝 | `:memo:` | Add or update documentation (READMEs, AGENTS.md, comments-as-docs) |
| 📚 | `:books:` | Update broader docs / skills / agent guidance |
| ✅ | `:white_check_mark:` | Add or update tests (unit or E2E) |
| 🔒 | `:lock:` | Fix a security issue or harden security |
| 🛂 | `:passport_control:` | Auth / authorization / sessions / permissions changes |
| 🚧 | `:construction:` | Work in progress — only on feature branches, never on `main` |
| 💄 | `:lipstick:` | UI / styling changes (Tailwind, shadcn tweaks) |
| ♿️ | `:wheelchair:` | Accessibility improvements |
| 🏗️ | `:building_construction:` | Architectural change (module boundaries, folder layout) |
| 🔧 | `:wrench:` | Config files (ESLint, Prettier, tsconfig, package.json scripts, env) |
| 👷 | `:construction_worker:` | CI / GitHub Actions / build pipeline |
| 💚 | `:green_heart:` | Fix a failing CI build |
| ⬆️ | `:arrow_up:` | Upgrade dependencies |
| ⬇️ | `:arrow_down:` | Downgrade dependencies |
| 📌 | `:pushpin:` | Pin a dependency to a specific version |
| 🚚 | `:truck:` | Move or rename files / resources |
| 🏷️ | `:label:` | Add or update TypeScript types only |
| 🥅 | `:goal_net:` | Improve error handling / catch errors |
| 💥 | `:boom:` | Introduce a breaking change (call it out in the body) |
| ⏪ | `:rewind:` | Revert a previous change |
| ✏️ | `:pencil2:` | Fix typos |
| 🩹 | `:adhesive_bandage:` | Quick non-critical fix |
| ⚰️ | `:coffin:` | Remove dead code |
| 🧱 | `:bricks:` | Infrastructure changes |
| 🦺 | `:safety_vest:` | Validation logic (Yup schemas, form validation) |
| 🚸 | `:children_crossing:` | Improve UX / usability |
| 🧑‍💻 | `:technologist:` | Improve developer experience (scripts, tooling, agent skills) |

For anything outside this list, consult [gitmoji.dev](https://gitmoji.dev/).

## Decision rules when several emojis fit

1. **Refactor vs feature** — if behaviour changes, it's ✨; if not, it's ♻️.
2. **Bug vs refactor** — if it fixes incorrect behaviour, it's 🐛 (even if the diff looks like a refactor).
3. **Style vs format** — UI/CSS = 💄; code formatting only = 🎨.
4. **Config vs CI** — files under `.github/` = 👷; everything else config = 🔧.
5. **Auth-adjacent** — anything touching login, sessions, OAuth, tokens, permissions = 🛂; only use 🔒 for security hardening unrelated to auth.
6. **Docs vs skills** — README/inline docs = 📝; `.agents/skills/`, `AGENTS.md`, `CLAUDE.md` = 📚.
7. **When in doubt**, pick the emoji that best describes the **primary intent** of the change, not the largest file in the diff.

## Examples (matching this repo's actual style)

```
✨ implement middleware for session management

Wires the new pact-auth middleware into app/middleware.ts and updates
.gitignore / .prettierignore for generated session files.
```

```
🐛 remove deprecated waitUntilReady option from MSW worker.start()
```

```
♻️ extract Providers component from root layout
```

```
🔒 add Permissions-Policy security header
```

```
📚 add gitmoji skill and resync skill descriptions in AGENTS.md
```

```
🛂 wire pact-auth gRPC client into login and register routes

Routes now mint sessions via pact-auth.StartLogin instead of the local
auth handler. Email + password and OAuth flows are unchanged from the
client's perspective; session cookie name is preserved.
```

```
👷 grant write permissions to sync-develop workflow
```

## Anti-patterns

- ❌ `:sparkles: add login form` — use the rendered glyph `✨`, not the code.
- ❌ `✨ Added login form.` — past tense + trailing period.
- ❌ `✨ 🐛 add login form and fix register bug` — two emojis = two commits.
- ❌ `feat: ✨ add login form` — don't combine conventional-commits prefix with gitmoji; pick one (this repo uses gitmoji).
- ❌ `✨ stuff` — vague subject. Say what was added.
- ❌ Skipping the emoji entirely on `main` — every commit on `main` should have one.

## Workflow

When asked to write a commit message:

1. Run `git diff --staged` (or `git diff` if nothing is staged yet) to see the actual change.
2. Identify the **primary intent** — feature, fix, refactor, etc. Apply the decision rules above.
3. Pick the emoji from the table.
4. Write the subject in lowercase imperative, under ~72 chars, no period.
5. If the _why_ isn't obvious from the subject, add a body wrapped at ~80 chars.
6. Pass the message to `git commit` via a HEREDOC to preserve formatting.
