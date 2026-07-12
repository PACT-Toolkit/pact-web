'use client';

import { Fragment } from 'react';

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
import { type LayerState, type PipelineResult, type SaveState } from './types';

export const TestLabPipelineCard = ({
  inputText,
  layers,
  activeIdx,
  selectedLayer,
  result,
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
  result?: PipelineResult;
  saveState: SaveState;
  isRunning: boolean;
  onSelectLayer: (id: string | null) => void;
  onForceBlock: (layerId: string) => void;
  onPassthrough: (layerId: string) => void;
  onSaveToCorpus: () => void;
}) => {
  const selectedLayerState = layers.find((l) => l.id === selectedLayer) ?? null;

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
          {layers.map((layer, i) => (
            <Fragment key={layer.id}>
              <TestLabConnector
                active={activeIdx === i}
                dim={
                  i > 0 &&
                  layers[i - 1].decision === 'block' &&
                  !layers[i - 1].bypassed
                }
              />
              <TestLabLayerNode
                layer={layer}
                isActive={activeIdx === i}
                isSelected={selectedLayer === layer.id}
                onSelect={() =>
                  onSelectLayer(selectedLayer === layer.id ? null : layer.id)
                }
              />
            </Fragment>
          ))}
          <TestLabConnector active={false} dim={false} />
          <TestLabResultNode
            decision={result?.decision}
            latency={result?.latencyMs}
            reason={result?.reason}
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
