import { cn } from '../../utils/cn';

interface LctLogoProps {
  className?: string;
}

export function LctLogo({ className }: LctLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('h-6 w-6 shrink-0', className)}
    >
      <rect width="24" height="24" rx="5.5" fill="hsl(var(--accent))" />
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx="5"
        stroke="hsl(var(--accent-foreground))"
        strokeOpacity="0.18"
      />
      <rect
        x="5"
        y="16"
        width="2.2"
        height="3.5"
        rx="0.8"
        fill="hsl(var(--accent-foreground))"
        fillOpacity="0.32"
      />
      <rect
        x="9"
        y="14"
        width="2.2"
        height="5.5"
        rx="0.8"
        fill="hsl(var(--accent-foreground))"
        fillOpacity="0.32"
      />
      <rect
        x="13"
        y="15"
        width="2.2"
        height="4.5"
        rx="0.8"
        fill="hsl(var(--accent-foreground))"
        fillOpacity="0.32"
      />
      <rect
        x="17"
        y="12"
        width="2.2"
        height="7.5"
        rx="0.8"
        fill="hsl(var(--accent-foreground))"
        fillOpacity="0.32"
      />
      <path
        d="M5 13.5L9.5 9.5L13.2 11.8L18.5 6"
        stroke="hsl(var(--accent-foreground))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="18.5"
        cy="6"
        r="2"
        fill="hsl(var(--positive))"
        stroke="hsl(var(--accent))"
        strokeWidth="0.75"
      />
    </svg>
  );
}
