import { cn } from '@/shared/lib/cn';

/**
 * Base shimmer pulse skeleton element
 */
function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-subtle border border-border/40', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * Table skeleton with configurable rows and column widths
 */
export function TableSkeleton({ rows = 5, cols = 5, className }) {
  return (
    <div className={cn('w-full border border-border rounded-xl bg-surface overflow-hidden shadow-2xs', className)}>
      {/* Table Header placeholder */}
      <div className="bg-surface-subtle border-b border-border p-3.5 flex items-center gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`th-${i}`} className="h-4 flex-1" />
        ))}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`tr-${r}`} className="p-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={`td-${r}-${c}`}
                className={cn('h-4 flex-1', c === 0 && 'max-w-28', c === cols - 1 && 'max-w-24')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * KPI Grid Skeleton matching Dashboard and Reports metric ribbons
 */
export function KpiGridSkeleton({ count = 4, className }) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`kpi-skel-${i}`}
          className="p-4 sm:p-5 rounded-xl border border-border bg-surface shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
