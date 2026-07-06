import { BenchmarkWorkbench } from '@/src/app/benchmark';

const BenchmarkPage = () => (
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Benchmark</h1>
      <p className="text-sm text-muted-foreground">
        Upload a corpus file and run it against the gateway to measure detection
        rate, false-positive rate, and latency.
      </p>
    </header>
    <BenchmarkWorkbench />
  </div>
);

export default BenchmarkPage;
