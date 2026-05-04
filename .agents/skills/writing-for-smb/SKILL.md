---
name: writing-for-smb
description: User-facing copy for small businesses and entrepreneurs. Use when writing any text customers will see — UI, errors, confirmations, notifications.
---

# Writing for Small Businesses

How we write in-app text for small business owners and entrepreneurs.

Use for **user-facing copy** — UI text, labels, buttons, tooltips, errors, confirmations, empty states, notifications, alerts, banners. Any platform.

For translating existing English to da/no/sv → use `translate` instead.
**Workflow:** Write English first with this skill, then translate with `translate`.

## Our Audience

Busy people running their own business. They don't have time to read.

- **The stakes are personal.** They're personally and legally responsible for their finances. Every transaction represents a relationship with a supplier, employee, or tax authority.
- **They're multitasking.** Handling payroll on a call, checking a balance between meetings. Copy must be scannable and unambiguous at a glance.
- **They're experts in their trade, not banking.** They know plumbing, consulting, or retail — not IBAN formats or accounting terms. Avoid jargon.
- **Banking can be stressful.** They may feel stressed when things go wrong — a failed payment, a low balance, an unexpected fee. Write with empathy.

## Principles

1. **Save their time.** Get to the point. Short sentences.
   - ❌ "In order to proceed with this action, you will need to..."
   - ✅ "To continue, add a phone number"

2. **Build trust.** Be specific. No vague promises. Say what actually happens.
   - ❌ "Your data is secure"
   - ✅ "Your data is encrypted and stored in the EU"

3. **Make it easy.** Simple words. One thing at a time. Say what to do next.
   - ❌ "Configure your notification preferences in settings"
   - ✅ "You can change this in Settings → Notifications"

4. **Sound human.** Write like you'd talk to them. Friendly, not formal. But calm — this is a bank.
   - ❌ "Transaction completed successfully"
   - ✅ "Done. The money is on its way"

## Voice Rules

- **"You"** for the user, **"We"** for Lunar. Never "the user" or "the customer".
- Use active voice: "We processed your payment" not "The payment was processed"
- Use "Select" or "Choose", never "Click"
- No marketing fluff — users are here to work, not be sold to
- No jokes about money or errors
- Sparingly use exclamation points (only for small wins)

### Tone by Stakes

| Situation | Tone | Example |
|-----------|------|---------|
| Low stakes (settings) | Warm, can be playful | "Got it!" |
| Money moving | Calm, factual | "€500 sent to Erik Hansen" |
| Errors | Helpful, no blame | "We couldn't send this. Check the account number." |
| Warnings | Direct, clear | "This can't be undone" |
| Security | Serious, reassuring | "We noticed a login from a new device" |

## Copy Patterns

### Errors: What happened → How to fix → Next step

```
Payment failed
The account number doesn't match the recipient's bank. Check and try again.
[Edit payment]
```

**Avoid repetition.** If a title and description appear together, don't start both with "We couldn't". Use "We couldn't" in the description and a short state-based title:

- ❌ Title: "We couldn't scan the bill" + Description: "We couldn't read the details"
- ✅ Title: "Scan failed" + Description: "We couldn't read the details on your bill. Try again."

**Titles describe the state, not the narrative.** Keep titles short and factual. Save "We couldn't" for descriptions where you explain what happened.

| Element | Style | Example |
|---------|-------|---------|
| Title / heading | State-based, no "We" | "Scan failed", "Account not created", "Payment failed" |
| Description / body | Narrative, use "We" | "We couldn't create your account", "We're having trouble loading this" |

### Warnings: What will happen → Reversible? → Actions

```
Delete this card?
This removes the card permanently. Any subscriptions using it will stop working.
[Cancel] [Delete card]
```

### Confirmations: What happened → Key details

```
Payment sent
€1,250.00 to Erik Hansen
Usually arrives in 1–2 business days
```

### Empty states: What this is → Why it matters → Action

```
No invoices yet
Create your first invoice and get paid faster.
[Create invoice]
```

## Character Limits

| Element | Max |
|---------|-----|
| Headings / titles | 40 chars |
| Button labels | 1–3 words |
| Tooltips | 120 chars |
| Notifications / banners | 2 lines |
| Toast messages | 1 line |

If copy doesn't fit, rewrite shorter — don't truncate.

