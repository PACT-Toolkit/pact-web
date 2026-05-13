import { describe, expect, it } from 'vitest';

import {
  PROFILE_FIELD_TO_MASK,
  profileFormSchema,
} from '../domain/account_validation_schema';

describe('profileFormSchema', () => {
  // The valid baseline -- every test customises one field and re-validates
  // so a regression in one rule doesn't mask another.
  const VALID = {
    displayName: 'Ada Lovelace',
    avatarUrl: 'https://cdn.example/avatars/ada.png',
    locale: 'en-US',
    timezone: 'Europe/London',
    bio: 'Designing analytical engines.',
  };

  it('accepts a fully valid payload', async () => {
    await expect(profileFormSchema.validate(VALID)).resolves.toMatchObject(
      VALID
    );
  });

  it('accepts empty optional strings (avatarUrl, locale, timezone, bio)', async () => {
    await expect(
      profileFormSchema.validate({
        ...VALID,
        avatarUrl: '',
        locale: '',
        timezone: '',
        bio: '',
      })
    ).resolves.toBeTruthy();
  });

  it('trims whitespace from displayName', async () => {
    const out = await profileFormSchema.validate({
      ...VALID,
      displayName: '  Ada Lovelace  ',
    });
    expect(out.displayName).toBe('Ada Lovelace');
  });

  it('rejects a non-https avatar URL', async () => {
    await expect(
      profileFormSchema.validate({
        ...VALID,
        avatarUrl: 'http://insecure.example/me.png',
      })
    ).rejects.toThrow(/Avatar URL must start with https/);
  });

  it('rejects a data: URL avatar', async () => {
    await expect(
      profileFormSchema.validate({
        ...VALID,
        avatarUrl: 'data:image/png;base64,AAAA',
      })
    ).rejects.toThrow(/Avatar URL must start with https/);
  });

  it('rejects an over-long display name', async () => {
    await expect(
      profileFormSchema.validate({
        ...VALID,
        displayName: 'a'.repeat(129),
      })
    ).rejects.toThrow(/at most 128/);
  });

  it('rejects an over-long bio', async () => {
    await expect(
      profileFormSchema.validate({
        ...VALID,
        bio: 'a'.repeat(2001),
      })
    ).rejects.toThrow(/at most 2000/);
  });

  it('rejects an over-long timezone', async () => {
    await expect(
      profileFormSchema.validate({
        ...VALID,
        timezone: 'a'.repeat(65),
      })
    ).rejects.toThrow(/IANA name/);
  });
});

describe('PROFILE_FIELD_TO_MASK', () => {
  it('maps every form field to its proto snake_case mask name', () => {
    // The codegen mutation hook serialises into UpdateProfileRequest.update_mask
    // so the strings on the right MUST match the proto field names exactly,
    // or pact-account will reject the request as "invalid mask path".
    expect(PROFILE_FIELD_TO_MASK).toEqual({
      displayName: 'display_name',
      avatarUrl: 'avatar_url',
      locale: 'locale',
      timezone: 'timezone',
      bio: 'bio',
    });
  });
});
