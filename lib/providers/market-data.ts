import { instruments } from "@/lib/mock-data";
import type { AssetType, Exposure, InstrumentDetail, PricePoint } from "@/lib/types";

const DEFAULT_SEARCH_LIMIT = 8;
const FEATURED_LIMIT = 7;
const MAX_SEARCH_QUERY_LENGTH = 80;
const MAX_SYMBOL_LENGTH = 20;
const DETAIL_CACHE_TTL_MS = 30_000;
const SEARCH_CACHE_TTL_MS = 60_000;
const PROVIDER_TIMEOUT_MS = 8_000;

const SEARCH_QUERY_PATTERN = /^[A-Za-z0-9 .,&'()+/^:-]*$/;
const SYMBOL_PATTERN = /^(?:\^[A-Z0-9][A-Z0-9.-]{0,18}|[A-Z0-9][A-Z0-9.-]{0,19})$/;

export type MarketDataProviderName = "mock" | "polygon" | "fmp" | "alpha_vantage";

type SearchOptions = {
  limit?: number;
};

type MarketDataProviderConfig = {
  provider: MarketDataProviderName;
  polygonApiKey?: string;
  fmpApiKey?: string;
  alphaVantageApiKey?: string;
};

type MarketDataProvider = {
  readonly name: MarketDataProviderName;
  search(query: string, options?: SearchOptions): Promise<InstrumentDetail[]>;
  getDetail(symbol: string): Promise<InstrumentDetail | null>;
  getFeaturedIndexFunds(): InstrumentDetail[];
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type LiveInstrumentInput = {
  symbol: string;
  source: string;
  name?: string;
  type?: AssetType;
  exchange?: string;
  price?: number;
  changePercent?: number;
  expenseRatio?: number;
  dividendYield?: number;
  aum?: number;
  benchmark?: string;
  focus?: string;
  summary?: string;
  beta?: number;
  volatility?: number;
  maxDrawdown?: number;
  holdings?: InstrumentDetail["holdings"];
  sectors?: Exposure[];
  regions?: Exposure[];
  history?: PricePoint[];
};

export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

export class MarketDataValidationError extends MarketDataError {
  constructor(message: string) {
    super(message, 400, "MARKET_DATA_VALIDATION_ERROR");
    this.name = "MarketDataValidationError";
  }
}

export class MarketDataConfigurationError extends MarketDataError {
  constructor(message: string) {
    super(message, 503, "MARKET_DATA_CONFIGURATION_ERROR");
    this.name = "MarketDataConfigurationError";
  }
}

export class MarketDataProviderError extends MarketDataError {
  constructor(message: string) {
    super(message, 502, "MARKET_DATA_PROVIDER_ERROR");
    this.name = "MarketDataProviderError";
  }
}

export function isMarketDataError(error: unknown): error is MarketDataError {
  return error instanceof MarketDataError;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const pendingLoads = new Map<string, Promise<unknown>>();

export function normalizeInstrumentQuery(query: string) {
  return query
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseInstrumentSearchQuery(query: string) {
  const normalized = normalizeInstrumentQuery(query);

  if (normalized.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new MarketDataValidationError(`Search query must be ${MAX_SEARCH_QUERY_LENGTH} characters or fewer.`);
  }

  if (!SEARCH_QUERY_PATTERN.test(normalized)) {
    throw new MarketDataValidationError("Search query contains unsupported characters.");
  }

  return normalized;
}

export function normalizeInstrumentSymbol(symbol: string) {
  return symbol
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "");
}

export function parseInstrumentSymbol(symbol: string) {
  const normalized = normalizeInstrumentSymbol(symbol);

  if (!normalized) {
    throw new MarketDataValidationError("Expected a valid instrument symbol.");
  }

  if (normalized.length > MAX_SYMBOL_LENGTH || !SYMBOL_PATTERN.test(normalized)) {
    throw new MarketDataValidationError(
      `Symbols must be ${MAX_SYMBOL_LENGTH} characters or fewer and contain only letters, numbers, ".", "-", or "^".`
    );
  }

  return normalized;
}

export async function searchInstruments(query: string, options: SearchOptions = {}) {
  const normalizedQuery = parseInstrumentSearchQuery(query);
  const limit = normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT);
  const provider = getConfiguredProvider();
  const cacheKey = `${provider.name}:search:${normalizedQuery.toLowerCase()}:${limit}`;

  return readThroughCache(cacheKey, SEARCH_CACHE_TTL_MS, () => provider.search(normalizedQuery, { limit }));
}

export async function getInstrumentDetail(
  symbol: string,
  options: { bypassCache?: boolean } = {}
): Promise<InstrumentDetail | null> {
  const normalizedSymbol = safeParseInstrumentSymbol(symbol);

  if (!normalizedSymbol) {
    return null;
  }

  const provider = getConfiguredProvider();
  const cacheKey = `${provider.name}:detail:${normalizedSymbol}`;

  if (options.bypassCache) {
    return provider.getDetail(normalizedSymbol);
  }

  return readThroughCache(cacheKey, DETAIL_CACHE_TTL_MS, () => provider.getDetail(normalizedSymbol));
}

export function getFeaturedIndexFunds() {
  return mockProvider.getFeaturedIndexFunds();
}

class MockMarketDataProvider implements MarketDataProvider {
  readonly name: MarketDataProviderName = "mock";

  async search(query: string, options: SearchOptions = {}) {
    const limit = normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT);
    const normalized = query.toLowerCase();

    if (!normalized) {
      return instruments.slice(0, FEATURED_LIMIT);
    }

    return instruments
      .filter((instrument) => {
        return (
          instrument.symbol.toLowerCase().includes(normalized) ||
          instrument.name.toLowerCase().includes(normalized) ||
          instrument.focus.toLowerCase().includes(normalized) ||
          instrument.benchmark?.toLowerCase().includes(normalized)
        );
      })
      .slice(0, limit);
  }

  async getDetail(symbol: string) {
    return instruments.find((instrument) => instrument.symbol === symbol) ?? null;
  }

  getFeaturedIndexFunds() {
    return instruments.filter((instrument) => instrument.type === "ETF").slice(0, FEATURED_LIMIT);
  }
}

const mockProvider = new MockMarketDataProvider();

class PolygonMarketDataProvider implements MarketDataProvider {
  readonly name: MarketDataProviderName = "polygon";

  constructor(private readonly apiKey: string) {}

  async search(query: string, options: SearchOptions = {}) {
    if (!query) {
      return mockProvider.search(query, options);
    }

    const url = this.createUrl("/v3/reference/tickers", {
      active: "true",
      limit: String(normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT)),
      market: "stocks",
      search: query
    });
    const payload = await fetchProviderJson<unknown>(url, this.name);

    return asArray(asRecord(payload)?.results)
      .map(mapPolygonSearchResult)
      .filter(isInstrumentDetail);
  }

  async getDetail(symbol: string) {
    const today = formatProviderDate(new Date());
    const [overviewResult, snapshotResult, historyResult] = await Promise.allSettled([
      fetchProviderJson<unknown>(this.createUrl(`/v3/reference/tickers/${encodeURIComponent(symbol)}`), this.name),
      fetchProviderJson<unknown>(
        this.createUrl(`/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}`),
        this.name
      ),
      fetchProviderJson<unknown>(
        this.createUrl(`/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/1980-01-01/${today}`, {
          adjusted: "true",
          limit: "50000",
          sort: "asc"
        }),
        this.name
      )
    ]);

    throwIfAllRejected([overviewResult, snapshotResult, historyResult], this.name);

    const overview = asRecord(asRecord(getSettledValue(overviewResult))?.results);
    const snapshot = asRecord(asRecord(getSettledValue(snapshotResult))?.ticker);
    const history = mapPolygonHistory(getSettledValue(historyResult));

    if (!overview && !snapshot && !history.length) {
      return null;
    }

    return mapPolygonDetail(symbol, overview, snapshot, history);
  }

  getFeaturedIndexFunds() {
    return mockProvider.getFeaturedIndexFunds();
  }

  private createUrl(path: string, params: Record<string, string> = {}) {
    const url = new URL(`https://api.polygon.io${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    url.searchParams.set("apiKey", this.apiKey);

    return url;
  }
}

class FmpMarketDataProvider implements MarketDataProvider {
  readonly name: MarketDataProviderName = "fmp";

  constructor(private readonly apiKey: string) {}

  async search(query: string, options: SearchOptions = {}) {
    if (!query) {
      return mockProvider.search(query, options);
    }

    const url = new URL("https://financialmodelingprep.com/api/v3/search");
    url.searchParams.set("query", query);
    url.searchParams.set("limit", String(normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT)));
    url.searchParams.set("apikey", this.apiKey);

    const payload = await fetchProviderJson<unknown>(url, this.name);

    return asArray(payload)
      .map(mapFmpSearchResult)
      .filter(isInstrumentDetail);
  }

  async getDetail(symbol: string) {
    const [quoteResult, profileResult, historyResult] = await Promise.allSettled([
      fetchProviderJson<unknown>(this.createUrl(`quote/${encodeURIComponent(symbol)}`), this.name),
      fetchProviderJson<unknown>(this.createUrl(`profile/${encodeURIComponent(symbol)}`), this.name),
      fetchProviderJson<unknown>(this.createUrl(`historical-price-full/${encodeURIComponent(symbol)}`, { timeseries: "5000" }), this.name)
    ]);

    throwIfAllRejected([quoteResult, profileResult, historyResult], this.name);

    const quote = firstArrayRecord(getSettledValue(quoteResult));
    const profile = firstArrayRecord(getSettledValue(profileResult));

    if (!quote && !profile) {
      return null;
    }

    return mapFmpDetail(symbol, quote, profile, getSettledValue(historyResult));
  }

  getFeaturedIndexFunds() {
    return mockProvider.getFeaturedIndexFunds();
  }

  private createUrl(path: string, params: Record<string, string> = {}) {
    const url = new URL(`https://financialmodelingprep.com/api/v3/${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    url.searchParams.set("apikey", this.apiKey);

    return url;
  }
}

class AlphaVantageMarketDataProvider implements MarketDataProvider {
  readonly name: MarketDataProviderName = "alpha_vantage";

  constructor(private readonly apiKey: string) {}

  async search(query: string, options: SearchOptions = {}) {
    if (!query) {
      return mockProvider.search(query, options);
    }

    const payload = await fetchProviderJson<unknown>(
      this.createUrl({
        function: "SYMBOL_SEARCH",
        keywords: query
      }),
      this.name
    );
    const matches = asArray(asRecord(payload)?.bestMatches);

    return matches
      .map(mapAlphaVantageSearchResult)
      .filter(isInstrumentDetail)
      .slice(0, normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT));
  }

  async getDetail(symbol: string) {
    const [quoteResult, overviewResult, historyResult] = await Promise.allSettled([
      fetchProviderJson<unknown>(
        this.createUrl({
          function: "GLOBAL_QUOTE",
          symbol
        }),
        this.name
      ),
      fetchProviderJson<unknown>(
        this.createUrl({
          function: "OVERVIEW",
          symbol
        }),
        this.name
      ),
      fetchProviderJson<unknown>(
        this.createUrl({
          function: "TIME_SERIES_DAILY",
          outputsize: "full",
          symbol
        }),
        this.name
      )
    ]);

    throwIfAllRejected([quoteResult, overviewResult, historyResult], this.name);

    const quote = asRecord(asRecord(getSettledValue(quoteResult))?.["Global Quote"]);
    const overview = asRecord(getSettledValue(overviewResult));

    if (!quote && !overview) {
      return null;
    }

    return mapAlphaVantageDetail(symbol, quote, overview, getSettledValue(historyResult));
  }

  getFeaturedIndexFunds() {
    return mockProvider.getFeaturedIndexFunds();
  }

  private createUrl(params: Record<string, string>) {
    const url = new URL("https://www.alphavantage.co/query");

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    url.searchParams.set("apikey", this.apiKey);

    return url;
  }
}

