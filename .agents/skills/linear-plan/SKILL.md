---
name: linear-plan
description: Scope and break down a feature into Linear tasks. Use when asked to 'plan a feature', 'scope this', 'break this into tasks', 'create tickets', 'set up a project', 'what's involved', or 'analyze this feature'.
---

# Linear Project Planning

> 📖 Load `linear-tools` skill for label requirements, state rules, and MCP reference.

---

## Step 1: Scope the Feature

Before creating anything, understand the full scope. If the user provided a Figma URL, analyze it now — list every screen, state, and interactive element. Check `matter-web-storybook` MCP for reusable components. If Figma is provided but inaccessible, **STOP** — never invent design details.

1. **Map screens → API operations** — flag missing operations as blockers.
2. **Find reference features** — search the codebase for 1–3 features with similar patterns (check `src/app/`, shared components, hooks, `src/lib/`). Note _why_ they match. If none exist, say so.
3. **Sketch task order** — map the natural dependency graph before creating issues.

---

## Step 2: Gather Requirements (ONE prompt)

Ask everything needed in a single numbered list. Do not ask follow-up rounds.

**Required** (ask if not provided):
1. Team
2. Project (existing name/URL, or propose a new name)
3. Domain label
4. Role label(s)

**Optional** (offer defaults):
5. CIR label (default: `Change`)
6. Granularity — Small (3-5 tasks) / Medium (10-15) / Large (20+) (default: Medium)
7. Figma URL with `?node-id=X:Y` — if none provided, confirm with user this is intentional

Each task should be completable by an agent in a single session without needing to ask clarifying questions.

After user responds, proceed immediately. No follow-ups.

---

## Step 3: Create Project + Tasks

### 3.1 Validate paths first

Before writing any task descriptions, verify file paths with `glob` and `Read`. Never reference paths you haven't confirmed exist. Mark new paths as "(to be created)".

### 3.2 Create or update project with Context Pack

The project description is the Context Pack. Structure:

- **Summary** — 1-3 sentences of user value
- **Links** — Figma (with node-ids), schema, route, reference feature
- **Data Flow** — table of UI Component → Query/Mutation → Key Fields
- **File Structure** — verified paths (✓ = exists, "(to be created)" = new)
- **Task Order** — numbered list of issue identifiers after creation

For existing projects: fetch current description, append new issues to Task Order, preserve existing Learnings, update context sections only where scope changed.

### 3.3 Create issues

Use the template in `reference/issue-template.md` for every issue description. Read it before creating issues.

Include a link to the project and any task-specific Figma node-id or reference path in each issue description — agents may be assigned a single issue without seeing the project context.

Before creating, search the project for issues with similar titles to avoid duplicates on retries.

**Sub-issues**: Only use parent/child when a task has 3+ distinct sub-components that could be worked independently.

### 3.4 Verify

After creating all issues, spot-check 1-2 to confirm labels, state, and project assignment landed correctly.

### 3.5 Milestones

≤3 issues: skip. 4+ issues: create milestones matching the project's natural phases and assign all issues. Don't ask — just decide.

---

## Step 4: Set Dependencies

Set `blockedBy` so an agent can find zero-blocker issues, start there, and see what each completion unlocks. The dependency graph _is_ the execution plan.

- No transitive deps: if A→B→C, only mark C blocked by B
- Most issues should participate in the dependency chain. Parallel work sharing a common prerequisite is fine — not everything needs to unlock something.
- If the template has unresolved Blockers, present them to the user alongside the created issues. Open Questions are for the implementing agent to resolve.
