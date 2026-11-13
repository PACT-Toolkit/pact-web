import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/mocks/data/dbFactory';
import {
  MOCK_ADAPTIVE_GOALS,
  MOCK_ADAPTIVE_REFUSED_CORPUS,
  MOCK_ADAPTIVE_REFUSED_MESSAGE,
  mockAdaptiveCampaign,
  mockAdaptiveGoalBody,
  projectMockAdaptiveCampaign,
} from '@/src/app/benchmark/mock/data/benchmark_adaptive';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const CAMPAIGNS_URL = `${MSW_PACT_BASE}/gateway/v1/benchmark/adaptive-attack/campaigns`;

const DEFAULT_LIST_LIMIT = 20;

const nowSeconds = () => Math.floor(Date.now() / 1000);

// A running campaign advances with the clock; the first read after it ends
// stores the terminal state, so the one-campaign-at-a-time gate lifts.
const readCampaign = (id: string) => {
  const stored = db.adaptiveCampaigns.findFirst((c) => c.id === id);
  if (!stored) return undefined;

  const projected = projectMockAdaptiveCampaign(stored, nowSeconds());
  if (projected.status !== stored.status) {
    db.adaptiveCampaigns.update(
      (c) => c.id === id,
      () => projected
    );
  }

  return projected;
};

const readAllCampaigns = () =>
  db.adaptiveCampaigns
    .getAll()
    .map((c) => c.id)
    .map((id) => readCampaign(id)!)
    .sort((a, b) => b.started_at - a.started_at);

const errorBody = (code: string, error: string) => ({ code, error });

export const handlers: RequestHandler[] = [
  http.get(CAMPAIGNS_URL, ({ request }) => {
    const limit =
      Number(new URL(request.url).searchParams.get('limit')) ||
      DEFAULT_LIST_LIMIT;

    // The list route never carries per-goal summaries.
    return HttpResponse.json({
      campaigns: readAllCampaigns()
        .slice(0, limit)
        .map((c) => ({ ...c, goals: [] })),
    });
  }),

  http.post(CAMPAIGNS_URL, async ({ request }) => {
    const body = (await request.json()) as {
      corpus_name?: string;
      goal_limit?: number;
    };

    if (!body.corpus_name) {
      return HttpResponse.json(
        errorBody('invalid_argument', 'corpus_name is required'),
        { status: 400 }
      );
    }
    if (body.corpus_name === MOCK_ADAPTIVE_REFUSED_CORPUS) {
      return HttpResponse.json(
        errorBody('invalid_argument', MOCK_ADAPTIVE_REFUSED_MESSAGE),
        { status: 400 }
      );
    }
    if (readAllCampaigns().some((c) => c.status === 'running')) {
      return HttpResponse.json(
        errorBody('already_exists', 'a campaign is already running'),
        { status: 409 }
      );
    }

    const goalLimit = body.goal_limit ?? 0;
    const campaign = db.adaptiveCampaigns.create(
      mockAdaptiveCampaign({
        id: uuidv4(),
        corpus_name: body.corpus_name,
        goal_limit: goalLimit,
        goals_total:
          goalLimit > 0
            ? Math.min(goalLimit, MOCK_ADAPTIVE_GOALS.length)
            : MOCK_ADAPTIVE_GOALS.length,
        started_at: nowSeconds(),
      })
    );

    return HttpResponse.json({ campaign_id: campaign.id }, { status: 202 });
  }),

  http.get(`${CAMPAIGNS_URL}/:id`, ({ params }) => {
    const campaign = readCampaign(params.id as string);
    if (!campaign) {
      return HttpResponse.json(errorBody('not_found', 'campaign not found'), {
        status: 404,
      });
    }

    return HttpResponse.json(campaign);
  }),

  http.get(`${CAMPAIGNS_URL}/:id/goals/:goalId`, ({ params }) => {
    const campaign = readCampaign(params.id as string);
    const summary = campaign?.goals.find((g) => g.goal_id === params.goalId);
    if (!summary) {
      return HttpResponse.json(errorBody('not_found', 'goal not found'), {
        status: 404,
      });
    }

    return HttpResponse.json(mockAdaptiveGoalBody(summary));
  }),
];
