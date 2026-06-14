import { type LabelCount } from '@/src/app/dashboard/domain/dashboard_pipeline_stats';

export const DashboardBreakdownList = ({
  items,
  barClass = 'bg-primary/60',
  emptyText,
}: {
  items: LabelCount[];
  barClass?: string;
  emptyText?: string;
}) => {
  if (items.length === 0) {
    return emptyText ? (
      <p className="text-xs text-muted-foreground">{emptyText}</p>
    ) : null;
  }

  const max = items[0]?.count ?? 1;

  return (
    <div className="flex flex-col gap-1.5">
      {items.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate font-mono text-muted-foreground">
            {label}
          </span>
          <div className="flex flex-1 items-center gap-2">
            <div
              className={`h-1.5 rounded-full ${barClass}`}
              style={{ width: `${(count / max) * 100}%`, minWidth: '4px' }}
            />
            <span className="tabular-nums text-muted-foreground">{count}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
