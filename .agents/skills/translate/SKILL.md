---
name: translate
description: Add or update i18next translations (da/en/no/sv). Use when editing locale files, adding translation keys, updating text in da/en/no/sv, working with i18next, or when asked to 'translate', 'add translations', 'localize', 'i18n', 'missing translation', 'update locales', 'fix wording', or 'change text in all languages'.
---

# Translate

Translate text from English to Danish (da), Norwegian (no), and Swedish (sv).

## When to Use

Use this skill **only for translation** — converting existing English copy to other languages.

- ✅ Translating existing English to da/no/sv
- ✅ Reviewing or fixing translations
- ✅ Syncing translations across all locales

## When NOT to Use

- ❌ Writing new copy from scratch → use `writing-for-smb` instead
- ❌ Deciding what the English should say → use `writing-for-smb` instead

**Workflow:** Write English first with `writing-for-smb`, then translate with this skill.

## Supported Languages

| Code | Language  | Role            |
| ---- | --------- | --------------- |
| en   | English   | Source of truth |
| da   | Danish    | Translation     |
| no   | Norwegian | Translation     |
| sv   | Swedish   | Translation     |

## Workflow

1. **Find locale files** — Check AGENTS.md or search the codebase
2. **Add English first** — English is the source of truth
3. **Translate to all languages** — da, no, sv based on English meaning
4. **Run validation** — Check for codegen, types, or lint scripts

## Translation Rules

### Preserve special syntax

Keep these exactly as they appear in the source:

- **Placeholders:** `{{name}}`, `%@`, `%s`, `{0}`
- **Tags:** `<anchor>`, `<bold>`, `<price>`
- **Date tokens:** `MMMM d, yyyy`
- **Brand names:** Lunar, Visa, MasterCard
- **Technical terms:** IBAN, SWIFT, CVR

### Tone & Style

See `writing-for-smb` skill for full voice guidelines. When translating:

- **Stay concise** — Don't add words; UI space is limited
- **Formal "you"** — Use polite form in Danish/Norwegian/Swedish

Match the English tone for each situation:

| Situation   | English tone         | Translation approach                    |
| ----------- | -------------------- | --------------------------------------- |
| Low stakes  | Warm, can be playful | Keep it light: "Fint!" / "Topp!"        |
| Money moves | Calm, factual        | Neutral, precise — state facts only     |
| Errors      | Helpful, no blame    | Soft phrasing, offer solutions          |
| Warnings    | Direct, clear        | Be clear but not alarming               |
| Security    | Serious, reassuring  | Professional, build trust               |

## Critical: Financial Context

This is a banking app. Always use financial/business meanings.

| English   | Danish     | Norwegian     | Swedish     |
| --------- | ---------- | ------------- | ----------- |
| account   | konto      | konto         | konto       |
| balance   | saldo      | saldo         | saldo       |
| payment   | betaling   | betaling      | betalning   |
| transfer  | overførsel | overføring    | överföring  |
| invoice   | faktura    | faktura       | faktura     |
| statement | kontoudtog | kontoutskrift | kontoutdrag |
| period    | periode    | periode       | period      |
| fee       | gebyr      | gebyr         | avgift      |
| interest  | rente      | rente         | ränta       |

**Never use biological or medical meanings.** When in doubt: "Does this make sense in a banking app?"
