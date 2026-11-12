import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DateRangeFilter } from '@/src/framework/components/date_range_filter';

const renderFilter = (
  over: Partial<Parameters<typeof DateRangeFilter>[0]> = {}
) => {
  const onSinceChange = vi.fn();
  const onUntilChange = vi.fn();
  render(
    <DateRangeFilter
      since=""
      until=""
      onSinceChange={onSinceChange}
      onUntilChange={onUntilChange}
      {...over}
    />
  );

  return { onSinceChange, onUntilChange };
};

describe('DateRangeFilter', () => {
  it('labels both inputs the same way, Since before Until', () => {
    renderFilter();

    const inputs = screen.getAllByLabelText(/^(Since|Until)$/);
    expect(inputs.map((i) => i.getAttribute('aria-label'))).toEqual([
      'Since',
      'Until',
    ]);
    inputs.forEach((i) => expect(i).toHaveAttribute('type', 'datetime-local'));
    expect(screen.getAllByText(/^(Since|Until)$/)).toHaveLength(2);
  });

  it('reports each change on its own handler', () => {
    const { onSinceChange, onUntilChange } = renderFilter();

    fireEvent.change(screen.getByLabelText('Since'), {
      target: { value: '2026-11-01T08:00' },
    });
    fireEvent.change(screen.getByLabelText('Until'), {
      target: { value: '2026-11-02T08:00' },
    });

    expect(onSinceChange).toHaveBeenCalledExactlyOnceWith('2026-11-01T08:00');
    expect(onUntilChange).toHaveBeenCalledExactlyOnceWith('2026-11-02T08:00');
  });

  it('shows the controlled values and applies the optional test ids', () => {
    renderFilter({
      since: '2026-11-01T08:00',
      until: '2026-11-02T08:00',
      sinceTestId: 'range-since',
      untilTestId: 'range-until',
    });

    expect(screen.getByTestId('range-since')).toHaveValue('2026-11-01T08:00');
    expect(screen.getByTestId('range-until')).toHaveValue('2026-11-02T08:00');
  });
});
