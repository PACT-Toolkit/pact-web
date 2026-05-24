'use client';

import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { exportAccountData } from '@/src/__codegen__/rest/account';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

import { makeExportFilename, triggerDownload } from './helpers';

export const AccountSettingsExportCard = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDownload = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await exportAccountData();
      if (res.status !== 200) {
        throw new Error(`Unexpected status ${res.status}`);
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json',
      });
      triggerDownload(blob, makeExportFilename());
    } catch {
      setError(
        'Could not export your data right now. Please try again in a minute.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" aria-hidden />
          Export your data
        </CardTitle>
        <CardDescription>
          Download everything pact-account holds about you, as JSON. This covers
          your profile, preferences, and consent history. Other PACT services
          own their own exports — request those separately as they come online.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onDownload()}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Preparing download…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" aria-hidden />
                Download JSON
              </>
            )}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
