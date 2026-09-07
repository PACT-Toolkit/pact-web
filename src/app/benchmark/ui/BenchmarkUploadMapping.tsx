import {
  type CorpusColumnMapping,
  type DistinctLabelValuesOutcome,
  type LabelDecision,
} from '@/src/app/benchmark/domain/benchmark_corpus_mapping';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';

interface BenchmarkUploadMappingProps {
  columns: string[];
  mapping: CorpusColumnMapping;
  onTextColumnChange: (column: string) => void;
  onLabelColumnChange: (column: string) => void;
  distinctValues: DistinctLabelValuesOutcome | null;
  valueDecisions: Record<string, LabelDecision>;
  onValueDecisionChange: (value: string, decision: LabelDecision) => void;
}

const DECISION_OPTIONS: { value: LabelDecision; label: string }[] = [
  { value: 'block', label: 'Block' },
  { value: 'allow', label: 'Allow' },
  { value: 'skip', label: 'Skip' },
];

const testIdForValue = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'blank';

export const BenchmarkUploadMapping = ({
  columns,
  mapping,
  onTextColumnChange,
  onLabelColumnChange,
  distinctValues,
  valueDecisions,
  onValueDecisionChange,
}: BenchmarkUploadMappingProps) => (
  <div className="flex flex-col gap-4" data-testid="benchmark-upload-mapping">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="benchmark-upload-mapping-text-column">
          Text column
        </Label>
        <Select
          value={mapping.textColumn ?? ''}
          onValueChange={onTextColumnChange}
        >
          <SelectTrigger
            id="benchmark-upload-mapping-text-column"
            data-testid="benchmark-upload-mapping-text-column"
          >
            <SelectValue placeholder="Select the text column" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((column) => (
              <SelectItem key={column} value={column}>
                {column}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="benchmark-upload-mapping-label-column">
          Label column
        </Label>
        <Select
          value={mapping.labelColumn ?? ''}
          onValueChange={onLabelColumnChange}
        >
          <SelectTrigger
            id="benchmark-upload-mapping-label-column"
            data-testid="benchmark-upload-mapping-label-column"
          >
            <SelectValue placeholder="Select the label column" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((column) => (
              <SelectItem key={column} value={column}>
                {column}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    {distinctValues && !distinctValues.ok && (
      <p
        className="text-xs text-destructive"
        data-testid="benchmark-upload-mapping-error"
      >
        {distinctValues.error}
      </p>
    )}

    {distinctValues?.ok && (
      <div
        className="flex flex-col gap-2"
        data-testid="benchmark-upload-mapping-values"
      >
        <Label>Label values</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {distinctValues.values.map((value) => (
            <div
              key={value}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate text-muted-foreground" title={value}>
                {value.length > 0 ? value : '(blank)'}
              </span>
              <Select
                value={valueDecisions[value] ?? 'skip'}
                onValueChange={(decision) =>
                  onValueDecisionChange(value, decision as LabelDecision)
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label={`Decision for label value ${value || 'blank'}`}
                  data-testid={`benchmark-upload-mapping-value-${testIdForValue(value)}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
