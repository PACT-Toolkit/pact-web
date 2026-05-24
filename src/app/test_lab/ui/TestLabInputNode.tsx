export const TestLabInputNode = ({ text }: { text: string }) => (
  <div className="flex h-14 w-20 shrink-0 flex-col items-center justify-center gap-1">
    <div className="rounded-full border border-primary/50 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
      input
    </div>
    <span className="line-clamp-1 max-w-full px-1 text-center text-xs text-muted-foreground">
      {text.length > 18 ? `${text.slice(0, 18)}…` : text}
    </span>
  </div>
);
