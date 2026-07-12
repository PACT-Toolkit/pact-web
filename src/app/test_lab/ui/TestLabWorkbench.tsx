'use client';

import { useState } from 'react';

import { STATIC_CHIPS } from '@/src/app/test_lab/domain/test_lab_check';
import { useSaveToCorpus } from '@/src/app/test_lab/domain/use_save_to_corpus';
import { useTestLabCorpusExamples } from '@/src/app/test_lab/domain/use_test_lab_corpus_examples';
import { useTestLabRun } from '@/src/app/test_lab/domain/use_test_lab_run';
import { TestLabAttackInput } from '@/src/app/test_lab/ui/TestLabAttackInput';
import { TestLabPipelineCard } from '@/src/app/test_lab/ui/TestLabPipelineCard';
import { TestLabRunHistory } from '@/src/app/test_lab/ui/TestLabRunHistory';
import { type AttackChip } from '@/src/app/test_lab/ui/types';

export const TestLabWorkbench = () => {
  const [inputText, setInputText] = useState('');
  const [attackType, setAttackType] = useState('custom');
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

  const {
    status,
    layers,
    activeIdx,
    result,
    history,
    historySaveError,
    runCheck,
    forceBlockLayer,
  } = useTestLabRun();
  const { saveState, saveToCorpus, resetSaveState } = useSaveToCorpus();
  const { examples: exampleChips, error: exampleChipsError } =
    useTestLabCorpusExamples();

  const chips: AttackChip[] = [...exampleChips, ...STATIC_CHIPS];

  // A fresh run clears the previously-selected layer detail and any prior
  // save-to-corpus state; a bypass-layer re-run (onPassthrough below) leaves
  // both untouched, matching the pre-extraction behavior.
  const handleRun = () => {
    setSelectedLayer(null);
    resetSaveState();
    void runCheck(inputText, attackType);
  };

  return (
    <div className="flex flex-col gap-6">
      <TestLabAttackInput
        inputText={inputText}
        onInputChange={setInputText}
        attackType={attackType}
        chips={chips}
        chipsError={Boolean(exampleChipsError)}
        onChipSelect={(id, example) => {
          setAttackType(id);
          if (example) setInputText(example);
        }}
        status={status}
        onRun={handleRun}
        onFileSelect={(text, type) => {
          setInputText(text);
          setAttackType(type);
        }}
      />

      {status !== 'idle' && (
        <TestLabPipelineCard
          inputText={inputText}
          layers={layers}
          activeIdx={activeIdx}
          selectedLayer={selectedLayer}
          result={
            result
              ? {
                  decision: result.decision,
                  latencyMs: result.latency_ms,
                  reason: result.reason,
                }
              : undefined
          }
          saveState={saveState}
          isRunning={status === 'running'}
          onSelectLayer={setSelectedLayer}
          onForceBlock={forceBlockLayer}
          onPassthrough={(layerId) =>
            void runCheck(inputText, attackType, [layerId])
          }
          onSaveToCorpus={() =>
            void saveToCorpus({ inputText, attackType, result })
          }
        />
      )}

      {historySaveError && (
        <p role="alert" className="text-sm text-destructive">
          Could not save this run to history. The pipeline result above is still
          valid; only the history record failed to persist.
        </p>
      )}

      {history.length > 0 && <TestLabRunHistory history={history} />}
    </div>
  );
};
