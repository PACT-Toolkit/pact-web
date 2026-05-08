---
name: grill-me
description: Interview the user about an upcoming task until you have enough understanding to implement it correctly in one shot. Use when the user runs /grill-me, optionally with a Linear issue/project URL or task description. Produces a confirmed spec, then stops — does not implement.
---

# Grill Me

**While this skill is active, do not implement, edit files, or spawn sub-agents.** Your only outputs are questions, the summary, the spec, and the "say go" handshake. Implementation begins only after the user replies "go" to the printed spec — corrections and extra direction along the way are input to the spec, not approval to start coding.

Interview the user relentlessly about the upcoming task until you can implement it without guessing. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, recommend an answer.

**Ask one question per message, then wait for the reply before the next.** A single `AskUserQuestion` call may bundle multiple chip-style sub-questions — that still counts as one message. Never put multiple plain-text questions in one message, and never mix chips with written prose.

Use `AskUserQuestion` for any question with discrete answer options — it renders as chips/checkboxes the user can click. Reserve plain text for genuinely open-ended questions.

**If a question can be answered by exploring the codebase, explore the codebase instead.** Skip questions answerable from the Linear issue/project or obvious convention. Don't ask about pure taste calls — make them and move on. When a recommendation depends on existing code, name the file or symbol you verified — never invent paths.

When a decision involves behavior, probe with a concrete scenario before accepting the answer — a "yes" hides the edge cases.

Once you have enough to implement without guessing, close out:

1. Summarize the key decisions and assumptions, then ask *"anything to correct before I write the spec?"* Loop on corrections until the user explicitly approves.
2. Once approved, print the spec to chat with these sections: Goal · Scope (in/out) · Key decisions · Implementation outline (paths verified; new paths marked "(to be created)").
3. End with *"Spec ready. Say **go** when you want me to start implementing."* and wait.
