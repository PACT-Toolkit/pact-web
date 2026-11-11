import { BenchmarkWorkbench } from '@/src/app/benchmark';
import { PageContainer } from '@/src/components/page-container';

const BenchmarkPage = () => (
  <PageContainer>
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Benchmark</h1>
      <p className="text-sm text-muted-foreground">
        Upload a corpus file and run it against the gateway to measure detection
        rate, false-positive rate, and latency.
      </p>
    </header>
    <BenchmarkWorkbench />
  </PageContainer>
);

export default BenchmarkPage;
