import type { InstrumentDetail } from "@/lib/types";

export type TrackerPosition = {
  symbol: string;
  shares: number;
  averageCostCad: number;
  notes?: string;
  addedAt: string;
};

export type WatchAlert = {
  symbol: string;
  lowTargetCad?: number;
  highTargetCad?: number;
  createdAt: string;
};

export type TrackerState = {
  watchlist: string[];
  positions: TrackerPosition[];
  alerts: WatchAlert[];
};

export type PortfolioRow = {
  position: TrackerPosition;
  instrument: InstrumentDetail;
  priceCad: number;
  marketValueCad: number;
  costBasisCad: number;
  dayChangeCad: number;
  unrealizedPnlCad: number;
  unrealizedPnlPercent: number;
  allocation: number;
};

export type ExposureSlice = {
  label: string;
  weight: number;
};

export type PortfolioAnalytics = {
  rows: PortfolioRow[];
  unknownSymbols: string[];
  totalMarketValueCad: number;
  totalCostBasisCad: number;
  dayChangeCad: number;
  unrealizedPnlCad: number;
  unrealizedPnlPercent: number;
  weightedExpenseRatio: number | null;
  weightedDividendYield: number | null;
  weightedVolatility: number | null;
  concentration: number;
  sectorExposures: ExposureSlice[];
  underlyingHoldings: ExposureSlice[];
  riskFlags: string[];
};

export type WatchAlertRow = {
  symbol: string;
  instrument: InstrumentDetail;
  priceCad: number;
  lowTargetCad?: number;
  highTargetCad?: number;
  status: "below" | "above" | "inside" | "unconfigured";
  distancePercent: number | null;
};

export function createDefaultTrackerState(): TrackerState {
  return {
    watchlist: [],
    positions: [],
    alerts: []
  };
}

export function normalizeTrackerSymbol(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toUpperCase().replace(/_/g, "-").replace(/\s+/g, "");

  return /^[A-Z0-9^][A-Z0-9.-]{0,19}$/.test(normalized) ? normalized : "";
}

export function normalizeStoredTrackerState(value: unknown): TrackerState {
  const fallback = createDefaultTrackerState();

  if (!isRecord(value)) {
    return fallback;
  }

  const watchlist = uniqueSymbols(Array.isArray(value.watchlist) ? value.watchlist : fallback.watchlist);
  const positions = (Array.isArray(value.positions) ? value.positions : fallback.positions)
    .map(normalizeStoredPosition)
    .filter((position): position is TrackerPosition => Boolean(position));
  const alerts = (Array.isArray(value.alerts) ? value.alerts : fallback.alerts)
    .map(normalizeStoredAlert)
    .filter((alert): alert is WatchAlert => Boolean(alert));
  const symbolsFromAlerts = alerts.map((alert) => alert.symbol);

  return {
    watchlist: uniqueSymbols([...watchlist, ...symbolsFromAlerts]),
    positions: dedupePositions(positions),
    alerts: dedupeAlerts(alerts)
  };
}

export function createDefaultWatchAlert(
  instrument: InstrumentDetail,
  priceCad: number,
  now = new Date()
): WatchAlert {
  return {
    symbol: instrument.symbol,
    lowTargetCad: roundMoney(priceCad * 0.95),
    highTargetCad: roundMoney(priceCad * 1.08),
    createdAt: now.toISOString()
  };
}

export function createDefaultPosition(
  instrument: InstrumentDetail,
  priceCad: number,
  now = new Date()
): TrackerPosition {
  return {
    symbol: instrument.symbol,
    shares: 1,
    averageCostCad: roundMoney(priceCad),
    addedAt: now.toISOString()
  };
}

