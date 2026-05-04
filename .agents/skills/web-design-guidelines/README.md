# Web Design Guidelines Skill

## Why We Pin

This skill dynamically fetches content from an external GitHub repository and
injects it into the agent's prompt context. Fetching from `main` means any
upstream push — accidental or malicious — immediately affects our tooling.

Pinning to a specific commit hash gives us:

- **Deterministic behavior** — same results today and in 6 months
- **Reproducible audits** — every team member gets the same rules
- **Supply chain protection** — upstream changes require explicit opt-in
- **Clear upgrade control** — changes go through PR review

Think of it as `eslint@8.47.0` instead of `eslint@latest`.

## Current Pinned Version

| Field  | Value                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Commit | `3f6b1449dee158479deb8019f6372ff85e663406`                                                                                |
| Date   | 2026-01-22                                                                                                                |
| Link   | [View on GitHub](https://github.com/vercel-labs/web-interface-guidelines/commit/3f6b1449dee158479deb8019f6372ff85e663406) |
| Source | [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)                           |

## Checking for Updates

Check if `command.md` (the rules file we actually fetch) has changed:

```bash
curl -s "https://api.github.com/repos/vercel-labs/web-interface-guidelines/commits?path=command.md&per_page=1" | jq -r '.[0].sha'
```

> **Note:** Not every repo commit changes `command.md`. The query above filters by
> file path so you only see commits that actually modified the rules.

Compare the current pin against the latest:

```
https://github.com/vercel-labs/web-interface-guidelines/compare/3f6b1449dee158479deb8019f6372ff85e663406...main
```

## Upgrade Process

1. Run the check command above — if the hash matches the current pin, there's nothing to do
2. Open the compare URL and **review all changes to `command.md`** — this is the file that gets injected into agent prompts
3. In `SKILL.md`, update:
   - The `pinned-commit` field in frontmatter
   - The `pinned-date` field in frontmatter
   - The commit hash in the fetch URL
4. In this `README.md`, update:
   - The "Current Pinned Version" table
   - The compare URL in "Checking for Updates"
   - Add an entry to the Changelog below
5. Commit and open a PR — the diff shows exactly what changed

## Changelog

| Date       | Commit (short) | Description                                                               |
| ---------- | -------------- | ------------------------------------------------------------------------- |
| 2026-02-12 | `3f6b144`      | Initial pin. Rules (`command.md`) last changed at `30abf89` (2026-01-12). |
