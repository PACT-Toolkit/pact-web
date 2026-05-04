---
name: handling-rest-challenges
description: "Integrates HTTP 418 challenge flows from REST endpoints using the shared OutOfBandChallengeDialog. Use when adding challenge/approval support to a feature, migrating GraphQL challenges to REST, or debugging challenge flows."
---

# Handling REST Challenges

Pattern for handling user-approval challenges returned by REST/Swagger endpoints in Terra.

## Architecture Overview

When a REST endpoint requires user authentication/approval (e.g., payment creation), it returns **HTTP 418** with a `ChallengeErrorResponse` body containing `challenge.id` and `challenge.provider`. The client opens the shared `OutOfBandChallengeDialog` (from `src/app/out_of_band_challenge`) to poll the `auth-challenge` service until the challenge is approved, declined, or expired.

## Challenge Flow

1. **Client sends mutation** (e.g., POST to create a payment)
2. **Server returns HTTP 418** with body:
   ```json
   {
     "reasonCode": "CHALLENGE_REQUESTED",
     "message": "...",
     "challenge": { "id": "<uuid>", "provider": "out-of-band" }
   }
   ```
3. **Client detects the 418** — Axios treats 418 as valid (not error) via `validateStatus` in `src/framework/network/axios/axios_instance.ts`
4. **Client opens `OutOfBandChallengeDialog`** passing the `challengeId`
5. **Dialog polls `auth-challenge` service** via `useGetOutOfBandChallenge(challengeId)` with SWR `refreshInterval`
6. **User approves/declines** in the Lunar app
7. **Dialog resolves** — calls `onDone({ status })` for terminal states (approved/declined/expired). If the user closes while pending, the dialog **declines the challenge** first (`useDeclineOutOfBandChallenge`), then calls `onCancel()`

## Global Infrastructure (already done — do NOT modify)

### Axios — `src/framework/network/axios/axios_instance.ts`
- `validateStatus` accepts `status === 418` so Axios resolves instead of throwing

### HTTP Proxy — `src/framework/network/proxy/httpProxy.ts`
- `authenticatedHttpProxy` passes through 418 and 422 instead of treating them as errors

### Orval — `orval.config.ts`
- `auth-challenge` service configured as a separate Orval entry
- Generated hooks live in `src/__codegen__/rest/auth-challenge/`

### Schema — `schema/auth-challenge/services.config.yaml`
- Registered with `prefix: true` and `production: true`

## Shared Module: `src/app/out_of_band_challenge/`

```
src/app/out_of_band_challenge/
├── domain/
│   └── status.ts              # TERMINAL_STATUSES, STATUS_TO_VARIANT, ChallengeVariant
├── index.ts                   # Barrel: OutOfBandChallengeDialog, OutOfBandChallengeDialogProps
├── mock/
│   └── handlers/
│       └── out_of_band_challenge.ts  # MSW handlers (registered in mocks/handlers.ts)
└── ui/
    ├── OutOfBandChallengeDialog.tsx          # Polling, decline, lifecycle
    └── OutOfBandChallengeDialogContent.tsx   # Presentational: animation, sections, buttons
```

### Props

```typescript
type OutOfBandChallengeDialogProps = {
  challengeId: string;
  onDone: (args: { status: OutOfBandChallengeStatus }) => void;
  onCancel: () => void;
  actionLabels?: Partial<{
    waiting: string;
    successful: string;
    failed: string;
  }>;
  description?: string;
  pollIntervalMs?: number;  // Default: 1000ms
};
```

### Status mapping (`domain/status.ts`)

```typescript
import { OutOfBandChallengeStatus } from '@/src/__codegen__/rest/auth-challenge/types';

export const TERMINAL_STATUSES: Array<OutOfBandChallengeStatus> = [
  OutOfBandChallengeStatus.approved,
  OutOfBandChallengeStatus.declined,
  OutOfBandChallengeStatus.expired,
];

export type ChallengeVariant = 'waiting' | 'successful' | 'failed';

export const STATUS_TO_VARIANT: Record<OutOfBandChallengeStatus, ChallengeVariant> = {
  [OutOfBandChallengeStatus.approved]: 'successful',
  [OutOfBandChallengeStatus.created]: 'waiting',
  [OutOfBandChallengeStatus.awaiting_challenge_completed]: 'waiting',
  [OutOfBandChallengeStatus.declined]: 'failed',
  [OutOfBandChallengeStatus.expired]: 'failed',
};
```

### ChallengeAnimation — `src/framework/components/challenge_animation/`
- Framework component showing countdown (pending), success lottie, or error lottie
- Used by `OutOfBandChallengeDialogContent`
- Use `getAnimationVariant({ pending, success })` helper

---

## How to Integrate Challenges in a Feature

### Step 1: Detect the 418 challenge response

After a mutation call, check if the response contains a challenge.

> **Orval response shape**: SWR mutation triggers (`trigger()`) return `AxiosResponse<T>`. The actual body is at `response?.data`. For query hooks, `const { data } = useGetX()` gives `AxiosResponse<T> | undefined`, so the payload is at `data?.data`.

