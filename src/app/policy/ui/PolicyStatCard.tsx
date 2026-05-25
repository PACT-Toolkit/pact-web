export const PolicyStatCard = ({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) => (
  <div className="flex flex-col gap-1 rounded-lg border p-4">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-2xl font-semibold tabular-nums ${valueClass ?? ''}`}>
      {value}
    </span>
  </div>
);
