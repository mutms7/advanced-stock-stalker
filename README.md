# Advanced Stock Stalker

A dark stock tracker for looking up stocks and ETFs, comparing funds, reading recent news, and keeping a large price chart on screen.

> Research only. This app does not provide personalized financial, tax, or investment advice.

## What The App Can Do

- Search for a stock, ETF, fund, or index by ticker.
- Track a local portfolio with shares, CAD average cost, market value, day move, and unrealized P/L.
- Keep a local watchlist with editable CAD low/high alert bands.
- Review allocation, top underlying holdings, and tracker-level risk flags.
- Show a price chart with time ranges, overlays, volume, and benchmark comparison.
- Make the chart bigger, shrink side panels, or hide panels in the dock.
- Drag panel chips into the Hidden dock and drag them back when needed.
- Resize the list, quick take, and stats areas with sliders.
- Compare ETFs like VOO, VTI, QQQM, VXUS, BND, SCHD, and XEQT with local compare-set persistence.
- Show basic fund details: fee, yield, assets, volatility, sectors, regions, and holdings.
- Pull recent news/search context and make a cautious up/down/sideways quick take.
- Run with mock data locally, then switch to Polygon/Massive, FMP, Alpha Vantage, Brave Search, and OpenAI when keys are configured.

## Tech Included

- Next.js App Router with TypeScript
- Tailwind CSS v4 with shadcn/ui-style primitives
- Dark, finance-focused dashboard UI
- Prisma schema for instruments, watchlists, ETF holdings, news, and assessments
- API routes for instrument search, instrument detail, and AI/news assessment
- Tracker persistence that uses Postgres when `DATABASE_URL` is configured and falls back to browser-local storage when it is not
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

For deployed tracker sync, add a hosted Postgres URL:

```env
DATABASE_URL="postgresql://..."
```

Without `DATABASE_URL`, every browser still gets its own local tracker state.

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

FMP uses the current stable API base (`https://financialmodelingprep.com/stable/`). To test a key directly, use a URL like `https://financialmodelingprep.com/stable/search-symbol?query=AAPL&apikey=YOUR_KEY`.

## Useful Scripts

```powershell
pnpm lint
pnpm typecheck
pnpm build
pnpm prisma:generate
pnpm prisma:migrate
```

## Product Direction

See [docs/stock-tracker-audit.md](docs/stock-tracker-audit.md) for the current gap list and the latest tracker fixes.

The next milestones are:

1. Add authenticated accounts on top of the anonymous tracker snapshot API.
2. Replace mock market data with licensed quote, history, ETF profile, and holdings providers.
3. Add server-side alert jobs, notifications, and live FX.
4. Persist recent news and AI assessments with provider timestamps.
5. Add broker CSV import/export, tax lots, realized gains, dividends received, and cash balances.
