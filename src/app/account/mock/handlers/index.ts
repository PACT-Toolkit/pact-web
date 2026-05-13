import { http, HttpResponse } from 'msw';

import {
  type Consent,
  type Preferences,
  type Profile,
  type RecordConsentRequest,
  type UpdatePreferencesRequest,
  type UpdateProfileRequest,
} from '@/src/__codegen__/rest/account';

import {
  MOCK_USER_ID,
  mockConsents,
  mockPreferences,
  mockProfile,
} from '../data/profile';

// All four resources are kept in module-scope mutable state so that a
// browser session in `pnpm run dev:mock` sees its own writes (PUT a
// new display_name, refresh the page, see the new name). The store
// resets on dev-server restart, which is what we want -- the mocks
// are not meant to be a database.
const profileStore: Profile = { ...mockProfile };
const preferencesStore: Preferences = { ...mockPreferences };
const consentsStore: Consent[] = mockConsents.map((c) => ({ ...c }));

// applyMask mirrors pact-account's update_mask semantics: only fields
// listed in `mask` are written to `target`. Implemented here so the
// mock surface matches what the real gateway/backend will accept;
// otherwise UI bugs around mask handling would only show up in
// real-mode and waste a context switch.
const applyMask = <T extends object>(
  target: T,
  patch: Partial<T>,
  mask: string[],
  fieldMap: Record<string, keyof T>
): void => {
  for (const maskField of mask) {
    const key = fieldMap[maskField];
    if (key && key in patch) {
      const value = patch[key];
      if (value !== undefined) {
        target[key] = value;
      }
    }
  }
  // updatedAt is touched by the backend on every successful write,
  // mask or not. Tag it here too so the SPA's "last updated" UI is
  // believable in mock mode.
  if ('updatedAt' in target) {
    (target as { updatedAt: string }).updatedAt = new Date().toISOString();
  }
};

// Mask-name -> TS-property mapping. The mask names mirror the proto
// (snake_case); the TS shapes use camelCase per orval convention.
const profileMaskMap: Record<string, keyof Profile> = {
  display_name: 'displayName',
  avatar_url: 'avatarUrl',
  locale: 'locale',
  timezone: 'timezone',
  bio: 'bio',
};

const preferencesMaskMap: Record<string, keyof Preferences> = {
  marketing_email: 'marketingEmail',
  product_email: 'productEmail',
};

export const handlers = [
  http.get('*/v1/account/profile', () => HttpResponse.json(profileStore)),

  http.put('*/v1/account/profile', async ({ request }) => {
    const body = (await request.json()) as UpdateProfileRequest;
    applyMask(profileStore, body, body.updateMask ?? [], profileMaskMap);

    return HttpResponse.json(profileStore);
  }),

  http.get('*/v1/account/preferences', () =>
    HttpResponse.json(preferencesStore)
  ),

  http.put('*/v1/account/preferences', async ({ request }) => {
    const body = (await request.json()) as UpdatePreferencesRequest;
    applyMask(
      preferencesStore,
      body,
      body.updateMask ?? [],
      preferencesMaskMap
    );

    return HttpResponse.json(preferencesStore);
  }),

  http.get('*/v1/account/consents', () =>
    HttpResponse.json({ consents: consentsStore })
  ),

  http.post('*/v1/account/consents', async ({ request }) => {
    const body = (await request.json()) as RecordConsentRequest;
    if (!body.document || !body.version) {
      return HttpResponse.json(
        { error: 'document and version are required' },
        { status: 400 }
      );
    }
    const next: Consent = {
      document: body.document,
      version: body.version,
      granted: body.granted,
      recordedAt: new Date().toISOString(),
    };
    // Replace the latest entry per document, mirroring pact-account's
    // "latest per document" surface.
    const idx = consentsStore.findIndex((c) => c.document === next.document);
    if (idx >= 0) {
      consentsStore[idx] = next;
    } else {
      consentsStore.push(next);
    }

    return HttpResponse.json(next, { status: 201 });
  }),

  http.get('*/v1/account/export', () =>
    HttpResponse.json({
      profile: profileStore,
      preferences: preferencesStore,
      consents: consentsStore,
      exportedAt: new Date().toISOString(),
      userId: MOCK_USER_ID,
    })
  ),

  http.post('*/v1/account/erasure', () =>
    HttpResponse.json(
      { requestedAt: new Date().toISOString() },
      { status: 202 }
    )
  ),
];
