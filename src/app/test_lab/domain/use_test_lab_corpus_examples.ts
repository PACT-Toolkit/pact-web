import useSWR from 'swr';

import { type AttackChip } from '@/src/app/test_lab/ui/types';
import { httpClient } from '@/src/framework/http';

// Attack example chips are served by a Next.js-only route
// (app/api/pact/benchmark/v1/corpus/examples/route.ts) that stands in until
// pact-benchmark exposes a real /v1/corpus/examples endpoint (PACT-191). It
// never appears in pact-gateway's OpenAPI contract, so orval has nothing to
// generate a hook from -- this wraps the endpoint in the same
// useSWR + httpClient pattern the generated hooks use internally, with the
// same error-surfacing convention as use_benchmark_corpus_library.ts and
// use_policy_events.ts, so a failed load reads as a real error instead of
// silently rendering an empty chip list.
const CORPUS_EXAMPLES_URL = '/api/pact/benchmark/v1/corpus/examples';

const fetchCorpusExamples = (url: string): Promise<AttackChip[]> =>
  httpClient.get<AttackChip[]>(url).then((r) => r.data);

export function useTestLabCorpusExamples() {
  const { data, error, isLoading } = useSWR<AttackChip[]>(
    CORPUS_EXAMPLES_URL,
    fetchCorpusExamples,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  return {
    examples: data ?? [],
    error,
    isLoading,
  };
}
