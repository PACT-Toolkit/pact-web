import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { AuditWorkbench } from '@/src/app/audit/ui/AuditWorkbench';

const AUDIT_EVENTS_URL = '*/api/pact/gateway/v1/audit/events';

const renderWorkbench = () =>
  render(
    (
      <SWRTestProvider>
        <AuditWorkbench />
      </SWRTestProvider>
    ) as ReactNode
  );

const recordRequests = () => {
  const urls: URL[] = [];
  server.use(
    http.get(AUDIT_EVENTS_URL, ({ request }) => {
      urls.push(new URL(request.url));

      return HttpResponse.json({ events: [], total: 0 });
    })
  );

  return urls;
};

describe('AuditWorkbench control filter', () => {
  it('is hidden until the pact.decisions topic is selected', () => {
    recordRequests();
    renderWorkbench();

    expect(screen.queryByLabelText('Control id')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('audit-topic-select'), {
      target: { value: 'pact.decisions' },
    });

    expect(screen.getByLabelText('Control id')).toBeInTheDocument();
    expect(screen.getByLabelText('Control framework')).toBeInTheDocument();
  });

  it('forwards controlFramework and controlId only once both are set', async () => {
    const urls = recordRequests();
    renderWorkbench();
    fireEvent.change(screen.getByTestId('audit-topic-select'), {
      target: { value: 'pact.decisions' },
    });

    fireEvent.change(screen.getByLabelText('Control framework'), {
      target: { value: 'owasp_llm_top10' },
    });

    expect(
      await screen.findByText('Set both framework and control id')
    ).toBeInTheDocument();
    for (const url of urls) {
      expect(url.searchParams.has('controlFramework')).toBe(false);
      expect(url.searchParams.has('controlId')).toBe(false);
    }

    fireEvent.change(screen.getByLabelText('Control id'), {
      target: { value: 'LLM01' },
    });

    await waitFor(() => {
      const last = urls.at(-1);
      expect(last?.searchParams.get('controlFramework')).toBe(
        'owasp_llm_top10'
      );
      expect(last?.searchParams.get('controlId')).toBe('LLM01');
    });
    expect(
      screen.queryByText('Set both framework and control id')
    ).not.toBeInTheDocument();
  });
});
