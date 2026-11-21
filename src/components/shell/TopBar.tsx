import { Menu, Tv } from 'lucide-react';
import { LctLogo } from './LctLogo';

interface TopBarProps {
  showTvMode?: boolean;
  onOpenMobileMenu: () => void;
  onOpenTvMode: () => void;
  onGoHome: () => void;
}

export function TopBar({
  showTvMode = false,
  onOpenMobileMenu,
  onOpenTvMode,
  onGoHome,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-3 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu de navegação"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <LctLogo />
          <span className="text-sm font-semibold tracking-tight text-foreground">LCT</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {showTvMode ? (
          <button
            type="button"
            onClick={onOpenTvMode}
            aria-label="Abrir Modo TV"
            title="Modo TV (rotação em tela cheia)"
            className="inline-flex h-8 min-w-[32px] items-center justify-center gap-1.5 rounded border border-border bg-card px-2 text-xs font-medium text-foreground transition-colors hover:border-accent/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Tv className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            <span>Modo TV</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