function getConfiguredProvider(): MarketDataProvider {
  const config = getMarketDataConfig();

  if (config.provider === "mock") {
    return mockProvider;
  }

  if (config.provider === "polygon") {
    if (!config.polygonApiKey) {
      throw new MarketDataConfigurationError("Polygon market data is selected but POLYGON_API_KEY is not configured.");
    }

    return new PolygonMarketDataProvider(config.polygonApiKey);
  }

  if (config.provider === "fmp") {
    if (!config.fmpApiKey) {
      throw new MarketDataConfigurationError("FMP market data is selected but FMP_API_KEY is not configured.");
    }

    return new FmpMarketDataProvider(config.fmpApiKey);
  }

  if (!config.alphaVantageApiKey) {
    throw new MarketDataConfigurationError(
      "Alpha Vantage market data is selected but ALPHA_VANTAGE_API_KEY is not configured."
    );
  }

  return new AlphaVantageMarketDataProvider(config.alphaVantageApiKey);
}

function getMarketDataConfig(): MarketDataProviderConfig {
  const rawProvider = process.env.MARKET_DATA_PROVIDER?.trim().toLowerCase() || "mock";
  const provider = normalizeProviderName(rawProvider);

  if (!provider) {
    throw new MarketDataConfigurationError(
      `Unsupported market data provider "${rawProvider}". Use "mock", "polygon", "fmp", or "alpha_vantage".`
    );
  }

  return {
    provider,
    polygonApiKey: nonEmptyEnv(process.env.POLYGON_API_KEY),
    fmpApiKey: nonEmptyEnv(process.env.FMP_API_KEY),
    alphaVantageApiKey: nonEmptyEnv(process.env.ALPHA_VANTAGE_API_KEY)
  };
}

