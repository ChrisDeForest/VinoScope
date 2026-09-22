export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-raised rounded ${className}`} data-testid="skeleton" />;
}

export function WineCardSkeleton() {
  return (
    <div className="border border-surface-border rounded overflow-hidden">
      <Skeleton className="w-full h-48" />
      <div className="p-3 flex flex-col gap-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
