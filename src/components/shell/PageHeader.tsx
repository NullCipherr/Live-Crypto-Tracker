import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

interface PageHeaderContextValue {
  portalTarget: HTMLDivElement | null;
  setPortalTarget: (el: HTMLDivElement | null) => void;
  activeCount: number;
  registerHeader: () => () => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const [activeCount, setActiveCount] = useState(0);

  const registerHeader = useCallback(() => {
    setActiveCount((c) => c + 1);
    return () => setActiveCount((c) => Math.max(0, c - 1));
  }, []);

  return (
    <PageHeaderContext.Provider
      value={{ portalTarget, setPortalTarget, activeCount, registerHeader }}
    >
      {children}
    </PageHeaderContext.Provider>
  );
}

interface PageHeaderContentProps {
  title?: string;
  leading?: ReactNode;
  subtitle?: string;
  titleAddon?: ReactNode;
  actions?: ReactNode;
}

function PageHeaderContent({ title, leading, subtitle, titleAddon, actions }: PageHeaderContentProps) {
  return (
    <div className="flex h-8 w-full items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {leading}
        {title ? (
          <h1 className="shrink-0 whitespace-nowrap text-xl font-semibold leading-none tracking-tight text-foreground">
            {title}
          </h1>
        ) : null}
        {titleAddon ? (
          <>
            <span className="hidden h-5 w-px shrink-0 bg-border sm:inline-block" aria-hidden="true" />
            <div className="shrink-0">{titleAddon}</div>
          </>
        ) : null}
        {subtitle ? (
          <>
            <span className="hidden h-4 w-px shrink-0 bg-border sm:inline-block" aria-hidden="true" />
            <p className="hidden min-w-0 truncate text-xs text-muted-foreground md:block">
              {subtitle}
            </p>
          </>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs">{actions}</div>
      ) : null}
    </div>
  );
}

export function PageHeaderShell({
  visible = true,
  fallbackTitle,
}: {
  visible?: boolean;
  fallbackTitle?: string;
}) {
  const ctx = useContext(PageHeaderContext);
  const showFallback = Boolean(fallbackTitle) && (ctx?.activeCount ?? 0) === 0;

  return (
    <header
      style={{ viewTransitionName: 'page-header-shell' }}
      className={
        visible
          ? 'flex h-[var(--header-h)] shrink-0 items-center border-b border-border bg-background/95 px-page-pad backdrop-blur lg:px-page-pad-lg'
          : 'hidden'
      }
    >
      <div
        className="w-full"
        style={{ viewTransitionName: 'page-header-content' }}
      >
        <div ref={ctx?.setPortalTarget} className="w-full" />
        {showFallback && fallbackTitle ? <PageHeaderContent title={fallbackTitle} /> : null}
      </div>
    </header>
  );
}

export function PageHeader({ title, leading, subtitle, titleAddon, actions }: PageHeaderContentProps) {
  const ctx = useContext(PageHeaderContext);
  const registerHeader = ctx?.registerHeader;

  useLayoutEffect(() => {
    if (!registerHeader) return;
    return registerHeader();
  }, [registerHeader]);

  const innerContent = (
    <PageHeaderContent
      title={title}
      leading={leading}
      subtitle={subtitle}
      titleAddon={titleAddon}
      actions={actions}
    />
  );

  if (ctx?.portalTarget) {
    return createPortal(innerContent, ctx.portalTarget);
  }

  return (
    <header className="flex h-16 shrink-0 items-center border-b border-border bg-background/95 px-5 backdrop-blur lg:px-6">
      {innerContent}
    </header>
  );
}

interface HeaderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'secondary' | 'primary' | 'toggle';
  active?: boolean;
}

export function HeaderButton({
  variant = 'secondary',
  active = false,
  className,
  type = 'button',
  children,
  ...props
}: HeaderButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-control-sm items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-55',
        variant === 'primary' &&
          'bg-accent font-semibold text-accent-foreground shadow-card hover:brightness-110',
        variant === 'secondary' &&
          'border border-border/90 bg-card text-foreground shadow-card hover:border-accent/45 hover:bg-muted/80',
        variant === 'toggle' &&
          (active
            ? 'border border-accent/70 bg-accent/15 text-accent shadow-card'
            : 'border border-border/90 bg-card text-foreground shadow-card hover:border-accent/45 hover:bg-muted/80'),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function HeaderSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-control-sm rounded-md border border-border/90 bg-card pl-2.5 pr-8 text-xs font-medium text-foreground shadow-card outline-none transition-colors hover:border-accent/45 focus-visible:ring-2 focus-visible:ring-accent/60',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

interface HeaderSegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface HeaderSegmentedProps<T extends string> {
  options: readonly HeaderSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: 'accent' | 'surface';
  mono?: boolean;
  className?: string;
}

export function HeaderSegmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'accent',
  mono = false,
  className,
}: HeaderSegmentedProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex h-control-sm items-center rounded-md border border-border/90 bg-nav p-0.5 shadow-card',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'inline-flex h-full items-center gap-1.5 rounded-xs px-2.5 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              mono && 'font-mono',
              isActive
                ? tone === 'surface'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function HeaderCheckboxPill({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={cn(
        'inline-flex h-control-sm cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs font-medium shadow-card transition-all',
        checked
          ? 'border-accent/70 bg-accent/15 text-accent'
          : 'border-border/90 bg-card text-foreground hover:border-accent/45 hover:bg-muted/80'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-accent"
      />
      <span>{label}</span>
    </label>
  );
}