function normalizeProviderName(value: string): MarketDataProviderName | null {
  if (value === "mock" || value === "polygon" || value === "fmp") {
    return value;
  }

  if (value === "massive") {
    return "polygon";
  }

  if (value === "alpha_vantage" || value === "alpha-vantage" || value === "alphavantage") {
    return "alpha_vantage";
  }

  return null;
}

async function readThroughCache<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
  const now = Date.now();
  const cached = responseCache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pending = pendingLoads.get(key) as Promise<T> | undefined;

  if (pending) {
    return pending;
  }

  const load = loader()
    .then((value) => {
      responseCache.set(key, {
        expiresAt: Date.now() + ttlMs,
        value
      });

      return value;
    })
    .finally(() => {
      pendingLoads.delete(key);
    });

  pendingLoads.set(key, load);

  return load;
}

async function fetchProviderJson<T>(url: URL, provider: MarketDataProviderName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new MarketDataProviderError(`${formatProviderName(provider)} returned HTTP ${response.status}.`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MarketDataError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new MarketDataProviderError(`${formatProviderName(provider)} timed out.`);
    }

    throw new MarketDataProviderError(`${formatProviderName(provider)} could not be reached.`);
  } finally {
    clearTimeout(timeout);
  }
}

function mapPolygonSearchResult(value: unknown): InstrumentDetail | null {
  const record = asRecord(value);
  const symbol = safeParseInstrumentSymbol(stringField(record, "ticker") ?? "");

  if (!symbol) {
    return null;
  }

  const name = stringField(record, "name") ?? symbol;
  const type = inferPolygonAssetType(stringField(record, "type"), stringField(record, "market"));
  const exchange = stringField(record, "primary_exchange") ?? stringField(record, "market") ?? "Unknown";

  return createLiveInstrumentDetail({
    symbol,
    source: "Polygon",
    name,
    type,
    exchange,
    focus: `${type} search result from Polygon`,
    summary: `${name} was returned by Polygon ticker search. Quote, company metadata, and long-range OHLCV history are hydrated when the detail endpoint is requested.`
  });
}

