export const DashboardStatTile = ({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-2xl font-semibold tabular-nums ${valueClass ?? ''}`}>
      {value}
    </span>
  </div>
);
