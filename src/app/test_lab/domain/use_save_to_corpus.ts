import { useCallback, useState } from 'react';

import { useSaveBenchmarkCorpusEntry } from '@/src/__codegen__/rest/benchmark';
import {
  type CheckResponse,
  type SaveCorpusPayload,
} from '@/src/app/test_lab/domain/test_lab_check';
import { type SaveState } from '@/src/app/test_lab/ui/types';

export interface SaveToCorpusArgs {
  inputText: string;
  attackType: string;
  result: CheckResponse | null;
}

// useSaveToCorpus owns the "Save to corpus" trigger and its idle/saving/
// saved/error state. Shared between TestLabWorkbench (full pipeline result)
// and DashboardQuickProbe (quick-probe result) -- dashboard -> test_lab is a
// grandfathered cross-feature import pair (see AGENTS.md), so consuming this
// hook from the dashboard feature does not add a new boundary edge.
export function useSaveToCorpus() {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const { trigger: saveCorpusEntry } = useSaveBenchmarkCorpusEntry();

  const saveToCorpus = useCallback(
    async ({ inputText, attackType, result }: SaveToCorpusArgs) => {
      if (!result || !inputText.trim()) return;
      setSaveState('saving');
      try {
        const payload: SaveCorpusPayload = {
          content: inputText,
          attack_type: attackType,
          reason: result.reason,
          filter_rule_id: result.filter_rule_id,
        };
        const response = await saveCorpusEntry(payload);
        if (response.status !== 201) {
          throw new Error(`save to corpus failed (${response.status})`);
        }
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    },
    [saveCorpusEntry]
  );

  const resetSaveState = useCallback(() => setSaveState('idle'), []);

  return { saveState, saveToCorpus, resetSaveState };
}