function mapPolygonDetail(
  symbol: string,
  overview: Record<string, unknown> | null,
  snapshot: Record<string, unknown> | null,
  history: PricePoint[]
) {
  const day = asRecord(snapshot?.day);
  const lastTrade = asRecord(snapshot?.lastTrade) ?? asRecord(snapshot?.last_trade);
  const previousDay = asRecord(snapshot?.prevDay) ?? asRecord(snapshot?.prev_day);
  const latestHistoryClose = history.at(-1)?.close;
  const price = numberField(lastTrade, "p") ?? numberField(day, "c") ?? latestHistoryClose;
  const previousClose = numberField(previousDay, "c");
  const changePercent =
    percentagePointsToRatio(numberField(snapshot, "todaysChangePerc") ?? numberField(snapshot, "todays_change_percent")) ??
    calculateChangePercent(price, previousClose);
  const name = stringField(overview, "name") ?? stringField(snapshot, "ticker") ?? symbol;
  const industry = stringField(overview, "sic_description");
  const market = stringField(overview, "market");
  const type = inferPolygonAssetType(stringField(overview, "type"), market);
  const locale = stringField(overview, "locale");

  return createLiveInstrumentDetail({
    symbol,
    source: "Polygon",
    name,
    type,
    exchange: stringField(overview, "primary_exchange") ?? market ?? "Unknown",
    price,
    changePercent,
    aum: numberField(overview, "market_cap"),
    sectors: industry ? [{ label: industry, weight: 1 }] : undefined,
    regions: locale ? [{ label: locale, weight: 1 }] : undefined,
    history,
    focus: compactSentence([industry, market, "Polygon OHLCV history"]),
    summary: stringField(overview, "description")
  });
}

