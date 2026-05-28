import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { type BenchmarkJobState } from '@/src/app/benchmark/domain/benchmark_job';
import { MOCK_ROWS, TOTAL_ROWS } from '@/src/app/benchmark/mock/data/benchmark';
import { MSW_PACT_BASE } from '@/src/framework/msw';

interface MockJob extends BenchmarkJobState {
  createdAt: number;
}

const jobs = new Map<string, MockJob>();

const advanceJob = (job: MockJob) => {
  const age = Date.now() - job.createdAt;
  if (job.status === 'queued' && age > 1500) {
    job.status = 'running';
    job.progress_pct = 10;
  }
  if (job.status === 'running') {
    job.progress_pct = Math.min(95, Math.floor((age - 1500) / 100));
    if (age > 8000) {
      job.status = 'done';
      job.progress_pct = 100;
      job.result = {
        detection_rate: 0.93,
        fp_rate: 0.04,
        p50_latency: 18.4,
        p99_latency: 112.7,
        total_rows: TOTAL_ROWS,
        rows: [],
      };
    }
  }
};

export const handlers: RequestHandler[] = [
  http.post(`${MSW_PACT_BASE}/benchmark/v1/jobs`, async () => {
    await new Promise((r) => setTimeout(r, 200));
    const jobId = uuidv4();
    jobs.set(jobId, {
      status: 'queued',
      progress_pct: 0,
      createdAt: Date.now(),
    });

    return HttpResponse.json({ job_id: jobId }, { status: 202 });
  }),

  http.get(
    `${MSW_PACT_BASE}/benchmark/v1/jobs/:jobId`,
    ({ params, request }) => {
      const jobId = params.jobId as string;
      const job = jobs.get(jobId);
      if (!job) {
        return HttpResponse.json({ error: 'job not found' }, { status: 404 });
      }
      advanceJob(job);
      const { createdAt: _omit, ...state } = job;

      if (state.status !== 'done' || !state.result) {
        return HttpResponse.json(state);
      }

      const url = new URL(request.url);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 100);
      const page = MOCK_ROWS.slice(offset, offset + limit);

      return HttpResponse.json({
        ...state,
        result: { ...state.result, rows: page },
      });
    }
  ),
];
