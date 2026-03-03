export function CardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="h-3 w-24 bg-navy-700 rounded mb-4" />
      <div className="h-7 w-36 bg-navy-700 rounded mb-2" />
      <div className="h-3 w-20 bg-navy-800 rounded" />
    </div>
  );
}

export function GaugeSkeleton() {
  return (
    <div className="card p-6 flex flex-col items-center animate-pulse">
      <div className="h-3 w-28 bg-navy-700 rounded mb-4" />
      <div className="w-48 h-48 rounded-full border-8 border-navy-800" />
      <div className="flex justify-between w-full mt-4">
        <div className="h-4 w-16 bg-navy-700 rounded" />
        <div className="h-4 w-16 bg-navy-700 rounded" />
        <div className="h-4 w-16 bg-navy-700 rounded" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`card p-6 animate-pulse ${height}`}>
      <div className="h-3 w-32 bg-navy-700 rounded mb-4" />
      <div className="h-full bg-navy-800/50 rounded" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card p-6 animate-pulse space-y-3">
      <div className="h-3 w-32 bg-navy-700 rounded mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 flex-1 bg-navy-800 rounded" />
          <div className="h-4 w-20 bg-navy-800 rounded" />
          <div className="h-4 w-16 bg-navy-700 rounded" />
        </div>
      ))}
    </div>
  );
}
