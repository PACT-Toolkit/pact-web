import { FilterDecisionsWorkbench } from '@/src/app/filter';

const FilterPage = () => (
  <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Filter decisions</h1>
      <p className="text-sm text-muted-foreground">
        Live view of pact-filter verdicts. Block counts are aggregated from the audit stream.
      </p>
    </header>
    <FilterDecisionsWorkbench />
  </main>
);

export default FilterPage;