export function buildPortfolioAnalytics(
  positions: TrackerPosition[],
  instrumentBySymbol: Map<string, InstrumentDetail>,
  getPriceCad: (instrument: InstrumentDetail) => number
): PortfolioAnalytics {
  const baseRows = positions
    .map((position) => {
      const instrument = instrumentBySymbol.get(position.symbol);

      if (!instrument || position.shares <= 0) {
        return null;
      }

      const priceCad = getPriceCad(instrument);
      const marketValueCad = position.shares * priceCad;
      const costBasisCad = position.shares * Math.max(position.averageCostCad, 0);
      const unrealizedPnlCad = marketValueCad - costBasisCad;
      const unrealizedPnlPercent = costBasisCad > 0 ? unrealizedPnlCad / costBasisCad : 0;
      const dayChangeCad = marketValueCad * instrument.changePercent;

      return {
        position,
        instrument,
        priceCad,
        marketValueCad,
        costBasisCad,
        dayChangeCad,
        unrealizedPnlCad,
        unrealizedPnlPercent,
        allocation: 0
      };
    })
    .filter((row): row is Omit<PortfolioRow, "allocation"> & { allocation: number } => Boolean(row));
  const totalMarketValueCad = baseRows.reduce((total, row) => total + row.marketValueCad, 0);
  const rows = baseRows
    .map((row) => ({
      ...row,
      allocation: totalMarketValueCad > 0 ? row.marketValueCad / totalMarketValueCad : 0
    }))
    .sort((left, right) => right.marketValueCad - left.marketValueCad);
  const totalCostBasisCad = rows.reduce((total, row) => total + row.costBasisCad, 0);
  const dayChangeCad = rows.reduce((total, row) => total + row.dayChangeCad, 0);
  const unrealizedPnlCad = totalMarketValueCad - totalCostBasisCad;
  const unrealizedPnlPercent = totalCostBasisCad > 0 ? unrealizedPnlCad / totalCostBasisCad : 0;
  const weightedExpenseRatio = weightedInstrumentMetric(rows, (instrument) => instrument.expenseRatio);
  const weightedDividendYield = weightedInstrumentMetric(rows, (instrument) => instrument.dividendYield);
  const weightedVolatility = weightedInstrumentMetric(rows, (instrument) => instrument.volatility);
  const concentration = rows[0]?.allocation ?? 0;
  const unknownSymbols = positions
    .map((position) => position.symbol)
    .filter((symbol) => !instrumentBySymbol.has(symbol));

  return {
    rows,
    unknownSymbols,
    totalMarketValueCad,
    totalCostBasisCad,
    dayChangeCad,
    unrealizedPnlCad,
    unrealizedPnlPercent,
    weightedExpenseRatio,
    weightedDividendYield,
    weightedVolatility,
    concentration,
    sectorExposures: buildPortfolioExposure(rows),
    underlyingHoldings: buildUnderlyingHoldings(rows),
    riskFlags: buildRiskFlags({
      rows,
      unknownSymbols,
      concentration,
      weightedExpenseRatio,
      weightedVolatility
    })
  };
}

export function buildWatchAlertRows(
  watchlist: string[],
  alerts: WatchAlert[],
  instrumentBySymbol: Map<string, InstrumentDetail>,
  getPriceCad: (instrument: InstrumentDetail) => number
): WatchAlertRow[] {
  const alertsBySymbol = new Map(alerts.map((alert) => [alert.symbol, alert]));

  return uniqueSymbols(watchlist)
    .map((symbol) => {
      const instrument = instrumentBySymbol.get(symbol);

      if (!instrument) {
        return null;
      }

      const alert = alertsBySymbol.get(symbol);
      const priceCad = getPriceCad(instrument);
      const lowTargetCad = alert?.lowTargetCad;
      const highTargetCad = alert?.highTargetCad;
      const status = getAlertStatus(priceCad, lowTargetCad, highTargetCad);

      const row: WatchAlertRow = {
        symbol,
        instrument,
        priceCad,
        status,
        distancePercent: getAlertDistancePercent(priceCad, lowTargetCad, highTargetCad)
      };

      if (lowTargetCad !== undefined) {
        row.lowTargetCad = lowTargetCad;
      }

      if (highTargetCad !== undefined) {
        row.highTargetCad = highTargetCad;
      }

      return row;
    })
    .filter((row): row is WatchAlertRow => Boolean(row));
}

function normalizeStoredPosition(value: unknown): TrackerPosition | null {
  if (!isRecord(value)) {
    return null;
  }

  const symbol = normalizeTrackerSymbol(value.symbol);
  const shares = boundedNumber(value.shares, 0, 1_000_000);
  const averageCostCad = boundedNumber(value.averageCostCad, 0, 10_000_000);

  if (!symbol || shares === null || averageCostCad === null) {
    return null;
  }

  return {
    symbol,
    shares,
    averageCostCad,
    notes: typeof value.notes === "string" ? value.notes.slice(0, 240) : undefined,
    addedAt: isoString(value.addedAt) ?? new Date().toISOString()
  };
}

function normalizeStoredAlert(value: unknown): WatchAlert | null {
  if (!isRecord(value)) {
    return null;
  }

  const symbol = normalizeTrackerSymbol(value.symbol);

  if (!symbol) {
    return null;
  }

  return {
    symbol,
    lowTargetCad: optionalBoundedNumber(value.lowTargetCad, 0, 10_000_000),
    highTargetCad: optionalBoundedNumber(value.highTargetCad, 0, 10_000_000),
    createdAt: isoString(value.createdAt) ?? new Date().toISOString()
  };
}

function dedupePositions(positions: TrackerPosition[]) {
  const bySymbol = new Map<string, TrackerPosition>();

  for (const position of positions) {
    bySymbol.set(position.symbol, position);
  }

  return [...bySymbol.values()];
}

