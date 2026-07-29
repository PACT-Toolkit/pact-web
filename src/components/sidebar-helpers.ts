import { type AccountProfileResponse } from '@/src/__codegen__/rest/account';
import { type NavUserData } from '@/src/components/nav-user';
import { computeInitials } from '@/src/lib/initials';

export const buildNavUser = (
  userId: string,
  profile: AccountProfileResponse | undefined,
  isLoading: boolean
): NavUserData => ({
  loading: isLoading && !profile,
  displayName: profile?.displayName?.trim() || 'Member',
  secondary: profile?.locale || undefined,
  avatarUrl: profile?.avatarUrl || undefined,
  initials: computeInitials(profile?.displayName, userId),
});
