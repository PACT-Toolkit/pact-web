import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { type BenchmarkJobState } from '@/src/app/benchmark/domain/benchmark_job';
import { RUN_ROW_OUTCOMES } from '@/src/app/benchmark/domain/benchmark_run_rows';
import {
  MOCK_AUTH_EXPIRED_JOB_MARKER,
  MOCK_CORPUS_DATASETS,
  MOCK_CORPUS_LIBRARY_TOTAL_ROWS,
  MOCK_HUB_DATASETS,
  MOCK_HUB_GATED_SLUG,
  MOCK_RATE_LIMITED_JOB_MARKER,
  MOCK_RATE_LIMITED_JOB_POLLS,
  MOCK_ROWS,
  MOCK_RUNS,
  MOCK_UNSCORED_ROW_COUNT,
  TOTAL_ROWS,
} from '@/src/app/benchmark/mock/data/benchmark';
import {
  mockRunRows,
  rowMatchesOutcome,
} from '@/src/app/benchmark/mock/data/benchmark_run_rows';
import { MSW_PACT_BASE } from '@/src/framework/msw';

interface MockJob extends BenchmarkJobState {
  createdAt: number;
  /** Count of GET .../jobs/:id requests answered for this job so far
   * (1-indexed once incremented) - compared against
   * `rateLimitedOnPolls` to decide whether this poll should answer
   * HTTP 429. See MOCK_RATE_LIMITED_JOB_MARKER. */
  pollCount: number;
  /** Poll numbers (from `pollCount`) that should answer HTTP 429 instead of
   * the normal advanceJob progression - empty unless the submitted corpus
   * carried MOCK_RATE_LIMITED_JOB_MARKER. */
  rateLimitedOnPolls: number[];
  /** True when the submitted corpus carried MOCK_AUTH_EXPIRED_JOB_MARKER -
   * advanceJob settles this job into `error` / `auth_token_expired` instead
   * of running it to completion. */
  authExpired: boolean;
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
    // A session that expires mid-run settles into `error` partway through
    // instead of reaching `done` - mirrors AuthTokenExpiredError landing
    // after some rows already completed (pact_benchmark/domain/service.py).
    if (job.authExpired && age > 3000) {
      job.status = 'error';
      job.progress_pct = 42;
      job.error = 'auth_token_expired';

      return;
    }
    if (age > 8000) {
      job.status = 'done';
      job.progress_pct = 100;
      job.result = {
        detection_rate: 0.93,
        fp_rate: 0.04,
        p50_latency_ms: 18.4,
        p99_latency_ms: 112.7,
        total_rows: TOTAL_ROWS,
        rows: [],
        // 100 attacks / 100 benign so true_positives/false_positives divide
        // out to exactly the detection/fp rates above (PACT-932's confusion
        // tiles on the live job progress card). throttled: 3 exercises the
        // Throttled tile (PACT-942) on this same card - it's additive on
        // top of attacks/benign/errors, not carved out of them.
        counts: {
          attacks: 100,
          benign: 100,
          errors: 0,
          false_positives: 4,
          true_positives: 93,
          throttled: 3,
          unscored: MOCK_UNSCORED_ROW_COUNT,
        },
      };
    }
  }
};