```typescript
import { useState } from 'react';
import type { ChallengeErrorResponse } from '@/src/__codegen__/rest/{service}/types';
import { OutOfBandChallengeStatus } from '@/src/__codegen__/rest/auth-challenge/types';

const [challengeId, setChallengeId] = useState<string>();
const [isSubmitting, setIsSubmitting] = useState(false);

// In submit handler:
try {
  setIsSubmitting(true);
  const response = await createPayment(paymentBody);
  const data = response?.data as ChallengeErrorResponse | undefined;

  if (data?.reasonCode === 'CHALLENGE_REQUESTED' && data.challenge?.id) {
    setChallengeId(data.challenge.id);
  } else {
    setIsSubmitting(false);
    methods.reset();  // No challenge needed — success
  }
} catch (error) {
  setIsSubmitting(false);
  warn(error);
}
```

**Key detail**: The 418 response is NOT an error (Axios resolves it). Check `response?.data` for `reasonCode === 'CHALLENGE_REQUESTED'`. Currently only provider `out-of-band` is supported via the shared dialog.

### Step 2: Render the dialog

```tsx
import { OutOfBandChallengeDialog } from '@/src/app/out_of_band_challenge';

{challengeId && (
  <OutOfBandChallengeDialog
    challengeId={challengeId}
    description={t('challenge.waiting.description')}
    onDone={({ status }) => {
      setChallengeId(undefined);
      setIsSubmitting(false);
      if (status === OutOfBandChallengeStatus.approved) {
        methods.reset();
      }
    }}
    onCancel={() => {
      setChallengeId(undefined);
      setIsSubmitting(false);
    }}
  />
)}
```

### Step 3: MSW mock handlers

The `out_of_band_challenge` mock handlers are already registered globally in `mocks/handlers.ts`. For the feature's own BFF mock, return a 418 with challenge body:

```typescript
return HttpResponse.json(
  {
    reasonCode: 'CHALLENGE_REQUESTED',
    message: 'Challenge requested',
    challenge: {
      id:  uuidv4(),
      provider: 'out-of-band',
    },
  },
  { status: 418 }
);
```

The mock handler in `out_of_band_challenge/mock/handlers/` auto-approves after 2 seconds for smooth E2E/demo flow.

### Step 4: Update E2E tests

Use the shared `oob-challenge-*` test IDs (pattern: `oob-challenge-{variant}` and `oob-challenge-{variant}-action`):
- `oob-challenge-waiting` — waiting state
- `oob-challenge-waiting-action` — cancel button (declines the challenge)
- `oob-challenge-successful` — approved state
- `oob-challenge-successful-action` — done button
- `oob-challenge-failed` — declined/expired state
- `oob-challenge-failed-action` — close button

### Step 5: Handle validation errors (422)

REST APIs return HTTP 422 for validation errors. Unlike 418, these ARE thrown as `AxiosError`:

```typescript
import { AxiosError } from 'axios';
import type { ValidationErrorModel } from '@/src/__codegen__/rest/{service}/types';

try {
  await validateInput(body);
} catch (error) {
  if (error instanceof AxiosError) {
    const validationErrors = (
      error.response?.data as ValidationErrorModel
    )?.validationErrors;

    if (validationErrors?.length) {
      validationErrors.forEach((err) => {
        methods.setError(mapField(err.reasonCode), {
          type: 'manual',
          message: err.displayValidationMessage ?? '',
        });
      });
      return;
    }
  }
}
```

---

## Migration Checklist

When migrating a feature from GraphQL to REST with challenge support:

- [ ] Use `OutOfBandChallengeDialog` — do NOT create feature-specific challenge dialogs
- [ ] Delete the old feature-specific challenge dialog (e.g., `BankgiroChallengeDialog`)
- [ ] Add `challengeId` state to the form component
- [ ] Check mutation response for `reasonCode === 'CHALLENGE_REQUESTED'`
- [ ] Pass feature-specific `description` via the `description` prop
- [ ] Handle `onDone` with status check — only reset form on `approved`
- [ ] Update E2E test selectors from feature-specific to `oob-challenge-*`
- [ ] Feature BFF mock returns 418 with challenge body for action endpoints
- [ ] Feature BFF mock returns 422 with validation errors for validate endpoints
- [ ] Do NOT modify `axios_instance.ts` or `httpProxy.ts` — 418/422 handling is global

## Reference Implementation

| File | Purpose |
|------|---------|
| `src/app/bankgiro/ui/PaymentBankgiroForm.tsx` | Detecting 418, opening the dialog |
| `src/app/out_of_band_challenge/ui/OutOfBandChallengeDialog.tsx` | Shared dialog with polling |
| `src/app/out_of_band_challenge/domain/status.ts` | Status → variant mapping |
| `src/app/bankgiro/mock/handlers/bankgiro.ts` | MSW mock returning 418 + challenge body |
| `src/app/out_of_band_challenge/mock/handlers/out_of_band_challenge.ts` | MSW mock for auth-challenge polling |
| `src/framework/network/axios/axios_instance.ts` | Global 418 handling |
| `src/framework/network/proxy/httpProxy.ts` | Proxy 418/422 passthrough |
