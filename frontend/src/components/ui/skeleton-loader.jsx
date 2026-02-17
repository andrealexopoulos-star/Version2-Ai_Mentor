const SkeletonLine = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
);

const SkeletonCard = () => (
  <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
    <SkeletonLine className="h-4 w-1/3" />
    <SkeletonLine className="h-3 w-2/3" />
    <SkeletonLine className="h-3 w-1/2" />
  </div>
);

const SkeletonTable = ({ rows = 5 }) => (
  <div className="space-y-2">
    <SkeletonLine className="h-10 w-full" />
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonLine key={i} className="h-8 w-full" />
    ))}
  </div>
);

export const PageSkeleton = ({ cards = 3, lines = 4 }) => (
  <div className="space-y-6 animate-in fade-in duration-200" data-testid="page-skeleton">
    <div className="space-y-2">
      <SkeletonLine className="h-8 w-48" />
      <SkeletonLine className="h-4 w-72" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className="h-4" style={{ width: `${85 - i * 10}%` }} />
      ))}
    </div>
  </div>
);

export const SidebarSkeleton = () => (
  <div className="space-y-2 p-3" data-testid="sidebar-skeleton">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2">
        <SkeletonLine className="h-5 w-5 rounded" />
        <SkeletonLine className="h-4 flex-1" />
      </div>
    ))}
  </div>
);

export { SkeletonLine, SkeletonCard, SkeletonTable };
