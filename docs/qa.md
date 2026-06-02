# QA Foundation

This project now has a Playwright-style smoke and API foundation under `tests/`.
The files are `.mjs` on purpose so the current TypeScript typecheck does not require Playwright before the integrator wires it in.

## Running E2E

The Playwright dependency and package scripts are wired. Install the Chromium browser once on a new machine:

```bash
pnpm exec playwright install chromium
```

Then run the suite:

```bash
pnpm test:e2e
```

By default the Playwright config starts `pnpm dev` at `http://127.0.0.1:3000` with mock market/news/AI behavior:

```bash
NEWS_SEARCH_PROVIDER=mock
OPENAI_API_KEY=
```

To test an already-running app instead:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test --config=tests/playwright.config.mjs
```

To use a different automatic dev-server port:

```bash
PLAYWRIGHT_PORT=3100 pnpm exec playwright test --config=tests/playwright.config.mjs
```

## Coverage

- Search API: default queue, trimmed/case-insensitive matching, and empty results.
- Assessment API: validation failure, not-found handling, and successful cited assessment shape.
- Dashboard smoke: initial render, mock search flow, and assessment request flow.

Playwright traces, screenshots, videos, and the HTML report are written under `.next/` so local QA artifacts stay out of source control.
