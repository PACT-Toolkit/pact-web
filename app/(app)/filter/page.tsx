import { FilterDecisionsWorkbench } from '@/src/app/filter';
import { PageContainer } from '@/src/components/page-container';

const FilterPage = () => (
  <PageContainer>
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Filter decisions</h1>
      <p className="text-sm text-muted-foreground">
        Live view of pact-filter verdicts. Block counts are aggregated from the
        audit stream.
      </p>
    </header>
    <FilterDecisionsWorkbench />
  </PageContainer>
);

export default FilterPage;
