export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-48" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-24 ml-auto" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function SkeletonDeptCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <Skeleton className="h-1.5 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </div>
    </div>
  );
}
