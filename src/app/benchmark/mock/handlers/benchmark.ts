import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { type BenchmarkJobState } from '@/src/app/benchmark/domain/benchmark_job';

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
        total_rows: 200,
      };
    }
  }
};

export const handlers: RequestHandler[] = [
  http.post('*/api/pact/benchmark/v1/jobs', async () => {
    await new Promise((r) => setTimeout(r, 200));
    const jobId = uuidv4();
    jobs.set(jobId, {
      status: 'queued',
      progress_pct: 0,
      createdAt: Date.now(),
    });

    return HttpResponse.json({ job_id: jobId }, { status: 202 });
  }),

  http.get('*/api/pact/benchmark/v1/jobs/:jobId', ({ params }) => {
    const jobId = params.jobId as string;
    const job = jobs.get(jobId);
    if (!job) {
      return HttpResponse.json({ error: 'job not found' }, { status: 404 });
    }
    advanceJob(job);
    const { createdAt: _omit, ...state } = job;

    return HttpResponse.json(state);
  }),
];