function mapFmpSearchResult(value: unknown): InstrumentDetail | null {
  const record = asRecord(value);
  const symbol = safeParseInstrumentSymbol(stringField(record, "symbol") ?? "");

  if (!symbol) {
    return null;
  }

  const name = stringField(record, "name") ?? symbol;
  const exchange = stringField(record, "exchangeShortName") ?? stringField(record, "stockExchange") ?? "Unknown";
  const type = inferAssetType(stringField(record, "type"));

  return createLiveInstrumentDetail({
    symbol,
    source: "FMP",
    name,
    type,
    exchange,
    focus: `${type} search result from FMP`,
    summary: `${name} was returned by FMP search. Quote, history, holdings, and risk fields are hydrated when the detail endpoint is requested.`
  });
}

function mapFmpDetail(symbol: string, quote: Record<string, unknown> | null, profile: Record<string, unknown> | null, history: unknown) {
  const name = stringField(profile, "companyName") ?? stringField(quote, "name") ?? symbol;
  const sector = stringField(profile, "sector");
  const country = stringField(profile, "country");
  const type = booleanField(profile, "isEtf") ? "ETF" : inferAssetType(stringField(profile, "type") ?? stringField(quote, "type"));
  const exchange =
    stringField(profile, "exchangeShortName") ??
    stringField(profile, "exchange") ??
    stringField(quote, "exchange") ??
    stringField(quote, "exchangeShortName") ??
    "Unknown";
  const price = numberField(quote, "price") ?? numberField(profile, "price");
  const changePercent = percentagePointsToRatio(numberField(quote, "changesPercentage"));
  const marketCap = numberField(profile, "mktCap") ?? numberField(quote, "marketCap");
  const description = stringField(profile, "description");

  return createLiveInstrumentDetail({
    symbol,
    source: "FMP",
    name,
    type,
    exchange,
    price,
    changePercent,
    aum: marketCap,
    beta: numberField(profile, "beta"),
    sectors: sector ? [{ label: sector, weight: 1 }] : undefined,
    regions: country ? [{ label: country, weight: 1 }] : undefined,
    history: mapFmpHistory(history),
    focus: compactSentence([sector, stringField(profile, "industry"), "FMP live quote"]),
    summary: description
  });
}

function mapAlphaVantageSearchResult(value: unknown): InstrumentDetail | null {
  const record = asRecord(value);
  const symbol = safeParseInstrumentSymbol(stringField(record, "1. symbol") ?? "");

  if (!symbol) {
    return null;
  }

  const name = stringField(record, "2. name") ?? symbol;
  const type = inferAssetType(stringField(record, "3. type"));
  const exchange = stringField(record, "4. region") ?? "Unknown";

  return createLiveInstrumentDetail({
    symbol,
    source: "Alpha Vantage",
    name,
    type,
    exchange,
    focus: `${type} search result from Alpha Vantage`,
    summary: `${name} was returned by Alpha Vantage search. Quote, history, holdings, and risk fields are hydrated when the detail endpoint is requested.`
  });
}

