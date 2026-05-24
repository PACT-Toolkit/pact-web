const palette: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
  ready: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
  deleted: 'bg-muted text-muted-foreground line-through',
};

export const FilesStatusBadge = ({ status }: { status: string }) => {
  const cls = palette[status] ?? 'bg-muted text-muted-foreground';

  return (
    <span
      className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls}`}
    >
      {status}
    </span>
  );
};
