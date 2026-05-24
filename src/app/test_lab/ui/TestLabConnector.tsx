export const TestLabConnector = ({ active, dim }: { active: boolean; dim: boolean }) => (
  <div className="relative flex h-14 min-w-8 flex-1 items-center">
    <div
      className={`h-0.5 w-full rounded transition-colors duration-500 ${
        dim ? 'bg-border/25' : active ? 'bg-primary/60' : 'bg-border'
      }`}
    />
    <span className="absolute right-0 top-1/2 -translate-y-1/2 select-none text-xs text-border">
      ›
    </span>
    {active && (
      <div
        className="absolute top-1/2 z-10 h-2 w-2 -translate-y-1/2 rounded-full bg-primary"
        style={{ animation: 'flowRight 0.85s linear infinite' }}
      />
    )}
  </div>
);
