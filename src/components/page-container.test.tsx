import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  PAGE_CONTENT_MAX_WIDTH_CLASS,
  PageContainer,
} from '@/src/components/page-container';

describe('PageContainer', () => {
  it('renders its children inside a single div', () => {
    render(
      <PageContainer>
        <h1>Title</h1>
        <p>Body</p>
      </PageContainer>
    );

    const container = screen.getByRole('heading', {
      name: 'Title',
    }).parentElement!;

    expect(container.tagName).toBe('DIV');
    expect(container.children).toHaveLength(2);
    expect(screen.getByText('Body').parentElement).toBe(container);
  });

  it('carries the shared width, centring, padding and default gap', () => {
    render(<PageContainer>content</PageContainer>);

    const container = screen.getByText('content');

    expect(PAGE_CONTENT_MAX_WIDTH_CLASS).toBe('max-w-[96rem]');
    expect(container).toHaveClass(
      PAGE_CONTENT_MAX_WIDTH_CLASS,
      'mx-auto',
      'flex',
      'w-full',
      'flex-col',
      'gap-6',
      'p-8'
    );
  });

  it('lets a caller override the gap and add a row layout without dropping the width', () => {
    render(
      <PageContainer className="gap-8 lg:flex-row">content</PageContainer>
    );

    const container = screen.getByText('content');

    expect(container).toHaveClass('gap-8', 'lg:flex-row');
    expect(container).not.toHaveClass('gap-6');
    expect(container).toHaveClass(PAGE_CONTENT_MAX_WIDTH_CLASS);
  });
});
