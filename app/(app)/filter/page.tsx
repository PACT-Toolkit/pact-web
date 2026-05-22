'use client';

import { useState } from 'react';

import { FilterDecisionsWorkbench, FilterTestWorkbench } from '@/src/app/filter';

type Tab = 'decisions' | 'test';

const TAB_META: Record<Tab, { label: string; description: string }> = {
  decisions: {
    label: 'Decisions',
    description: 'Live view of pact-filter verdicts. Block counts are aggregated from the audit stream.',
  },
  test: {
    label: 'Test',
    description: 'Manually probe the filter pipeline with prompt payloads and embedded file attacks.',
  },
};

const FilterPage = () => {
  const [tab, setTab] = useState<Tab>('decisions');
  const meta = TAB_META[tab];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Filter</h1>
        <p className="text-sm text-muted-foreground">{meta.description}</p>
      </header>

      {/* Tab bar */}
      <div className="flex border-b">
        {(Object.keys(TAB_META) as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_META[t].label}
          </button>
        ))}
      </div>

      {tab === 'decisions' ? <FilterDecisionsWorkbench /> : <FilterTestWorkbench />}
    </main>
  );
};

export default FilterPage;
