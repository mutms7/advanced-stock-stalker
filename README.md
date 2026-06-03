# Advanced Stock Stalker

A dark stock tracker for looking up stocks and ETFs, comparing funds, reading recent news, and keeping a large price chart on screen.

> Research only. This app does not provide personalized financial, tax, or investment advice.

## What The App Can Do

- Search for a stock, ETF, fund, or index by ticker.
- Show a price chart with time ranges, overlays, volume, and benchmark comparison.
- Make the chart bigger, shrink side panels, or hide panels in the dock.
- Drag panel chips into the Hidden dock and drag them back when needed.
- Resize the list, quick take, and stats areas with sliders.
- Compare ETFs like VOO, VTI, QQQM, VXUS, BND, SCHD, and XEQT.
- Show basic fund details: fee, yield, assets, volatility, sectors, regions, and holdings.
- Pull recent news/search context and make a cautious up/down/sideways quick take.
- Run with mock data locally, then switch to Polygon/Massive, FMP, Alpha Vantage, Brave Search, and OpenAI when keys are configured.

## Tech Included

- Next.js App Router with TypeScript
- Tailwind CSS v4 with shadcn/ui-style primitives
- Dark, finance-focused dashboard UI
- Prisma schema for instruments, watchlists, ETF holdings, news, and assessments
- API routes for instrument search, instrument detail, and AI/news assessment
- Mock-first market and news data so the app runs without paid provider keys
- Environment hooks for OpenAI, Brave Search, Polygon/Massive, FMP, and Alpha Vantage

## Getting Started

```powershell
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env` and fill in provider keys when you are ready to use live services.

```powershell
Copy-Item .env.example .env
```

Local development works with mock providers:

```env
MARKET_DATA_PROVIDER="mock"
NEWS_SEARCH_PROVIDER="mock"
```

For AI assessments:

```env
OPENAI_API_KEY="..."
OPENAI_MODEL="gpt-5.5"
```

For recent news/search:

```env
NEWS_SEARCH_PROVIDER="brave"
BRAVE_SEARCH_API_KEY="..."
```

For long-range historical OHLCV and live quote polling:

```env
MARKET_DATA_PROVIDER="polygon"
POLYGON_API_KEY="..."
```

FMP and Alpha Vantage remain available as REST fallbacks:

```env
MARKET_DATA_PROVIDER="fmp"
FMP_API_KEY="..."

MARKET_DATA_PROVIDER="alpha_vantage"
ALPHA_VANTAGE_API_KEY="..."
```

## Useful Scripts

```powershell
pnpm lint
pnpm typecheck
pnpm build
pnpm prisma:generate
pnpm prisma:migrate
```

## Product Direction

The next milestones are:

1. Add authenticated watchlists and persisted comparison sets.
2. Replace mock market data with licensed quote, history, ETF profile, and holdings providers.
3. Add ETF overlap analysis and benchmark tracking error charts.
4. Persist recent news and AI assessments with provider timestamps.
5. Add Playwright coverage for search, compare, and assessment flows.