// PACT-465: the whole schema/benchmark orval group (this bulk-test surface
// included) moved from the direct pact-benchmark proxy
// (${MSW_PACT_BASE}/benchmark/v1/...) onto the gateway edge proxy, mirroring
// schema/filter's baseUrl convention. Bulk-test jobs/runs are unrelated to
// PACT-465's Test Lab corpus/run-history scope but share the same
// pact-gateway swagger tag, so their generated hook URLs moved too -- these
// mock paths follow. The old duplicate corpus-save handler that used to live
// here (returning the pre-PACT-315 {corpus_version} shape) was dead code --
// src/app/test_lab/mock/handlers/test_lab.ts's handler always shadowed it --
// and is dropped rather than moved.
export const handlers: RequestHandler[] = [
  http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/runs`, ({ request }) => {
    const url = new URL(request.url);
    const since = Number(url.searchParams.get('since_unix') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 200);

    const filtered = since
      ? MOCK_RUNS.filter((r) => r.ran_at >= since)
      : MOCK_RUNS;
    const runs = filtered.slice(0, limit);

    return HttpResponse.json({ runs, total: filtered.length });
  }),

  http.get(
    `${MSW_PACT_BASE}/gateway/v1/benchmark/runs/:runId/rows`,
    ({ params, request }) => {
      const rows = mockRunRows(params.runId as string);
      if (!rows) {
        return HttpResponse.json(
          { code: 'not_found', error: 'run not found' },
          { status: 404 }
        );
      }

      const url = new URL(request.url);
      // 0 or omitted limit = 100, mirroring the real endpoint.
      const limit = Number(url.searchParams.get('limit') ?? 0) || 100;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const category = url.searchParams.get('category');
      const outcome = url.searchParams.get('outcome');

      if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
        return HttpResponse.json(
          {
            code: 'invalid_argument',
            error: 'limit must be between 1 and 5000',
          },
          { status: 400 }
        );
      }
      if (!Number.isInteger(offset) || offset < 0) {
        return HttpResponse.json(
          { code: 'invalid_argument', error: 'offset must not be negative' },
          { status: 400 }
        );
      }
      if (outcome && !RUN_ROW_OUTCOMES.some((o) => o.value === outcome)) {
        return HttpResponse.json(
          { code: 'invalid_argument', error: 'unknown outcome filter' },
          { status: 400 }
        );
      }

      const filtered = rows.filter(
        (row) =>
          (!category || row.category === category) &&
          (!outcome || rowMatchesOutcome(row, outcome))
      );

      return HttpResponse.json({
        rows: filtered.slice(offset, offset + limit),
        total: filtered.length,
      });
    }
  ),

  http.post(
    `${MSW_PACT_BASE}/gateway/v1/benchmark/jobs`,
    async ({ request }) => {
      await new Promise((r) => setTimeout(r, 200));
      const body = (await request.json()) as { corpus_jsonl?: string };
      const jobId = uuidv4();
      jobs.set(jobId, {
        status: 'queued',
        progress_pct: 0,
        createdAt: Date.now(),
        pollCount: 0,
        rateLimitedOnPolls: body.corpus_jsonl?.includes(
          MOCK_RATE_LIMITED_JOB_MARKER
        )
          ? MOCK_RATE_LIMITED_JOB_POLLS
          : [],
        authExpired: Boolean(
          body.corpus_jsonl?.includes(MOCK_AUTH_EXPIRED_JOB_MARKER)
        ),
      });

      return HttpResponse.json({ job_id: jobId }, { status: 202 });
    }
  ),

  http.get(
    `${MSW_PACT_BASE}/gateway/v1/benchmark/jobs/:jobId`,
    ({ params, request }) => {
      const jobId = params.jobId as string;
      const job = jobs.get(jobId);
      if (!job) {
        return HttpResponse.json({ error: 'job not found' }, { status: 404 });
      }
      job.pollCount += 1;
      if (job.rateLimitedOnPolls.includes(job.pollCount)) {
        // Frozen on purpose: a real rate-limit response carries no job state,
        // so the mock must not advance progress on a 429 poll either -
        // that's what the workbench's retention hook is being exercised
        // against.
        return HttpResponse.json(
          { error: 'rate limit exceeded' },
          { status: 429 }
        );
      }
      advanceJob(job);
      const {
        createdAt: _omit,
        pollCount: _omit2,
        rateLimitedOnPolls: _omit3,
        authExpired: _omit4,
        ...state
      } = job;

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

  http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/corpus/library`, () =>
    HttpResponse.json({
      total_rows: MOCK_CORPUS_LIBRARY_TOTAL_ROWS,
      datasets: MOCK_CORPUS_DATASETS,
    })
  ),

  http.get(
    `${MSW_PACT_BASE}/gateway/v1/benchmark/imports/preview`,
    ({ request }) => {
      const url = new URL(request.url);
      const slug = url.searchParams.get('slug') ?? '';
      const labelColumnParam = url.searchParams.get('label_column');

      if (slug === MOCK_HUB_GATED_SLUG) {
        return HttpResponse.json(
          { code: 'permission_denied', error: 'This dataset is gated.' },
          { status: 403 }
        );
      }

      const dataset = MOCK_HUB_DATASETS[slug];
      if (!dataset) {
        return HttpResponse.json(
          { code: 'not_found', error: 'Dataset, config, or split not found.' },
          { status: 404 }
        );
      }

      const labelColumn =
        labelColumnParam && dataset.labelColumns[labelColumnParam]
          ? labelColumnParam
          : dataset.defaultLabelColumn;

      return HttpResponse.json({
        columns: dataset.columns,
        row_count: dataset.rowCount,
        sampled_rows: dataset.sampledRows,
        detected_text_column: dataset.textColumn,
        detected_label_column: labelColumn,
        label_values: labelColumn ? dataset.labelColumns[labelColumn] : [],
        label_values_truncated: false,
        suggested_label_values: labelColumn
          ? (dataset.suggestedLabelValues[labelColumn] ?? {})
          : {},
        suggested_assume_label: labelColumn ? '' : dataset.suggestedAssumeLabel,
      });
    }
  ),

  http.post(
    `${MSW_PACT_BASE}/gateway/v1/benchmark/imports`,
    async ({ request }) => {
      const body = (await request.json()) as {
        slug?: string;
        split?: string;
        config?: string;
        assume_label?: string;
      };
      const slug = body.slug ?? '';

      if (slug === MOCK_HUB_GATED_SLUG) {
        return HttpResponse.json(
          { code: 'permission_denied', error: 'This dataset is gated.' },
          { status: 403 }
        );
      }

      const dataset = MOCK_HUB_DATASETS[slug];
      if (!dataset) {
        return HttpResponse.json(
          { code: 'not_found', error: 'Dataset, config, or split not found.' },
          { status: 404 }
        );
      }

      await new Promise((r) => setTimeout(r, 200));
      const jobId = uuidv4();
      const includedRows =
        dataset.rowCount - dataset.rowsSkipped - dataset.rowsExcludedTrainedOn;
      const assumedBlock = body.assume_label === 'block';
      const assumedAllow = body.assume_label === 'allow';

      jobs.set(jobId, {
        status: 'queued',
        progress_pct: 0,
        createdAt: Date.now(),
        pollCount: 0,
        rateLimitedOnPolls: [],
        authExpired: false,
        hub_import: {
          slug,
          split: body.split || 'train',
          config: body.config ?? '',
          rows_read: dataset.rowCount,
          rows_skipped: dataset.rowsSkipped,
          attack_rows: dataset.defaultLabelColumn
            ? dataset.attackRows
            : assumedBlock
              ? includedRows
              : 0,
          benign_rows: dataset.defaultLabelColumn
            ? dataset.benignRows
            : assumedAllow
              ? includedRows
              : 0,
          screened: dataset.screened,
          rows_excluded_trained_on: dataset.rowsExcludedTrainedOn,
          truncated: false,
        },
      });

      return HttpResponse.json({ job_id: jobId }, { status: 202 });
    }
  ),
];
