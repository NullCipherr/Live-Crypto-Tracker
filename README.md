# Live Crypto Tracker V2

A real-time crypto dashboard built with React + TypeScript. The app tracks top market-cap assets from CoinGecko with a SaaS-grade UX focused on signal, clarity, and fast monitoring workflows.

## Preview

![Dashboard hero placeholder](./docs/screenshots/dashboard-hero-placeholder.png)
![Coin expanded placeholder](./docs/screenshots/coin-expanded-placeholder.png)
![Mobile view placeholder](./docs/screenshots/mobile-placeholder.png)

> Place your screenshots in `docs/screenshots/` using the filenames above.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- TanStack React Query
- Axios
- Recharts
- Lucide React

## Features

- Dashboard layout with responsive sections and visual hierarchy
- Real-time market fetch from CoinGecko with 60s auto-refresh
- Manual refresh action with fetching indicator
- Dark/light theme with `localStorage` persistence and system fallback
- Search by asset name or symbol
- Sort filters:
  - market cap descending/ascending
  - top gainers
  - top losers
  - alphabetical
- Watchlist with local persistence and quick `Favorites Only` filtering
- Top Movers panel:
  - highest gain
  - biggest drop
  - best momentum
- Market Overview panel:
  - average 24h variation
  - combined market cap
  - combined volume
  - positive/negative distribution
- Status panel:
  - API status
  - last update timestamp
  - shown assets count
  - response latency
- Asset rows with rich context:
  - rank, price, 24h move, market cap, volume, trend badge
  - mini sparkline trend
- Expandable detailed panel per coin:
  - refined 7-day area chart
  - high/low 24h
  - volume and rank metrics
  - short project description from CoinGecko (when available)
  - external “View Details” action
- Premium UI states:
  - skeleton loading
  - polished error block with retry
  - refined empty state with reset action

## Project Structure

```txt
src/
  components/
    coins/
      CoinExpandedPanel.tsx
      CoinRow.tsx
      CoinSparkline.tsx
      CoinTable.tsx
    dashboard/
      MarketOverview.tsx
      StatusPanel.tsx
      SummaryStrip.tsx
      TopMovers.tsx
    layout/
      DashboardHeader.tsx
    ui/
      EmptyState.tsx
      ErrorState.tsx
      LoadingSkeleton.tsx
      Surface.tsx
  hooks/
    useCoinDescription.ts
    useCryptoMarket.ts
    useTheme.tsx
    useWatchlist.ts
  lib/
    formatters.ts
    market.ts
  services/
    coingecko.ts
  types/
    crypto.ts
  utils/
    cn.ts
  App.tsx
  index.css
  main.tsx
```

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Run in development

```bash
npm run dev
```

### 3. Build

```bash
npm run build
```

### 4. Preview production build

```bash
npm run preview
```

## Available Scripts

- `npm run dev`: start Vite dev server
- `npm run build`: run TypeScript build + Vite production build
- `npm run preview`: serve the production bundle locally
- `npm run lint`: run ESLint

## Technical Decisions

- React Query handles server-state concerns (cache, refetch, loading/error consistency)
- CoinGecko requests are isolated in `src/services/coingecko.ts` for clean data boundaries
- UI uses reusable surface/state components to keep visuals consistent
- Market calculations and sorting live in pure helpers (`src/lib/market.ts`)
- Formatting is centralized in `src/lib/formatters.ts`
- Theme system is consolidated in one provider/hook (`useTheme`), removing V1 duplication
- Design tokens are CSS variables mapped into Tailwind for predictable theming

## Future Improvements

- Add optional pagination or virtualized rows for larger coin sets
- Add selectable timeframes (24h, 7d, 30d) in charts
- Add pinned comparison mode for multiple assets
- Add keyboard shortcuts and command palette workflow
- Add e2e tests (Playwright) and component tests (Vitest + Testing Library)
