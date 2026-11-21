import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ChartCardHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
}

export function ChartCardHeader({
  title,
  subtitle,
  right,
  className,
}: ChartCardHeaderProps) {
  return (
    <div
      className={cn(
        'mb-4 flex min-h-[38px] items-start justify-between gap-4 border-b border-border/60 pb-3',
        className
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-[13px] font-semibold leading-snug tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  heightClass?: string;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  right,
  heightClass = 'h-72',
  className,
  children,
}: ChartCardProps) {
  return (
    <section className={cn('rounded-lg border border-border bg-card p-5 shadow-card', className)}>
      <ChartCardHeader title={title} subtitle={subtitle} right={right} />
      <div className={heightClass}>{children}</div>
    </section>
  );
}

export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/70 pb-3">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-0.5 rounded-full bg-accent" aria-hidden="true" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h2>
      </div>
      <p className="pl-2.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
