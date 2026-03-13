import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface SurfaceProps {
  children: ReactNode;
  className?: string;
}

export function Surface({ children, className }: SurfaceProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border/70 bg-card/90 backdrop-blur-sm shadow-[0_14px_40px_rgba(11,18,35,0.08)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.35)]',
        className
      )}
    >
      {children}
    </section>
  );
}
