import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatTile } from '@/src/framework/components/stat_tile';

describe('StatTile', () => {
  it('renders the label and value', () => {
    render(<StatTile label="True positives" value={42} testId="tp-tile" />);

    expect(screen.getByTestId('tp-tile')).toHaveTextContent('True positives');
    expect(screen.getByTestId('tp-tile')).toHaveTextContent('42');
  });

  it('renders a string value verbatim', () => {
    render(<StatTile label="Status" value="Enabled" testId="status-tile" />);

    expect(screen.getByTestId('status-tile')).toHaveTextContent('Enabled');
  });

  it('defaults to the large (headline) value size', () => {
    render(<StatTile label="Rows" value={100} testId="rows-tile" />);

    const value = screen
      .getByTestId('rows-tile')
      .querySelector('[data-slot="stat-tile-value"]');
    expect(value).toHaveClass('text-2xl');
  });

  it('renders the small value size when requested', () => {
    render(
      <StatTile
        label="Sandbox"
        value="Disabled"
        size="sm"
        testId="sandbox-tile"
      />
    );

    const value = screen
      .getByTestId('sandbox-tile')
      .querySelector('[data-slot="stat-tile-value"]');
    expect(value).toHaveClass('text-sm');
    expect(value).not.toHaveClass('text-2xl');
  });

  it('applies an extra value class when given', () => {
    render(
      <StatTile
        label="Errors"
        value={3}
        valueClass="text-destructive"
        testId="errors-tile"
      />
    );

    const value = screen
      .getByTestId('errors-tile')
      .querySelector('[data-slot="stat-tile-value"]');
    expect(value).toHaveClass('text-destructive');
  });

  it('renders secondary text under the value when given', () => {
    render(
      <StatTile
        label="Throttled"
        value={12}
        secondaryText="6.0% of rows"
        testId="throttled-tile"
      />
    );

    expect(screen.getByTestId('throttled-tile')).toHaveTextContent(
      '6.0% of rows'
    );
  });

  it('omits secondary text when not given', () => {
    render(<StatTile label="Rows" value={100} testId="rows-tile" />);

    expect(
      screen.getByTestId('rows-tile').querySelectorAll('span')
    ).toHaveLength(2);
  });
});
