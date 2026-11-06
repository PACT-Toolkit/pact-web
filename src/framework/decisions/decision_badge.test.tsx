import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DecisionBadge } from '@/src/framework/decisions/decision_badge';

describe('DecisionBadge', () => {
  it('renders canceled as its own muted badge, not as allow', () => {
    render(<DecisionBadge decision="canceled" />);

    const badge = screen.getByText('Canceled');
    expect(badge).toHaveAttribute('data-decision', 'canceled');
    expect(badge.className).toContain('text-muted-foreground');
    expect(badge.className).not.toContain('green');
  });

  it('keeps allow green and block destructive', () => {
    render(
      <>
        <DecisionBadge decision="allow" />
        <DecisionBadge decision="block" />
      </>
    );

    expect(screen.getByText('Allow').className).toContain('green');
    expect(screen.getByText('Block').className).toContain('destructive');
  });

  it('renders an unknown outcome verbatim and neutral', () => {
    render(<DecisionBadge decision="mystery" />);

    const badge = screen.getByText('mystery');
    expect(badge).toHaveAttribute('data-decision', 'unknown');
    expect(badge.className).not.toContain('green');
  });

  it('uppercases on request', () => {
    render(<DecisionBadge decision="canceled" uppercase />);

    expect(screen.getByText('CANCELED')).toBeInTheDocument();
  });
});