function mapAlphaVantageDetail(
  symbol: string,
  quote: Record<string, unknown> | null,
  overview: Record<string, unknown> | null,
  history: unknown
) {
  const name = stringField(overview, "Name") ?? symbol;
  const sector = stringField(overview, "Sector");
  const country = stringField(overview, "Country");
  const assetType = stringField(overview, "AssetType");
  const exchange = stringField(overview, "Exchange") ?? "Unknown";
  const price = numberField(quote, "05. price");
  const changePercent = percentagePointsToRatio(numberField(quote, "10. change percent"));
  const summary = stringField(overview, "Description");

  return createLiveInstrumentDetail({
    symbol,
    source: "Alpha Vantage",
    name,
    type: inferAssetType(assetType),
    exchange,
    price,
    changePercent,
    dividendYield: numberField(overview, "DividendYield"),
    aum: numberField(overview, "MarketCapitalization"),
    beta: numberField(overview, "Beta"),
    sectors: sector ? [{ label: sector, weight: 1 }] : undefined,
    regions: country ? [{ label: country, weight: 1 }] : undefined,
    history: mapAlphaVantageHistory(history),
    focus: compactSentence([sector, stringField(overview, "Industry"), "Alpha Vantage live quote"]),
    summary
  });
}

function createLiveInstrumentDetail(input: LiveInstrumentInput): InstrumentDetail {
  const name = input.name?.trim() || input.symbol;
  const type = input.type ?? "Stock";
  const price = input.price && input.price > 0 ? input.price : 0;
  const summary =
    input.summary?.trim() ||
    `${name} (${input.symbol}) is available from ${input.source}. Holdings, factor exposures, and ETF-specific risk metrics remain placeholders until a licensed fundamentals feed is connected.`;

  return {
    symbol: input.symbol,
    name,
    type,
    exchange: input.exchange?.trim() || "Unknown",
    price,
    changePercent: input.changePercent ?? 0,
    expenseRatio: input.expenseRatio,
    dividendYield: input.dividendYield,
    aum: input.aum,
    benchmark: input.benchmark,
    focus: input.focus?.trim() || `${type} live market data from ${input.source}`,
    summary: trimText(summary, 480),
    beta: input.beta ?? 0,
    volatility: input.volatility ?? 0,
    maxDrawdown: input.maxDrawdown ?? 0,
    holdings: input.holdings ?? [],
    sectors: input.sectors ?? [],
    regions: input.regions ?? [],
    history: input.history?.length ? input.history : fallbackHistory(price)
  };
}

function mapPolygonHistory(payload: unknown): PricePoint[] {
  return asArray(asRecord(payload)?.results)
    .map((row): PricePoint | null => {
      const record = asRecord(row);
      const timestamp = numberField(record, "t");
      const close = numberField(record, "c");

      if (!timestamp || close === undefined) {
        return null;
      }

      return {
        date: new Date(timestamp).toISOString(),
        close,
        open: numberField(record, "o"),
        high: numberField(record, "h"),
        low: numberField(record, "l"),
        volume: numberField(record, "v")
      };
    })
    .filter((point): point is PricePoint => point !== null)
    .sort(sortPricePointByDate);
}

function mapFmpHistory(payload: unknown): PricePoint[] {
  const rows = asArray(asRecord(payload)?.historical);

  return rows
    .map((row): PricePoint | null => {
      const record = asRecord(row);
      const date = stringField(record, "date");
      const close = numberField(record, "close");

      if (!date || close === undefined) {
        return null;
      }

      return {
        date: normalizeHistoryDate(date),
        close,
        open: numberField(record, "open"),
        high: numberField(record, "high"),
        low: numberField(record, "low"),
        volume: numberField(record, "volume")
      };
    })
    .filter((point): point is PricePoint => point !== null)
    .sort(sortPricePointByDate);
}

