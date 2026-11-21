import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  iconUrl?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  ariaLabel?: string;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  menuWidth?: number;
}

export function CustomSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = 'Selecionar...',
  searchable,
  className,
  menuWidth,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 220,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const isSearchable = searchable ?? options.length > 8;
  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel ? opt.sublabel.toLowerCase().includes(q) : false)
    );
  }, [options, query]);

  const updateCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const targetWidth = Math.max(menuWidth ?? 220, rect.width);
    const maxLeft = Math.max(8, window.innerWidth - targetWidth - 12);
    const left = Math.min(rect.left, maxLeft);
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedMenuHeight = Math.min(300, options.length * 36 + (isSearchable ? 46 : 12));
    const top =
      spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight
        ? rect.top - estimatedMenuHeight - 6
        : rect.bottom + 6;

    setCoords({ top, left, width: targetWidth });
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const onResizeOrScroll = () => updateCoords();
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);

    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 10);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setQuery('');
          setOpen((prev) => !prev);
        }}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-card/90 px-2.5 text-xs font-medium text-foreground shadow-sm transition-all hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          open && 'border-accent/60 ring-1 ring-accent/30',
          className
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.iconUrl ? (
            <img
              src={selected.iconUrl}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180 text-accent'
          )}
          aria-hidden="true"
        />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={ariaLabel}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: coords.width,
              }}
              className="z-[90] overflow-hidden rounded-xl border border-border/90 bg-card/95 p-1.5 text-xs shadow-2xl backdrop-blur-md"
            >
              {isSearchable ? (
                <div className="relative mb-1.5">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar..."
                    className="h-7 w-full rounded-lg border border-border/80 bg-background/90 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
                  />
                </div>
              ) : null}

              <div className="max-h-60 space-y-0.5 overflow-y-auto pr-0.5">
                {filteredOptions.length === 0 ? (
                  <p className="px-2.5 py-3 text-center text-[11px] text-muted-foreground">
                    Nenhum item encontrado.
                  </p>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                          isSelected
                            ? 'bg-accent/15 font-semibold text-accent'
                            : 'text-foreground hover:bg-muted/70'
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {opt.iconUrl ? (
                            <img
                              src={opt.iconUrl}
                              alt=""
                              className="h-4 w-4 shrink-0 rounded-full object-cover"
                            />
                          ) : null}
                          <span className="truncate">{opt.label}</span>
                          {opt.sublabel ? (
                            <span className="truncate text-[10px] font-normal text-muted-foreground">
                              {opt.sublabel}
                            </span>
                          ) : null}
                        </span>
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
