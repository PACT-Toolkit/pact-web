'use client';

import { useState } from 'react';

import {
  type BenchmarkAdaptiveCampaignBody,
  useStartAdaptiveCampaign,
} from '@/src/__codegen__/rest/benchmark';
import {
  describeRunningCampaign,
  isCampaignRunning,
} from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';
import {
  ADAPTIVE_CAMPAIGN_CORPORA,
  ADAPTIVE_CAMPAIGN_PRESETS,
  adaptiveCampaignPreset,
  DEFAULT_ADAPTIVE_CAMPAIGN_CORPUS,
  DEFAULT_ADAPTIVE_CAMPAIGN_PRESET_ID,
} from '@/src/app/benchmark/domain/benchmark_adaptive_corpus';
import { describeAdaptiveStartError } from '@/src/app/benchmark/domain/benchmark_adaptive_start_error';
import { BenchmarkSubmitErrorBanner } from '@/src/app/benchmark/ui/BenchmarkSubmitErrorBanner';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/src/components/ui/toggle-group';

interface BenchmarkAdaptiveStartFormProps {
  /** The newest campaign from the list; while it runs, Start is locked. */
  newest: BenchmarkAdaptiveCampaignBody | undefined;
  /** A campaign was accepted (202); the card selects it and starts polling. */
  onStarted: (campaignId: string) => void;
  /** The server refused with 409: refresh the list so the gate shows. */
  onConflict: () => void;
}

export const BenchmarkAdaptiveStartForm = ({
  newest,
  onStarted,
  onConflict,
}: BenchmarkAdaptiveStartFormProps) => {
  const [corpus, setCorpus] = useState<string>(
    DEFAULT_ADAPTIVE_CAMPAIGN_CORPUS
  );
  const [presetId, setPresetId] = useState<string>(
    DEFAULT_ADAPTIVE_CAMPAIGN_PRESET_ID
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { trigger, isMutating } = useStartAdaptiveCampaign();

  const running = newest && isCampaignRunning(newest.status) ? newest : null;

  const handleStart = async () => {
    setErrorMessage(null);
    try {
      // Budget and attacker model are omitted: the server defaults apply.
      const response = await trigger({
        corpus_name: corpus,
        goal_limit: adaptiveCampaignPreset(presetId).goalLimit,
      });
      if (response.status === 202) {
        onStarted(response.data.campaign_id);

        return;
      }
      setErrorMessage(
        describeAdaptiveStartError(response.status, response.data)
      );
      if (response.status === 409) onConflict();
    } catch {
      setErrorMessage(
        'Failed to start the campaign. Is the gateway reachable?'
      );
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="benchmark-adaptive-form">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="benchmark-adaptive-corpus">Corpus</Label>
          <Select value={corpus} onValueChange={setCorpus}>
            <SelectTrigger
              id="benchmark-adaptive-corpus"
              className="w-full"
              data-testid="benchmark-adaptive-corpus"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADAPTIVE_CAMPAIGN_CORPORA.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label id="benchmark-adaptive-preset-label">Preset</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={presetId}
            // A single-type group reports "" when the active item is clicked
            // again; keep the current preset instead of clearing it.
            onValueChange={(value) => value && setPresetId(value)}
            aria-labelledby="benchmark-adaptive-preset-label"
            data-testid="benchmark-adaptive-preset"
          >
            {ADAPTIVE_CAMPAIGN_PRESETS.map((preset) => (
              <ToggleGroupItem key={preset.id} value={preset.id}>
                {preset.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <Button
            type="button"
            onClick={handleStart}
            disabled={running !== null || isMutating}
            data-testid="benchmark-adaptive-start"
          >
            {isMutating ? 'Starting…' : 'Start campaign'}
          </Button>
        </div>
        {running && (
          <p
            className="text-sm text-muted-foreground"
            data-testid="benchmark-adaptive-running-gate"
            aria-live="polite"
          >
            {describeRunningCampaign(running)}
          </p>
        )}
        {errorMessage && <BenchmarkSubmitErrorBanner message={errorMessage} />}
      </div>
    </div>
  );
};
