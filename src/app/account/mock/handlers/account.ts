import { http, HttpResponse } from 'msw';

import { db } from '@/mocks/data/dbFactory';
import {
  type Consent,
  type Preferences,
  type Profile,
  type RecordConsentRequest,
  type UpdatePreferencesRequest,
  type UpdateProfileRequest,
} from '@/src/__codegen__/rest/account';
import { getMockUserType } from '@/src/framework/helpers/mock_user_type';

import { MOCK_USER_ID, profilePersonaFor } from '../data/profile';

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
  if ('updatedAt' in target) {
    (target as { updatedAt: string }).updatedAt = new Date().toISOString();
  }
};

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

const getProfile = (): Profile => db.accountProfile.findFirst(() => true)!;
const getPreferences = (): Preferences =>
  db.accountPreferences.findFirst(() => true)!;

export const handlers = [
  http.get('*/v1/account/profile', () => {
    // Honor a mock-user-type cookie change without forcing a re-seed.
    // The first GET after a switcher flip overwrites the persona fields
    // in place; subsequent edits (PUT) on top of that persist normally.
    const persona = profilePersonaFor(getMockUserType());
    db.accountProfile.update(
      () => true,
      (p) => ({ ...p, displayName: persona.displayName, bio: persona.bio })
    );

    return HttpResponse.json(getProfile());
  }),

  http.put('*/v1/account/profile', async ({ request }) => {
    const body = (await request.json()) as UpdateProfileRequest;
    const profile = getProfile();
    applyMask(profile, body, body.updateMask ?? [], profileMaskMap);

    return HttpResponse.json(profile);
  }),

  http.get('*/v1/account/preferences', () =>
    HttpResponse.json(getPreferences())
  ),

  http.put('*/v1/account/preferences', async ({ request }) => {
    const body = (await request.json()) as UpdatePreferencesRequest;
    const preferences = getPreferences();
    applyMask(preferences, body, body.updateMask ?? [], preferencesMaskMap);

    return HttpResponse.json(preferences);
  }),

  http.get('*/v1/account/consents', () =>
    HttpResponse.json({ consents: db.accountConsents.getAll() })
  ),

  http.post('*/v1/account/consents', async ({ request }) => {
    const body = (await request.json()) as RecordConsentRequest;
    if (!body.document || !body.version) {
      return HttpResponse.json(
        { error: 'document and version are required' },
        { status: 400 }
      );
    }

    const existing = db.accountConsents.findFirst(
      (c) => c.document === body.document
    );
    const next: Consent = {
      document: body.document,
      version: body.version,
      granted: body.granted,
      recordedAt: new Date().toISOString(),
    };

    if (existing) {
      db.accountConsents.update(
        (c) => c.document === body.document,
        () => next
      );
    } else {
      db.accountConsents.create(next);
    }

    return HttpResponse.json(next, { status: 201 });
  }),

  http.get('*/v1/account/export', () =>
    HttpResponse.json({
      profile: getProfile(),
      preferences: getPreferences(),
      consents: db.accountConsents.getAll(),
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
