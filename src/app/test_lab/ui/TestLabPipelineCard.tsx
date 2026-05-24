'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

import { TestLabConnector } from './TestLabConnector';
import { TestLabInputNode } from './TestLabInputNode';
import { TestLabLayerDetail } from './TestLabLayerDetail';
import { TestLabLayerNode } from './TestLabLayerNode';
import { TestLabResultNode } from './TestLabResultNode';
import { type LayerState, type SaveState } from './types';

export const TestLabPipelineCard = ({
  inputText,
  layers,
  activeIdx,
  selectedLayer,
  resultDecision,
  resultLatencyMs,
  resultReason,
  saveState,
  isRunning,
  onSelectLayer,
  onForceBlock,
  onPassthrough,
  onSaveToCorpus,
}: {
  inputText: string;
  layers: LayerState[];
  activeIdx: number;
  selectedLayer: string | null;
  resultDecision?: 'allow' | 'block';
  resultLatencyMs?: number;
  resultReason?: string;
  saveState: SaveState;
  isRunning: boolean;
  onSelectLayer: (id: string | null) => void;
  onForceBlock: (layerId: string) => void;
  onPassthrough: (layerId: string) => void;
  onSaveToCorpus: () => void;
}) => {
  const selectedLayerState = layers.find(l => l.id === selectedLayer) ?? null;
  const connector1Dim = layers[0].decision === 'block' && !layers[0].bypassed;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pipeline</CardTitle>
        <CardDescription>
          Click a layer to inspect and override its decision.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          <TestLabInputNode text={inputText} />
          <TestLabConnector active={activeIdx === 0} dim={false} />
          <TestLabLayerNode
            layer={layers[0]}
            isActive={activeIdx === 0}
            isSelected={selectedLayer === 'filter'}
            onSelect={() => onSelectLayer(selectedLayer === 'filter' ? null : 'filter')}
          />
          <TestLabConnector active={activeIdx === 1} dim={connector1Dim} />
          <TestLabLayerNode
            layer={layers[1]}
            isActive={activeIdx === 1}
            isSelected={selectedLayer === 'classifier'}
            onSelect={() => onSelectLayer(selectedLayer === 'classifier' ? null : 'classifier')}
          />
          <TestLabConnector active={false} dim={false} />
          <TestLabResultNode
            decision={resultDecision}
            latency={resultLatencyMs}
            reason={resultReason}
            onSave={onSaveToCorpus}
            saveState={saveState}
          />
        </div>

        {selectedLayerState && selectedLayerState.decision !== 'pending' && (
          <TestLabLayerDetail
            layer={selectedLayerState}
            isRunning={isRunning}
            onBlock={() => onForceBlock(selectedLayerState.id)}
            onPassthrough={() => onPassthrough(selectedLayerState.id)}
            onClose={() => onSelectLayer(null)}
          />
        )}
      </CardContent>
    </Card>
  );
};
