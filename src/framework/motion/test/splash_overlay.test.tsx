import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SplashOverlay } from '@/src/framework/motion/splash_overlay';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams('intro=1'),
}));

vi.mock('@/src/framework/motion/splash_screen', () => ({
  SplashScreen: () => <div data-testid="splash" />,
}));

describe('SplashOverlay', () => {
  it('renders nothing when disabled, even with ?intro=1', () => {
    const { queryByTestId } = render(<SplashOverlay enabled={false} />);

    expect(queryByTestId('splash')).toBeNull();
  });

  it('renders the splash when enabled and ?intro=1 is present', () => {
    const { queryByTestId } = render(<SplashOverlay enabled />);

    expect(queryByTestId('splash')).not.toBeNull();
  });
});
