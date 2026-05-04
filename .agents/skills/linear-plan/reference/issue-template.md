## Why
1-2 sentences on user/business motivation — not the solution. If you can't fill this from the conversation, flag it. This is the most important field.

## What (Acceptance Criteria)
- [ ] Observable user behaviour or system outcome
- [ ] Edge/error cases, if applicable

## Boundaries (Non-negotiable)
- Hard constraints on API, dependencies, or architecture
- Security: could a user exploit this to access unauthorized data, bypass limits, or cause harm? yes / no / n/a

## Scope
[ ] Chore/tweak  [ ] Bug fix  [ ] Feature  [ ] Architectural

## State & Data Impact
- Persistent data changes: yes / no
- Migration needed: yes / no
- Affects existing user data: yes / no
- Data classification: PII / financial / content / config / n/a
- Client state changes (store, cache, URL): yes / no

## Open Questions
Genuine ambiguities for the implementing agent to resolve.

## Blockers
Decisions that must be resolved before starting. The planning agent presents these to the user alongside the created issues.

## Blast Radius
- Likely files/areas: agent fills during implementation
- Silent coupling risk: other consumers of this code (e.g., mobile app, external API)
- Shared contracts: API / events / types / design tokens / n/a
- API contract changes: yes / no
- Shared component / design token changes: yes / no

## Done When
- [ ] Tests written: unit / integration / E2E / n/a
- [ ] Docs updated: internal / user-facing / API reference / n/a
- [ ] Feature flagged / not needed
- [ ] Rollback plan: feature flag / migration reversal / not needed
