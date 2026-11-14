import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InputTooLargeNotice } from '@/src/framework/decisions/input_too_large_notice';

describe('InputTooLargeNotice', () => {
  it('renders the message as an alert under the given test id', () => {
    render(
      <InputTooLargeNotice
        message="Input too large: 9 bytes, limit 4 bytes"
        testId="probe-too-large"
      />
    );

    const notice = screen.getByTestId('probe-too-large');
    expect(notice).toHaveTextContent('Input too large: 9 bytes, limit 4 bytes');
    expect(screen.getByRole('alert')).toBe(notice);
  });
});
