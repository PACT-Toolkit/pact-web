'use client';

import { useState } from 'react';

import { campaignOptionLabel } from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';
import { useBenchmarkAdaptiveCampaigns } from '@/src/app/benchmark/domain/use_benchmark_adaptive_campaigns';
import { BenchmarkAdaptiveCampaignView } from '@/src/app/benchmark/ui/BenchmarkAdaptiveCampaignView';
import { BenchmarkAdaptiveStartForm } from '@/src/app/benchmark/ui/BenchmarkAdaptiveStartForm';
import { BenchmarkAdaptiveTranscriptSheet } from '@/src/app/benchmark/ui/BenchmarkAdaptiveTranscriptSheet';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Separator } from '@/src/components/ui/separator';

export const BenchmarkAdaptiveAttackCard = () => {
  const {
    campaigns,
    newest,
    shownId,
    shown,
    isLoading,
    listFailed,
    detailFailed,
    pick,
    revalidateList,
  } = useBenchmarkAdaptiveCampaigns();
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);

  const handleStarted = (campaignId: string) => {
    pick(campaignId);
    void revalidateList();
  };

  return (
    <Card data-testid="benchmark-adaptive-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Adaptive attack</CardTitle>
        <CardDescription>
          An attacker model rewrites blocked prompts against the live gateway.
          One campaign runs at a time.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <BenchmarkAdaptiveStartForm
          newest={newest}
          onStarted={handleStarted}
          onConflict={() => void revalidateList()}
        />

        <Separator />

        {isLoading && campaigns.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : listFailed ? (
          <div className="flex h-24 items-center justify-center text-sm text-destructive">
            Failed to load adaptive attack campaigns.
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            No campaigns yet. Start one above.
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="benchmark-adaptive-campaign">Campaign</Label>
              <Select value={shownId ?? undefined} onValueChange={pick}>
                <SelectTrigger
                  id="benchmark-adaptive-campaign"
                  className="w-full"
                  data-testid="benchmark-adaptive-campaign"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaignOptionLabel(campaign)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {detailFailed ? (
              <div className="flex h-24 items-center justify-center text-sm text-destructive">
                Failed to load this campaign.
              </div>
            ) : shown ? (
              <BenchmarkAdaptiveCampaignView
                campaign={shown}
                onOpenGoal={setOpenGoalId}
              />
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            )}
          </>
        )}
      </CardContent>

      <BenchmarkAdaptiveTranscriptSheet
        campaignId={shownId}
        goalId={openGoalId}
        onClose={() => setOpenGoalId(null)}
      />
    </Card>
  );
};
