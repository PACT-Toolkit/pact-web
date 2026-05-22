import {
  type Consent,
  type Preferences,
  type Profile,
} from '@/src/__codegen__/rest/account';
import { MOCK_USER_ID } from '@/src/framework/helpers/environment';

export { MOCK_USER_ID };

export const mockProfile: Profile = {
  userId: MOCK_USER_ID,
  displayName: 'Ada Lovelace',
  avatarUrl: 'https://i.pravatar.cc/150?u=ada',
  locale: 'en-US',
  timezone: 'Europe/Copenhagen',
  bio: 'Designing analytical engines.',
  // Frozen ISO timestamps so test snapshots are stable. Real responses
  // come from pact-account and reflect the row's actual created_at.
  createdAt: '2025-01-01T08:00:00.000Z',
  updatedAt: '2026-05-13T17:00:00.000Z',
};

export const mockPreferences: Preferences = {
  userId: MOCK_USER_ID,
  // Default new accounts to opted-out of marketing email; the user
  // has to flip both toggles in the settings UI to opt in. Mirrors
  // pact-account's default-row shape.
  marketingEmail: false,
  productEmail: true,
  updatedAt: '2026-05-13T17:00:00.000Z',
};

export const mockConsents: Consent[] = [
  {
    document: 'terms_of_service',
    version: 'tos-2026-05-13',
    granted: true,
    recordedAt: '2025-01-01T08:00:00.000Z',
  },
  {
    document: 'privacy_policy',
    version: 'pp-2026-05-13',
    granted: true,
    recordedAt: '2025-01-01T08:00:00.000Z',
  },
];
