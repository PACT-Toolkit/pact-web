import { TestLabWorkbench } from '@/src/app/test_lab';
import { PageContainer } from '@/src/components/page-container';

const TestLabPage = () => (
  <PageContainer>
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Test lab</h1>
      <p className="text-sm text-muted-foreground">
        Manually probe the filter pipeline with prompt payloads and embedded
        file attacks.
      </p>
    </header>
    <TestLabWorkbench />
  </PageContainer>
);

export default TestLabPage;