function dedupeAlerts(alerts: WatchAlert[]) {
  const bySymbol = new Map<string, WatchAlert>();

  for (const alert of alerts) {
    bySymbol.set(alert.symbol, alert);
  }

  return [...bySymbol.values()];
}

function uniqueSymbols(values: unknown[]) {
  const symbols: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const symbol = normalizeTrackerSymbol(value);

    if (!symbol || seen.has(symbol)) {
      continue;
    }

    seen.add(symbol);
    symbols.push(symbol);
  }

  return symbols;
}

function weightedInstrumentMetric(
  rows: PortfolioRow[],
  getValue: (instrument: InstrumentDetail) => number | undefined
) {
  const weightedRows = rows.filter((row) => typeof getValue(row.instrument) === "number");
  const totalValue = weightedRows.reduce((total, row) => total + row.marketValueCad, 0);

  if (!weightedRows.length || totalValue <= 0) {
    return null;
  }

  return (
    weightedRows.reduce((total, row) => total + row.marketValueCad * (getValue(row.instrument) ?? 0), 0) /
    totalValue
  );
}

function buildPortfolioExposure(rows: PortfolioRow[]) {
  const exposures = new Map<string, number>();

  for (const row of rows) {
    const slices = row.instrument.sectors.length
      ? row.instrument.sectors
      : [{ label: row.instrument.type, weight: 1 }];

    for (const slice of slices) {
      exposures.set(slice.label, (exposures.get(slice.label) ?? 0) + row.allocation * slice.weight);
    }
  }

  return topExposureSlices(exposures, 6);
}

function buildUnderlyingHoldings(rows: PortfolioRow[]) {
  const holdings = new Map<string, number>();

  for (const row of rows) {
    if (!row.instrument.holdings.length) {
      holdings.set(row.instrument.symbol, (holdings.get(row.instrument.symbol) ?? 0) + row.allocation);
      continue;
    }

    for (const holding of row.instrument.holdings) {
      holdings.set(holding.symbol, (holdings.get(holding.symbol) ?? 0) + row.allocation * holding.weight);
    }
  }

  return topExposureSlices(holdings, 6);
}

function topExposureSlices(values: Map<string, number>, limit: number) {
  return [...values.entries()]
    .map(([label, weight]) => ({ label, weight }))
    .filter((slice) => slice.weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit);
}

function buildRiskFlags({
  rows,
  unknownSymbols,
  concentration,
  weightedExpenseRatio,
  weightedVolatility
}: {
  rows: PortfolioRow[];
  unknownSymbols: string[];
  concentration: number;
  weightedExpenseRatio: number | null;
  weightedVolatility: number | null;
}) {
  const flags: string[] = [];
  const topSingleName = rows.find((row) => row.instrument.type === "Stock" && row.allocation >= 0.2);

  if (!rows.length) {
    flags.push("No usable positions are being tracked.");
  }

  if (unknownSymbols.length) {
    flags.push(`${unknownSymbols.join(", ")} need fresh quote data before they can be valued.`);
  }

  if (concentration >= 0.45) {
    flags.push("The largest position is above 45% of tracked market value.");
  } else if (concentration >= 0.3) {
    flags.push("The largest position is above 30% of tracked market value.");
  }

  if (topSingleName) {
    flags.push(`${topSingleName.instrument.symbol} is a large single-stock exposure.`);
  }

  if (weightedVolatility !== null && weightedVolatility >= 0.2) {
    flags.push("Weighted volatility is elevated for a tracker meant to monitor core holdings.");
  }

  if (weightedExpenseRatio !== null && weightedExpenseRatio >= 0.0025) {
    flags.push("Weighted fund cost is creeping above low-cost index territory.");
  }

  if (!flags.length) {
    flags.push("No major tracker-level risk flags from the current local inputs.");
  }

  return flags;
}

function getAlertStatus(
  priceCad: number,
  lowTargetCad: number | undefined,
  highTargetCad: number | undefined
): WatchAlertRow["status"] {
  if (typeof lowTargetCad !== "number" && typeof highTargetCad !== "number") {
    return "unconfigured";
  }

  if (typeof lowTargetCad === "number" && priceCad <= lowTargetCad) {
    return "below";
  }

  if (typeof highTargetCad === "number" && priceCad >= highTargetCad) {
    return "above";
  }

  return "inside";
}

function getAlertDistancePercent(
  priceCad: number,
  lowTargetCad: number | undefined,
  highTargetCad: number | undefined
) {
  const distances = [lowTargetCad, highTargetCad]
    .filter((target): target is number => typeof target === "number" && target > 0)
    .map((target) => Math.abs(priceCad - target) / target);

  return distances.length ? Math.min(...distances) : null;
}

function boundedNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(Math.max(value, min), max);
}

function optionalBoundedNumber(value: unknown, min: number, max: number) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return boundedNumber(value, min, max) ?? undefined;
}

function isoString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
