export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar will go here */}
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
