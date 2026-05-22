import { type DB } from '@/mocks/data/dbFactory';
import {
  type Consent,
  type Preferences,
  type Profile,
} from '@/src/__codegen__/rest/account';
import { MOCK_USER_ID } from '@/src/framework/helpers/environment';

export { MOCK_USER_ID };

export const mockProfile = (overrides: Partial<Profile>): Profile => ({
  userId: MOCK_USER_ID,
  displayName: 'Ada Lovelace',
  avatarUrl: 'https://i.pravatar.cc/150?u=ada',
  locale: 'en-US',
  timezone: 'Europe/Copenhagen',
  bio: 'Designing analytical engines.',
  createdAt: '2025-01-01T08:00:00.000Z',
  updatedAt: '2026-05-13T17:00:00.000Z',
  ...overrides,
});

export const mockPreferences = (overrides: Partial<Preferences>): Preferences => ({
  userId: MOCK_USER_ID,
  marketingEmail: false,
  productEmail: true,
  updatedAt: '2026-05-13T17:00:00.000Z',
  ...overrides,
});

export const mockConsent = (overrides: Partial<Consent>): Consent => ({
  document: '',
  version: '',
  granted: true,
  recordedAt: '2025-01-01T08:00:00.000Z',
  ...overrides,
});

export const createAccountMockData = (db: DB): void => {
  db.accountProfile.create({});
  db.accountPreferences.create({});
  db.accountConsents.create({
    document: 'terms_of_service',
    version: 'tos-2026-05-13',
    granted: true,
  });
  db.accountConsents.create({
    document: 'privacy_policy',
    version: 'pp-2026-05-13',
    granted: true,
  });
};
