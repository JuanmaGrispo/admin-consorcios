import { Skeleton } from '@/components/ui/skeleton';

/** Lo que ve el vecino mientras se valida la sesión y se cargan sus unidades. */
export function EsqueletoVecino() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-40" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-32" />
    </div>
  );
}
