import { Surface } from './Surface';

export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Surface key={index} className="p-5">
          <div className="animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-3 w-14 rounded bg-muted" />
              </div>
            </div>
            <div className="mt-4 h-20 rounded-xl bg-muted/70" />
          </div>
        </Surface>
      ))}
    </div>
  );
}
