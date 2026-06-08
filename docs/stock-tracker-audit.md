# Stock Tracker Audit

## What Was Making It Weak

1. It was mostly a research dashboard, not a tracker. Search, charts, compare tables, news, and AI summaries existed, but there was no active position tracking.
2. There was no portfolio market value, cost basis, day move, or unrealized P/L.
3. The watch-alert bell in the header was decorative; it did not open or manage alerts.
4. Watchlists existed in the Prisma schema but not in the working app surface.
5. Position data existed nowhere in the app state or schema, so the product could not answer the core tracker question: "What is happening to what I own?"
6. Compare symbols were session-only and disappeared on reload.
7. There were no editable price targets or trigger states.
8. The app did not show whether a watched symbol was inside, above, or below a target band.
9. There was no allocation analysis across tracked holdings.
10. There was no top underlying exposure view, so ETF overlap risk was hidden.
11. There was no tracker-level risk checklist for concentration, single-stock exposure, missing quote data, high volatility, or higher fund cost.
12. The live-data story was under-explained in the product surface. Mock data could make the app feel more live than it really was.
13. Live provider adapters hydrate quote/history data, but live ETF holdings, full fundamentals, licensed profile data, and source timestamps remain incomplete.
14. The USD/CAD conversion is a static estimate for non-CAD listings, not a live FX feed.
15. The chart can synthesize extra bars when history is thin, which is fine for local demos but not production-grade analysis.
16. Recent news can fall back to mock examples, so research freshness still depends on provider configuration.
17. The Prisma schema is ahead of the app: instruments, watchlists, news, and assessments are modeled, but runtime persistence is still local/browser-first.
18. There is no authentication, multi-device sync, import/export, broker integration, tax-lot tracking, realized gain tracking, dividends received, or cash balance.
19. Alerts are local visual states only. There is no notification delivery, background job, email, webhook, or server monitor.
20. The app did not have e2e coverage for the missing tracker workflows.

## Fixed In This Pass

1. Added a local portfolio tracker with editable shares and CAD average cost.
2. Added market value, day move, unrealized P/L, and weighted fund cost.
3. Added a persisted watchlist and persisted compare set through localStorage.
4. Made the header alert bell jump to the alert center.
5. Added editable low/high CAD alert bands.
6. Added alert status badges for inside-band, above-target, below-target, and unconfigured states.
7. Added allocation analysis across tracked positions.
8. Added underlying holding exposure so ETF overlap is visible.
9. Added tracker-level risk flags.
10. Added selected-symbol controls for watch, position tracking, compare, and assessment.
11. Added defensive localStorage normalization so corrupted stored data falls back safely.
12. Added Playwright coverage for tracker render, editable position fields, and editable alert bands.
13. Added an anonymous tracker snapshot API that syncs watchlist, positions, and alert bands to Postgres when `DATABASE_URL` exists.
14. Added graceful database fallback so public deployments still work without server persistence configured.

## Still Worth Doing Next

1. Add authenticated accounts on top of the anonymous tracker snapshot API.
2. Add full tax-lot models for dividends, realized P/L, and cash.
3. Replace the static USD/CAD estimate with a real FX provider.
4. Add server-side alert evaluation and notifications.
5. Add ETF holdings/profile providers with source timestamps.
6. Add import/export for CSV broker statements.
7. Add benchmark-relative performance and drawdown charts for the tracked portfolio.
