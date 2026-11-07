import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { OAUTH_PROVIDERS } from '@/src/app/auth/domain/oauth_providers';
import { AuthSettingsConnectedAccountsCard } from '@/src/app/auth/ui/settings/AuthSettingsConnectedAccountsCard';

const NO_PROVIDERS_COPY =
  'No sign-in providers are available on this deployment.';

const renderCard = (
  enabledProviders: typeof OAUTH_PROVIDERS,
  identities: Parameters<
    typeof AuthSettingsConnectedAccountsCard
  >[0]['identities'] = []
) =>
  render(
    <SWRTestProvider>
      <AuthSettingsConnectedAccountsCard
        identities={identities}
        enabledProviders={enabledProviders}
        onChanged={() => {}}
      />
    </SWRTestProvider>
  );

describe('AuthSettingsConnectedAccountsCard', () => {
  it('says no providers are available when none are enabled or linked', () => {
    renderCard([]);

    expect(screen.getByText(NO_PROVIDERS_COPY)).toBeInTheDocument();
  });

  it('does not promise login-page buttons', () => {
    renderCard(OAUTH_PROVIDERS);

    expect(screen.queryByText(NO_PROVIDERS_COPY)).not.toBeInTheDocument();
    expect(screen.queryByText(/login page/i)).not.toBeInTheDocument();
  });

  it('keeps the normal description when providers are enabled', () => {
    renderCard(OAUTH_PROVIDERS.slice(0, 1));

    expect(
      screen.getByText('Sign in with a federated identity provider.')
    ).toBeInTheDocument();
  });
});
