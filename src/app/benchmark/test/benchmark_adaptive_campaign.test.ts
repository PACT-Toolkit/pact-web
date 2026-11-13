import { describe, expect, it } from 'vitest';

import {
  formatClassifierScore,
  textOrDash,
} from '@/src/app/benchmark/domain/benchmark_adaptive_attempt';
import {
  ADAPTIVE_ALREADY_RUNNING_MESSAGE,
  ADAPTIVE_OUTCOMES,
  ADAPTIVE_POLL_INTERVAL_MS,
  adaptiveOutcomeLabel,
  adaptiveRefreshInterval,
  campaignProgressPct,
  campaignStatusTone,
  describeRunningCampaign,
  formatAsr,
  formatAsrInterval,
  isCampaignRunning,
  shortCampaignId,
} from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';
import {
  ADAPTIVE_CAMPAIGN_CORPORA,
  adaptiveCampaignPreset,
  DEFAULT_ADAPTIVE_CAMPAIGN_CORPUS,
} from '@/src/app/benchmark/domain/benchmark_adaptive_corpus';
import { describeAdaptiveStartError } from '@/src/app/benchmark/domain/benchmark_adaptive_start_error';

describe('isCampaignRunning', () => {
  it('is true only for running; every other status is terminal', () => {
    expect(isCampaignRunning('running')).toBe(true);
    for (const status of ['done', 'aborted', 'interrupted', 'error', 'x', '']) {
      expect(isCampaignRunning(status)).toBe(false);
    }
    expect(isCampaignRunning(undefined)).toBe(false);
  });
});

describe('adaptiveRefreshInterval', () => {
  it('polls every 5 seconds while running', () => {
    expect(adaptiveRefreshInterval({ status: 'running' })).toBe(5000);
    expect(ADAPTIVE_POLL_INTERVAL_MS).toBe(5000);
  });

  it('stops once terminal, and while nothing is loaded', () => {
    expect(adaptiveRefreshInterval({ status: 'done' })).toBe(0);
    expect(adaptiveRefreshInterval({ status: 'interrupted' })).toBe(0);
    expect(adaptiveRefreshInterval(undefined)).toBe(0);
  });
});

describe('describeRunningCampaign', () => {
  it('names the short id and the goal progress', () => {
    expect(
      describeRunningCampaign({
        id: '3f9c1a52-6d1e-4c1a-9a53-0f4e7b2d8a10',
        goals_done: 2,
        goals_total: 3,
      })
    ).toBe('Campaign 3f9c1a52 is running: 2 of 3 goals.');
    expect(shortCampaignId('abc')).toBe('abc');
  });
});

describe('campaignStatusTone', () => {
  it.each([
    ['running', 'active'],
    ['done', 'success'],
    ['interrupted', 'warning'],
    ['aborted', 'danger'],
    ['error', 'danger'],
    ['something-new', 'warning'],
  ])('maps %s to %s', (status, tone) => {
    expect(campaignStatusTone(status)).toBe(tone);
  });
});

describe('formatting', () => {
  it('formats rates with one decimal and intervals in brackets', () => {
    expect(formatAsr(0.4167)).toBe('41.7%');
    expect(formatAsr(0)).toBe('0.0%');
    expect(formatAsrInterval(0.1523, 0.7)).toBe('[15.2%, 70.0%]');
  });

  it('renders an absent classifier score as "-", never "0"', () => {
    expect(formatClassifierScore(undefined)).toBe('-');
    expect(formatClassifierScore(null)).toBe('-');
    expect(formatClassifierScore(Number.NaN)).toBe('-');
    expect(formatClassifierScore(0)).toBe('0.000');
    expect(formatClassifierScore(0.97)).toBe('0.970');
  });

  it('renders empty optional text as "-"', () => {
    expect(textOrDash('')).toBe('-');
    expect(textOrDash('classifier')).toBe('classifier');
  });
});

describe('campaignProgressPct', () => {
  it('is a bounded whole percent and 0 without goals', () => {
    expect(campaignProgressPct({ goals_done: 1, goals_total: 3 })).toBe(33);
    expect(campaignProgressPct({ goals_done: 3, goals_total: 3 })).toBe(100);
    expect(campaignProgressPct({ goals_done: 5, goals_total: 3 })).toBe(100);
    expect(campaignProgressPct({ goals_done: 0, goals_total: 0 })).toBe(0);
  });
});

describe('outcome labels', () => {
  it('labels all eight outcomes and passes unknown ones through', () => {
    expect(ADAPTIVE_OUTCOMES).toHaveLength(8);
    for (const { key, label } of ADAPTIVE_OUTCOMES) {
      expect(adaptiveOutcomeLabel(key)).toBe(label);
    }
    expect(adaptiveOutcomeLabel('brand_new_outcome')).toBe('brand_new_outcome');
  });
});

describe('corpus and presets', () => {
  it('defaults to the first bundled corpus', () => {
    expect(DEFAULT_ADAPTIVE_CAMPAIGN_CORPUS).toBe(ADAPTIVE_CAMPAIGN_CORPORA[0]);
    expect(ADAPTIVE_CAMPAIGN_CORPORA).toHaveLength(6);
  });

  it('maps presets to goal limits and falls back to the demo', () => {
    expect(adaptiveCampaignPreset('full').goalLimit).toBe(0);
    expect(adaptiveCampaignPreset('demo').goalLimit).toBe(3);
    expect(adaptiveCampaignPreset('unknown').goalLimit).toBe(3);
  });
});

describe('describeAdaptiveStartError', () => {
  it('uses the fixed message for 409', () => {
    expect(describeAdaptiveStartError(409, { error: 'anything' })).toBe(
      ADAPTIVE_ALREADY_RUNNING_MESSAGE
    );
  });

  it('shows the server message for 400', () => {
    expect(
      describeAdaptiveStartError(400, {
        error: 'no attacker configured in this deployment',
      })
    ).toBe('no attacker configured in this deployment');
  });

  it('names the status when the body is not displayable', () => {
    expect(describeAdaptiveStartError(502, undefined)).toBe(
      'The gateway returned an error (HTTP 502).'
    );
  });
});