function mapAlphaVantageHistory(payload: unknown): PricePoint[] {
  const series = asRecord(asRecord(payload)?.["Time Series (Daily)"]);

  if (!series) {
    return [];
  }

  return Object.entries(series)
    .map(([date, value]): PricePoint | null => {
      const record = asRecord(value);
      const close = numberField(record, "4. close");

      if (close === undefined) {
        return null;
      }

      return {
        date: normalizeHistoryDate(date),
        close,
        open: numberField(record, "1. open"),
        high: numberField(record, "2. high"),
        low: numberField(record, "3. low"),
        volume: numberField(record, "5. volume")
      };
    })
    .filter((point): point is PricePoint => point !== null)
    .sort(sortPricePointByDate);
}

function fallbackHistory(price: number): PricePoint[] {
  const close = price > 0 ? price : 1;
  const today = new Date();

  return Array.from({ length: 126 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (125 - index)));

    return {
      date: date.toISOString(),
      close: Number(close.toFixed(2)),
      open: Number(close.toFixed(2)),
      high: Number((close * 1.002).toFixed(2)),
      low: Number((close * 0.998).toFixed(2)),
      volume: 0
    };
  });
}

function safeParseInstrumentSymbol(symbol: string) {
  try {
    return parseInstrumentSymbol(symbol);
  } catch {
    return null;
  }
}

function normalizeLimit(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 20);
}

function getSettledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : undefined;
}

function throwIfAllRejected(results: PromiseSettledResult<unknown>[], provider: MarketDataProviderName) {
  if (results.some((result) => result.status === "fulfilled")) {
    return;
  }

  const providerError = results.find((result) => result.status === "rejected" && result.reason instanceof MarketDataError);

  if (providerError?.status === "rejected") {
    throw providerError.reason;
  }

  throw new MarketDataProviderError(`${formatProviderName(provider)} did not return usable market data.`);
}

function firstArrayRecord(value: unknown) {
  return asArray(value).map(asRecord).find(Boolean) ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringField(record: Record<string, unknown> | null | undefined, field: string) {
  const value = record?.[field];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function numberField(record: Record<string, unknown> | null | undefined, field: string) {
  const value = record?.[field];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[%,$]/g, "").trim();
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function booleanField(record: Record<string, unknown> | null | undefined, field: string) {
  const value = record?.[field];

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return false;
}

function percentagePointsToRatio(value: number | undefined) {
  return value === undefined ? undefined : value / 100;
}

function calculateChangePercent(price: number | undefined, previousClose: number | undefined) {
  if (!price || !previousClose || previousClose <= 0) {
    return undefined;
  }

  return (price - previousClose) / previousClose;
}

function inferAssetType(value: string | undefined): AssetType {
  const normalized = value?.toLowerCase() ?? "";

  if (normalized.includes("etf")) {
    return "ETF";
  }

  if (normalized.includes("fund")) {
    return "Mutual Fund";
  }

  if (normalized.includes("index")) {
    return "Index";
  }

  return "Stock";
}

function inferPolygonAssetType(type: string | undefined, market: string | undefined): AssetType {
  const normalizedType = type?.toLowerCase() ?? "";
  const normalizedMarket = market?.toLowerCase() ?? "";

  if (normalizedType.includes("etf")) {
    return "ETF";
  }

  if (normalizedMarket.includes("indices") || normalizedType.includes("index")) {
    return "Index";
  }

  if (normalizedType.includes("fund")) {
    return "Mutual Fund";
  }

  return inferAssetType(type);
}

function isInstrumentDetail(value: InstrumentDetail | null): value is InstrumentDetail {
  return value !== null;
}

function sortPricePointByDate(left: PricePoint, right: PricePoint) {
  return Date.parse(left.date) - Date.parse(right.date);
}

function normalizeHistoryDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }

  return date.toISOString();
}

function formatProviderDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function compactSentence(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" / ");
}

function trimText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}...` : value;
}

function nonEmptyEnv(value: string | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

function formatProviderName(provider: MarketDataProviderName) {
  if (provider === "polygon") {
    return "Polygon";
  }

  if (provider === "fmp") {
    return "FMP";
  }

  if (provider === "alpha_vantage") {
    return "Alpha Vantage";
  }

  return "Mock market data";
}
