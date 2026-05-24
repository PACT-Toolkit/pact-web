import { Card, CardContent } from '@/src/components/ui/card';

export const FilterStatCard = ({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) => (
  <Card>
    <CardContent className="flex flex-col gap-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${valueClass ?? ''}`}>
        {value}
      </p>
    </CardContent>
  </Card>
);