## Placeholder Logic

Use named variables in curly braces. Never use vague pronouns where a variable belongs.

- ❌ "You sent money to the person"
- ✅ "You sent {amount} to {recipient_name}"
- ✅ "{card_name} ending in {last_four} has been frozen"

## Accessibility

- **Buttons describe the action:** "Pay invoice #450" not "Go" or "Submit"
- **Links describe the destination:** "Go to payment summary" not "Click here"
- **Alt text:** Describe purpose, not visual. "Warning icon" → "Payment failed"
- **Don't rely on color alone:** Pair status colors with text labels

## Money-Specific Rules

| What | How to show it |
|------|----------------|
| **Amount** | Full amount + currency: "€1,250.00" |
| **Recipient** | Name + last 4 digits of account if possible |
| **Timing** | "Now", "Today", or "1–2 business days" |
| **Fees** | Show before confirmation, not after |
| **Reversibility** | Say if it's pending, can be canceled, or final |

### Payment Status

| Status | Example copy |
|--------|--------------|
| **Pending** | "Pending · You can cancel this" |
| **Scheduled** | "Scheduled for Monday, 15 Jan" |
| **Sent** | "Sent · Usually arrives in 1–2 days" |
| **Completed** | "Completed · Arrived 15 Jan" |
| **Failed** | "Failed · Check the account number" |
| **Cancelled** | "Cancelled by you" |
| **Refunded** | "Refunded · €50.00 back in your account" |

Always pair status with context: Pending → can they cancel? Sent → when does it arrive? Failed → why and what next?

## Terminology

| Use this | Not this | When |
|----------|----------|------|
| Account | — | Container for money |
| Balance | — | Amount in an account |
| Transfer | — | Between your own accounts |
| Bank transfer | — | To another bank |
| Payment | — | User-initiated money movement |
| Transaction | — | Line items in activity/history |
| Team member | employee, user, staff | Someone on the account |
| Admin | administrator | Someone with full access |
| Freeze card | — | Temporarily disable (reversible) |
| Block card | — | Permanently disable (needs replacement) |

## Formatting

### Currency

| Currency | Format | Example |
|----------|--------|---------|
| EUR | €amount | €1,250.00 |
| DKK | amount kr. | 1.250,00 kr. |
| NOK | amount kr | 1 250,00 kr |
| SEK | amount kr | 1 250,00 kr |

- Debits: **–€25.00** (minus sign, no space). Credits: no plus sign unless comparing.
- FX rates: "Exchange rate: 1 EUR = 7.45 DKK" — show before confirmation.
- Fees: "Fee: €2.00" or "Fee: up to €5.00" — always before confirmation.

### Numbers, Dates, Capitalization

- Use digits in UI: "3 invoices", "2 team members"
- Ranges: "1–2 business days" (en-dash)
- Dates: "Today, 14:30" or "Monday, 15 Jan" — 24-hour time
- Relative when recent: "2 hours ago", "Yesterday"
- **Sentence case** for everything — only capitalize proper nouns and "Lunar"

### Punctuation

- Oxford comma: yes
- Periods in body text: yes. In buttons/headings: no.
- Periods in bullets: yes for sentences, no for fragments.

## Permissions

- ❌ "Ask your admin" (they might not have one)
- ✅ "Only admins can do this. You can ask Maria (Admin) to help."
- ✅ "You need admin access. Go to Team → Roles to check."

If we know who can help, name them.

## Word Choices

| Instead of | Write |
|------------|-------|
| Initiate | Start |
| Configure | Set up |
| Utilize | Use |
| Proceed | Continue |
| Terminate | End / Stop |
| Insufficient funds | Not enough money in this account |
| Invalid input | Enter a valid [specific thing] |
| Operation failed | Title: "[Thing] failed" · Description: "We couldn't [do thing]. [How to fix.]" |
| Something went wrong | [What went wrong]. Try again. |

## Next Steps in Errors

- **Only suggest "contact support" if the original copy already mentions it.** Don't add support references that weren't there before.
- Prefer actionable next steps the user can do themselves: "Try again", "Check the account number", etc.

## Remember

- They're busy — respect their time.
- They're trusting us with their money — be clear about what happens.
- They might be stressed — keep it calm and helpful.
- This is their business — make them feel in control.
- We're a bank — friendly, but never flippant about money.
