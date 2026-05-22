import { type DB } from '@/mocks/data/dbFactory';
import {
  type Consent,
  type Preferences,
  type Profile,
} from '@/src/__codegen__/rest/account';
import { MOCK_USER_ID } from '@/src/framework/helpers/environment';
import { type MockUserType } from '@/src/framework/helpers/mock_user_type';

const PROFILE_BY_USER_TYPE: Record<MockUserType, { displayName: string; bio: string }> = {
  admin: { displayName: 'Ada Lovelace', bio: 'Platform admin — full policy and audit access.' },
  auditor: { displayName: 'Audrey Ito', bio: 'Auditor — read-only access to decisions and audit trail.' },
  developer: { displayName: 'Dev Patel', bio: 'Developer — test lab and benchmark workflows.' },
};

export const profilePersonaFor = (userType: MockUserType) => PROFILE_BY_USER_TYPE[userType];

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

export const createAccountMockData = (db: DB, userType: MockUserType = 'admin'): void => {
  const persona = PROFILE_BY_USER_TYPE[userType];
  db.accountProfile.create({ displayName: persona.displayName, bio: persona.bio });
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
