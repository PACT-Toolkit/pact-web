'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';

import { cn } from '@/src/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
    icon?: React.ComponentType;
  }
>;

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

const useChart = () => {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error('useChart must be used within <ChartContainer />');

  return ctx;
};

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const entries = Object.entries(config).filter(([, c]) => c.color);
  if (!entries.length) return null;

  const css = entries
    .map(([key, c]) => `  --color-${key}: ${c.color};`)
    .join('\n');

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart="${id}"] {\n${css}\n}\n.dark [data-chart="${id}"] {\n${css}\n}`,
      }}
    />
  );
};

const ChartContainer = ({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >['children'];
}) => {
  const uid = React.useId();
  const chartId = `chart-${id ?? uid.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 flex justify-center text-xs',
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
};

// Re-export Tooltip directly — callers supply their own content component
const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

// Simple tooltip content that renders a labelled value list
const ChartTooltipContent = ({
  active,
  payload,
  label,
  className,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  className?: string;
  formatter?: (
    value: number | string,
    name: string | number,
    item: TooltipItem
  ) => React.ReactNode;
}) => {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        'border-border/50 bg-background grid min-w-[8rem] gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className
      )}
    >
      {label && <div className="font-medium">{label}</div>}
      <div className="grid gap-1">
        {payload.map((item, i) => {
          const key = String(item.dataKey ?? item.name ?? '');
          const cfg = config[key];

          return (
            <div key={i} className="flex items-start gap-2">
              {!formatter && (
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: item.color ?? cfg?.color }}
                />
              )}
              {formatter &&
              item.value !== undefined &&
              item.name !== undefined ? (
                formatter(item.value, item.name, item)
              ) : (
                <div className="flex flex-1 items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {cfg?.label ?? item.name}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {item.value}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartStyle,
  useChart,
};
