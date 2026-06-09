"use client";

import {
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CandlestickChart,
  ChevronDown,
  ChevronUp,
  ChartPie,
  Check,
  CircleAlert,
  CircleDollarSign,
  Gauge,
  Info,
  Landmark,
  Layers3,
  ListFilter,
  Moon,
  Plus,
  Radar,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  X,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCadCurrency, formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/format";
import { instruments, mockAssessment, newsBySymbol } from "@/lib/mock-data";
import {
  buildPortfolioAnalytics,
  buildWatchAlertRows,
  createDefaultPosition,
  createDefaultTrackerState,
  createDefaultWatchAlert,
  normalizeStoredTrackerState,
  type PortfolioAnalytics,
  type TrackerPosition,
  type TrackerState,
  type WatchAlert,
  type WatchAlertRow
} from "@/lib/tracker";
import type { Assessment, InstrumentDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const emptyInstrument: InstrumentDetail = {
  symbol: "",
  name: "Search a stock to start",
  type: "Stock",
  exchange: "",
  price: 0,
  changePercent: 0,
  focus: "Search for a ticker, then add it to one of the tracking slots below.",
  summary: "Search for a ticker to load live quote and chart history.",
  beta: 0,
  volatility: 0,
  maxDrawdown: 0,
  holdings: [],
  sectors: [],
  regions: [],
  history: []
};
const emptyAssessment: Assessment = {
  symbol: "",
  direction: "uncertain",
  confidence: 0,
  timeHorizon: "No symbol",
  summary: "Search a ticker to generate a quick take from its price history and news.",
  bullCase: [],
  bearCase: [],
  keyRisks: [],
  citations: [],
  generatedAt: "",
  notInvestmentAdvice: "For research only. This tool does not provide personalized financial, tax, or investment advice."
};
const initialInstrument = emptyInstrument;
const coreCompareSymbols: string[] = [];
const maxCompareFunds = 5;
const compareCandidates = instruments.filter((instrument) => instrument.type === "ETF");
const chartRanges = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"] as const;
const chartStyles = ["Line", "Area", "Candles"] as const;
const chartScales = ["Price", "% Change"] as const;
const chartSizes = ["Compact", "Focus", "Max"] as const;
const refreshIntervals = [15_000, 30_000, 60_000] as const;
const estimatedUsdToCadRate = 1.37;
const trackerStorageKey = "advanced-stock-stalker.tracker.v2";
const compareStorageKey = "advanced-stock-stalker.compare.v2";
const trackerClientStorageKey = "advanced-stock-stalker.client.v2";
const themeStorageKey = "advanced-stock-stalker.theme.v2";
const stockSlotCount = 8;
const workspacePanels = [
  { id: "prospects", label: "Stock Bar" },
  { id: "research", label: "Quick Take" },
  { id: "metrics", label: "Stats" },
  { id: "indexLens", label: "Fund Basics" },
  { id: "comparison", label: "Compare" },
  { id: "exposures", label: "Holdings" }
] as const;

type ChartRange = (typeof chartRanges)[number];
type ChartStyle = (typeof chartStyles)[number];
type ChartScale = (typeof chartScales)[number];
type ChartSize = (typeof chartSizes)[number];
type ThemeMode = "light" | "dark";
type TrackerPersistenceStatus = "loading" | "local" | "syncing" | "synced" | "error";
type WorkspacePanelId = (typeof workspacePanels)[number]["id"];
type WorkspacePanel = {
  id: WorkspacePanelId;
  label: string;
  visible: boolean;
};

const subscribeWorkspaceReady = () => () => undefined;
const getWorkspaceReadySnapshot = () => true;
const getWorkspaceServerSnapshot = () => false;

export function StockDashboard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InstrumentDetail[]>([]);
  const [selected, setSelected] = useState<InstrumentDetail>(initialInstrument);
  const [compareSymbols, setCompareSymbols] = useState(coreCompareSymbols);
  const [trackerState, setTrackerState] = useState<TrackerState>(() => createDefaultTrackerState());
  const [isLocalStateHydrated, setIsLocalStateHydrated] = useState(false);
  const [trackerPersistence, setTrackerPersistence] = useState<TrackerPersistenceStatus>("loading");
  const [trackerLastSavedAt, setTrackerLastSavedAt] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment>(() => emptyAssessment);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState("");
  const [chartRange, setChartRange] = useState<ChartRange>("1Y");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("Area");
  const [chartScale, setChartScale] = useState<ChartScale>("Price");
  const [showVolume, setShowVolume] = useState(true);
  const [showMovingAverage, setShowMovingAverage] = useState(true);
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [showChartSettings, setShowChartSettings] = useState(true);
  const [chartSize, setChartSize] = useState<ChartSize>("Focus");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    readStringFromStorage(themeStorageKey) === "dark" ? "dark" : "light"
  );
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [showProspects, setShowProspects] = useState(true);
  const [showResearchRail, setShowResearchRail] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showIndexLens, setShowIndexLens] = useState(true);
  const [showComparison, setShowComparison] = useState(true);
  const [showExposurePanels, setShowExposurePanels] = useState(true);
  const [researchWidth, setResearchWidth] = useState(390);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<(typeof refreshIntervals)[number]>(30_000);
  const [isHydratingDetail, setIsHydratingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [lastHydratedAt, setLastHydratedAt] = useState<string | null>(null);
  const trackerClientIdRef = useRef<string | null>(null);
  const trackerRemoteAvailableRef = useRef(false);
  const trackerHasUserEditsRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isWorkspaceReady = useSyncExternalStore(
    subscribeWorkspaceReady,
    getWorkspaceReadySnapshot,
    getWorkspaceServerSnapshot
  );

  const instrumentUniverse = useMemo(() => mergeInstrumentUniverse([instruments, results, [selected]]), [results, selected]);
  const instrumentBySymbol = useMemo(
    () => new Map(instrumentUniverse.map((instrument) => [instrument.symbol, instrument])),
    [instrumentUniverse]
  );
  const compareFunds = useMemo(
    () =>
      compareSymbols
        .map((symbol) => instrumentBySymbol.get(symbol))
        .filter((instrument): instrument is InstrumentDetail => Boolean(instrument)),
    [compareSymbols, instrumentBySymbol]
  );

  const indexInsights = useMemo(() => buildIndexInsights(selected), [selected]);
  const marketSignal = useMemo(() => buildMarketSignal(selected), [selected]);
  const selectedBenchmark = useMemo(() => compareFunds.find((fund) => fund.symbol !== selected.symbol), [compareFunds, selected.symbol]);
  const selectedDisplayPrice = getDisplayPrice(selected);
  const selectedDisplayCurrency = getInstrumentCurrencyLabel(selected);
  const portfolioAnalytics = useMemo(
    () => buildPortfolioAnalytics(trackerState.positions, instrumentBySymbol, getInstrumentCadPrice),
    [instrumentBySymbol, trackerState.positions]
  );
  const watchAlertRows = useMemo(
    () => buildWatchAlertRows(trackerState.watchlist, trackerState.alerts, instrumentBySymbol, getInstrumentCadPrice),
    [instrumentBySymbol, trackerState.alerts, trackerState.watchlist]
  );
  const selectedPosition = useMemo(
    () => trackerState.positions.find((position) => position.symbol === selected.symbol) ?? null,
    [selected.symbol, trackerState.positions]
  );
  const selectedAlert = useMemo(
    () => trackerState.alerts.find((alert) => alert.symbol === selected.symbol) ?? null,
    [selected.symbol, trackerState.alerts]
  );
  const isSelectedWatched = trackerState.watchlist.includes(selected.symbol);
  const nextCompareReplacement =
    compareSymbols.length >= maxCompareFunds && !compareSymbols.includes(selected.symbol) ? compareSymbols[0] : null;
  const hasSelectedInstrument = Boolean(selected.symbol);
  const prospectsVisible = showProspects && chartSize !== "Max";
  const researchRailVisible = showResearchRail && chartSize !== "Max";
  const metricsVisible = showMetrics && chartSize !== "Max";
  const comparisonVisible = showComparison && chartSize !== "Max";
  const exposurePanelsVisible = hasSelectedInstrument && showExposurePanels && chartSize !== "Max";
  const workspaceColumns = researchRailVisible ? `minmax(0, 1fr) 10px ${researchWidth}px` : "minmax(0, 1fr)";
  const workspaceStyle = {
    "--workspace-columns": workspaceColumns,
    "--metric-column": "142px"
  } as CSSProperties;
  const panelStates = useMemo<WorkspacePanel[]>(
    () =>
      workspacePanels.map((panel) => ({
        ...panel,
        visible:
          panel.id === "prospects"
            ? showProspects
            : panel.id === "research"
              ? showResearchRail
              : panel.id === "metrics"
                ? showMetrics
                : panel.id === "indexLens"
                  ? showIndexLens
                  : panel.id === "comparison"
                    ? showComparison
                    : showExposurePanels
      })),
    [showComparison, showExposurePanels, showIndexLens, showMetrics, showProspects, showResearchRail]
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    writeStringToStorage(themeStorageKey, themeMode);
  }, [themeMode]);

  const hydrateSelectedDetail = useCallback(
    async (symbol: string, options: { refresh?: boolean; silent?: boolean } = {}) => {
      const normalizedSymbol = symbol.trim();

      if (!normalizedSymbol) {
        setDetailError(null);
        return;
      }

      if (!options.silent) {
        setIsHydratingDetail(true);
      }

      try {
        const search = options.refresh ? "?refresh=1" : "";
        const response = await fetch(`/api/instruments/${encodeURIComponent(normalizedSymbol)}${search}`);
        const payload = (await response.json()) as Partial<{ instrument: InstrumentDetail; error: string }>;

        if (!response.ok) {
          throw new Error(payload.error ?? "Instrument detail service returned an unexpected response.");
        }

        if (!payload.instrument) {
          throw new Error("Instrument detail was not available.");
        }

        const hydratedInstrument = payload.instrument;

        setSelected((current) => (current.symbol === hydratedInstrument.symbol ? hydratedInstrument : current));
        setDetailError(null);
        setLastHydratedAt(new Date().toISOString());
      } catch (error) {
        setDetailError(error instanceof Error ? error.message : "Instrument detail service is unavailable.");
      } finally {
        if (!options.silent) {
          setIsHydratingDetail(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const hydrationId = window.setTimeout(() => {
      void (async () => {
        const trackerClientId = getOrCreateTrackerClientId();
        const storedTrackerState = readJsonFromStorage(trackerStorageKey);
        const storedCompareSymbols = readJsonFromStorage(compareStorageKey);
        const localTrackerState = storedTrackerState
          ? normalizeStoredTrackerState(storedTrackerState)
          : createDefaultTrackerState();

        trackerClientIdRef.current = trackerClientId;

        if (!trackerHasUserEditsRef.current) {
          setTrackerState(localTrackerState);
        }

        if (Array.isArray(storedCompareSymbols)) {
          const normalizedCompareSymbols = storedCompareSymbols
            .map((symbol) => (typeof symbol === "string" ? symbol.trim().toUpperCase() : ""))
            .filter((symbol) => symbol.length > 0)
            .slice(0, maxCompareFunds);

          if (normalizedCompareSymbols.length) {
            setCompareSymbols(normalizedCompareSymbols);
          }
        }

        try {
          const response = await fetch("/api/tracker", {
            headers: {
              "x-tracker-client-id": trackerClientId
            }
          });
          const payload = (await response.json()) as Partial<{
            state: TrackerState | null;
            persistence: "database" | "local";
            saved: boolean;
            updatedAt: string | null;
          }>;

          if (response.ok && payload.state && !trackerHasUserEditsRef.current) {
            setTrackerState(normalizeStoredTrackerState(payload.state));
          }

          trackerRemoteAvailableRef.current = response.ok && payload.persistence === "database";
          setTrackerPersistence(trackerRemoteAvailableRef.current ? "synced" : "local");
          setTrackerLastSavedAt(payload.updatedAt ?? null);
        } catch {
          trackerRemoteAvailableRef.current = false;
          setTrackerPersistence("local");
        }

        setIsLocalStateHydrated(true);
      })();
    }, 0);

    return () => window.clearTimeout(hydrationId);
  }, []);

  useEffect(() => {
    if (!isLocalStateHydrated) {
      return;
    }

    writeJsonToStorage(trackerStorageKey, trackerState);
  }, [isLocalStateHydrated, trackerState]);

  useEffect(() => {
    if (!isLocalStateHydrated) {
      return;
    }

    writeJsonToStorage(compareStorageKey, compareSymbols);
  }, [compareSymbols, isLocalStateHydrated]);

  useEffect(() => {
    if (!isLocalStateHydrated || !trackerRemoteAvailableRef.current || !trackerClientIdRef.current) {
      return undefined;
    }

    const saveId = window.setTimeout(() => {
      void (async () => {
        setTrackerPersistence("syncing");

        try {
          const response = await fetch("/api/tracker", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-tracker-client-id": trackerClientIdRef.current ?? ""
            },
            body: JSON.stringify({ state: trackerState })
          });
          const payload = (await response.json()) as Partial<{
            persistence: "database" | "local";
            saved: boolean;
            updatedAt: string | null;
          }>;

          if (response.ok && payload.saved && payload.persistence === "database") {
            setTrackerPersistence("synced");
            setTrackerLastSavedAt(payload.updatedAt ?? new Date().toISOString());
            return;
          }

          trackerRemoteAvailableRef.current = false;
          setTrackerPersistence("local");
        } catch {
          setTrackerPersistence("error");
        }
      })();
    }, 650);

    return () => window.clearTimeout(saveId);
  }, [isLocalStateHydrated, trackerState]);

  useEffect(() => {
    if (!autoRefresh || !selected.symbol) {
      return undefined;
    }

    const refresh = () => {
      void hydrateSelectedDetail(selected.symbol, { refresh: true, silent: true });
    };
    const interval = window.setInterval(refresh, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [autoRefresh, hydrateSelectedDetail, refreshIntervalMs, selected.symbol]);

  function setPanelVisibility(panelId: WorkspacePanelId, visible: boolean) {
    if (visible && chartSize === "Max") {
      setChartSize("Focus");
    }

    if (panelId === "prospects") {
      setShowProspects(visible);
      return;
    }

    if (panelId === "research") {
      setShowResearchRail(visible);
      return;
    }

    if (panelId === "metrics") {
      setShowMetrics(visible);
      return;
    }

    if (panelId === "indexLens") {
      setShowIndexLens(visible);
      return;
    }

    if (panelId === "comparison") {
      setShowComparison(visible);
      return;
    }

    setShowExposurePanels(visible);
  }

  async function handleSearch(nextQuery = query) {
    const normalizedQuery = nextQuery.trim();
    setQuery(nextQuery);
    setLastSearchQuery(normalizedQuery);
    setSearchError(null);

    if (!normalizedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(`/api/instruments/search?q=${encodeURIComponent(normalizedQuery)}`);
      const payload = (await response.json()) as Partial<{ results: InstrumentDetail[]; error: string }>;

      if (!response.ok) {
        throw new Error(payload.error ?? "Search service returned an unexpected response.");
      }

      if (!Array.isArray(payload.results)) {
        throw new Error("Search results were not available.");
      }

      setResults(payload.results);

      if (payload.results[0]) {
        selectInstrument(payload.results[0]);
      }
    } catch (error) {
      const fallbackResults = searchLocalInstruments(normalizedQuery);
      setResults(fallbackResults);
      setSearchError(error instanceof Error ? error.message : "Search service is unavailable.");

      if (fallbackResults[0]) {
        selectInstrument(fallbackResults[0]);
      }
    } finally {
      setIsSearching(false);
    }
  }

  function selectInstrument(instrument: InstrumentDetail) {
    if (!instrument.symbol) {
      return;
    }

    setSelected(instrument);
    setIsAboutExpanded(false);
    setAssessment({
      ...mockAssessment(instrument.symbol),
      citations: newsBySymbol[instrument.symbol] ?? newsBySymbol.VOO
    });
    setAssessmentError(null);
    setDetailError(null);
    void hydrateSelectedDetail(instrument.symbol);
  }

  function handleSelect(instrument: InstrumentDetail) {
    selectInstrument(instrument);
  }

  async function handleAssess() {
    if (!selected.symbol) {
      return;
    }

    setAssessmentError(null);
    setIsAssessing(true);

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbol: selected.symbol })
      });
      const payload = (await response.json()) as Partial<{ assessment: Assessment; error: string }>;

      if (!response.ok) {
        throw new Error(payload.error ?? "Assessment service returned an unexpected response.");
      }

      if (!payload.assessment) {
        throw new Error("Assessment was not available.");
      }

      setAssessment(payload.assessment);
    } catch (error) {
      setAssessmentError(error instanceof Error ? error.message : "Assessment service is unavailable.");
    } finally {
      setIsAssessing(false);
    }
  }

  function toggleCompare(symbol: string) {
    if (!symbol) {
      return;
    }

    setCompareSymbols((current) => {
      if (current.includes(symbol)) {
        return current.filter((item) => item !== symbol);
      }

      if (current.length >= maxCompareFunds) {
        return [...current.slice(1), symbol];
      }

      return [...current, symbol];
    });
  }

  function markTrackerEdited() {
    trackerHasUserEditsRef.current = true;
  }

  function toggleWatchSelected() {
    if (!selected.symbol) {
      return;
    }

    markTrackerEdited();

    setTrackerState((current) => {
      if (current.watchlist.includes(selected.symbol)) {
        return {
          ...current,
          watchlist: current.watchlist.filter((symbol) => symbol !== selected.symbol),
          alerts: current.alerts.filter((alert) => alert.symbol !== selected.symbol)
        };
      }

      const priceCad = toCadPrice(getDisplayPrice(selected), selected);

      return {
        ...current,
        watchlist: [...current.watchlist, selected.symbol],
        alerts: current.alerts.some((alert) => alert.symbol === selected.symbol)
          ? current.alerts
          : [...current.alerts, createDefaultWatchAlert(selected, priceCad)]
      };
    });
  }

  function trackInstrument(instrument: InstrumentDetail) {
    if (!instrument.symbol) {
      return;
    }

    selectInstrument(instrument);
    markTrackerEdited();

    setTrackerState((current) => {
      const watchlist = current.watchlist.includes(instrument.symbol)
        ? current.watchlist
        : [...current.watchlist, instrument.symbol];
      const alerts = current.alerts.some((alert) => alert.symbol === instrument.symbol)
        ? current.alerts
        : [...current.alerts, createDefaultWatchAlert(instrument, toCadPrice(getDisplayPrice(instrument), instrument))];

      return {
        ...current,
        watchlist,
        alerts
      };
    });
  }

  function toggleSelectedPosition() {
    if (!selected.symbol) {
      return;
    }

    markTrackerEdited();

    setTrackerState((current) => {
      if (current.positions.some((position) => position.symbol === selected.symbol)) {
        return {
          ...current,
          positions: current.positions.filter((position) => position.symbol !== selected.symbol)
        };
      }

      const priceCad = toCadPrice(getDisplayPrice(selected), selected);
      const watchlist = current.watchlist.includes(selected.symbol)
        ? current.watchlist
        : [...current.watchlist, selected.symbol];
      const alerts = current.alerts.some((alert) => alert.symbol === selected.symbol)
        ? current.alerts
        : [...current.alerts, createDefaultWatchAlert(selected, priceCad)];

      return {
        ...current,
        watchlist,
        alerts,
        positions: [...current.positions, createDefaultPosition(selected, priceCad)]
      };
    });
  }

  function updatePosition(symbol: string, patch: Partial<Pick<TrackerPosition, "shares" | "averageCostCad" | "notes">>) {
    markTrackerEdited();

    setTrackerState((current) => ({
      ...current,
      positions: current.positions.map((position) =>
        position.symbol === symbol
          ? {
              ...position,
              ...patch,
              shares:
                typeof patch.shares === "number"
                  ? clamp(Number(patch.shares.toFixed(4)), 0, 1_000_000)
                  : position.shares,
              averageCostCad:
                typeof patch.averageCostCad === "number"
                  ? clamp(Number(patch.averageCostCad.toFixed(2)), 0, 10_000_000)
                  : position.averageCostCad
            }
          : position
      )
    }));
  }

  function removePosition(symbol: string) {
    markTrackerEdited();

    setTrackerState((current) => ({
      ...current,
      positions: current.positions.filter((position) => position.symbol !== symbol)
    }));
  }

  function updateAlert(symbol: string, patch: Partial<Pick<WatchAlert, "lowTargetCad" | "highTargetCad">>) {
    markTrackerEdited();

    setTrackerState((current) => {
      const existingAlert = current.alerts.find((alert) => alert.symbol === symbol);
      const instrument = instrumentBySymbol.get(symbol) ?? selected;
      const defaultAlert = createDefaultWatchAlert(instrument, toCadPrice(instrument.price, instrument));
      const nextAlert = {
        ...(existingAlert ?? defaultAlert),
        symbol,
        ...patch
      };
      const alerts = existingAlert
        ? current.alerts.map((alert) => (alert.symbol === symbol ? nextAlert : alert))
        : [...current.alerts, nextAlert];
      const watchlist = current.watchlist.includes(symbol) ? current.watchlist : [...current.watchlist, symbol];

      return {
        ...current,
        watchlist,
        alerts
      };
    });
  }

  function resetTracker() {
    markTrackerEdited();
    setTrackerState(createDefaultTrackerState());
    setCompareSymbols([...coreCompareSymbols]);
  }

  function selectSymbolFromTracker(symbol: string) {
    if (!symbol) {
      return;
    }

    const instrument = instrumentBySymbol.get(symbol);

    if (instrument) {
      handleSelect(instrument);
      return;
    }

    selectInstrument({
      ...emptyInstrument,
      symbol,
      name: symbol,
      focus: `Loading ${symbol} from the market data provider.`,
      summary: "Live quote and history are loading for this symbol."
    });
  }

  function scrollToTrackerAlerts() {
    document.getElementById("tracker-alerts")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen overflow-x-hidden px-4 py-4 text-foreground sm:px-6 lg:px-8 lg:pb-28">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
          <header className="finance-shell z-30 rounded-lg border border-border bg-card/92 p-3 backdrop-blur-xl lg:sticky lg:top-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                  <CandlestickChart className="size-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">Advanced Stock Stalker</h1>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Search stocks, compare funds, read news, and keep the chart front and center.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 basis-full sm:basis-auto sm:w-[390px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleSearch();
                      }
                    }}
                    placeholder="Search any ticker, like VOO or XEQT..."
                    aria-label="Search instruments"
                    className="pl-9"
                  />
                </div>
                <Button className="min-w-[140px] flex-1 sm:flex-none" onClick={() => void handleSearch()} disabled={isSearching}>
                  {isSearching ? <RefreshCw className="animate-spin" /> : <Search />}
                  Search
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Watch alerts" onClick={scrollToTrackerAlerts}>
                      <Bell />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Watch alerts</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={themeMode === "dark" ? "Use light mode" : "Use dark mode"}
                      onClick={() => setThemeMode((mode) => (mode === "dark" ? "light" : "dark"))}
                    >
                      {themeMode === "dark" ? <Sun /> : <Moon />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{themeMode === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </header>

          <WorkspaceControls
            chartSize={chartSize}
            setChartSize={setChartSize}
            panels={panelStates}
            onPanelVisibilityChange={setPanelVisibility}
            isReady={isWorkspaceReady}
          />

          <section className={cn("workspace-grid grid gap-4", chartSize === "Max" && "max-chart")} style={workspaceStyle}>
            <div className="flex min-w-0 flex-col gap-4">
              <Card className="finance-card overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <InstrumentLogo instrument={selected} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {hasSelectedInstrument ? (
                            <>
                              <span>{selected.exchange || selected.type}</span>
                              <span aria-hidden="true">-</span>
                              <span className="font-mono">{selected.symbol}</span>
                              {selected.benchmark ? (
                                <>
                                  <span aria-hidden="true">-</span>
                                  <span>{selected.benchmark}</span>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <span>No stock loaded</span>
                          )}
                        </div>
                        <CardTitle className="mt-1 max-w-[920px] break-words text-2xl leading-tight sm:text-3xl xl:text-4xl">
                          {hasSelectedInstrument ? selected.name : "Search a ticker to start"}
                        </CardTitle>
                        <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-2">
                          <span className="text-5xl font-normal leading-none tracking-normal text-foreground">
                            {hasSelectedInstrument && selectedDisplayPrice > 0
                              ? formatCurrency(selectedDisplayPrice).replace("$", "")
                              : "n/a"}
                          </span>
                          <span className="pb-1 text-base text-muted-foreground">
                            {hasSelectedInstrument ? selectedDisplayCurrency : ""}
                          </span>
                          {hasSelectedInstrument ? <ChangePill value={selected.changePercent} large /> : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {hasSelectedInstrument
                            ? `${getCadPriceNote(selected)} - Data window ${marketSignal.dataWindowLabel}`
                            : "Use search, then add stocks into the bottom tracking slots."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 2xl:shrink-0 2xl:items-end">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant={isSelectedWatched ? "secondary" : "outline"}
                          onClick={toggleWatchSelected}
                          aria-pressed={isSelectedWatched}
                          disabled={!hasSelectedInstrument}
                          data-testid="selected-watch-toggle"
                        >
                          {isSelectedWatched ? <Check /> : <Bell />}
                          {isSelectedWatched ? "Watched" : "Watch"}
                        </Button>
                        <Button
                          type="button"
                          variant={selectedPosition ? "secondary" : "outline"}
                          onClick={toggleSelectedPosition}
                          aria-pressed={Boolean(selectedPosition)}
                          disabled={!hasSelectedInstrument}
                          data-testid="selected-position-toggle"
                        >
                          {selectedPosition ? <Check /> : <CircleDollarSign />}
                          {selectedPosition ? "Position" : "Track Position"}
                        </Button>
                        <Button
                          variant={hasSelectedInstrument && compareSymbols.includes(selected.symbol) ? "secondary" : "outline"}
                          onClick={() => toggleCompare(selected.symbol)}
                          aria-pressed={hasSelectedInstrument && compareSymbols.includes(selected.symbol)}
                          disabled={!hasSelectedInstrument}
                        >
                          {hasSelectedInstrument && compareSymbols.includes(selected.symbol) ? <Check /> : <Plus />}
                          {hasSelectedInstrument && compareSymbols.includes(selected.symbol) ? "In compare" : "Add to compare"}
                        </Button>
                        <Button onClick={handleAssess} disabled={!hasSelectedInstrument || isAssessing} aria-busy={isAssessing}>
                          {isAssessing ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                          {isAssessing ? "Assessing" : "Assess"}
                        </Button>
                      </div>
                      {hasSelectedInstrument && nextCompareReplacement ? (
                        <p className="text-xs text-muted-foreground">Next add replaces {nextCompareReplacement}.</p>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={cn("chart-detail-grid grid gap-3", metricsVisible && "has-metrics")}>
                    <ChartTerminal
                      instrument={selected}
                      benchmark={showBenchmark ? selectedBenchmark : undefined}
                      range={chartRange}
                      style={chartStyle}
                      scale={chartScale}
                      showVolume={showVolume}
                      showMovingAverage={showMovingAverage}
                      showBenchmark={showBenchmark}
                      showGrid={showGrid}
                      showCrosshair={showCrosshair}
                      size={chartSize}
                      autoRefresh={autoRefresh}
                      isHydrating={isHydratingDetail}
                      lastHydratedAt={lastHydratedAt}
                      onRangeChange={setChartRange}
                      onStyleChange={setChartStyle}
                      onScaleChange={setChartScale}
                      onToggleSettings={() => setShowChartSettings((value) => !value)}
                    />

                    {metricsVisible ? (
                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                      <Metric label="Expense" value={selected.expenseRatio ? formatPercent(selected.expenseRatio) : "n/a"} compact />
                      <Metric label="Yield" value={selected.dividendYield ? formatPercent(selected.dividendYield) : "n/a"} compact />
                      <Metric label="AUM" value={selected.aum ? formatCompactCurrency(selected.aum) : "n/a"} compact />
                      <Metric label="Volatility" value={formatPercent(selected.volatility)} compact />
                    </div>
                    ) : null}
                  </div>
                  {detailError ? (
                    <div className="mt-3">
                      <StateNotice icon={<CircleAlert />} title="Detail fallback" tone="warning">
                        {detailError} The current chart remains available.
                      </StateNotice>
                    </div>
                  ) : null}
                  {showChartSettings ? (
                    <ChartSettingsPanel
                      chartSize={chartSize}
                      setChartSize={setChartSize}
                      chartScale={chartScale}
                      setChartScale={setChartScale}
                      showVolume={showVolume}
                      setShowVolume={setShowVolume}
                      showMovingAverage={showMovingAverage}
                      setShowMovingAverage={setShowMovingAverage}
                      showBenchmark={showBenchmark}
                      setShowBenchmark={setShowBenchmark}
                      showGrid={showGrid}
                      setShowGrid={setShowGrid}
                      showCrosshair={showCrosshair}
                      setShowCrosshair={setShowCrosshair}
                      autoRefresh={autoRefresh}
                      setAutoRefresh={setAutoRefresh}
                      refreshIntervalMs={refreshIntervalMs}
                      setRefreshIntervalMs={setRefreshIntervalMs}
                    />
                  ) : null}
                  {hasSelectedInstrument ? (
                    <AboutInstrumentStrip
                      instrument={selected}
                      expanded={isAboutExpanded}
                      onExpandedChange={setIsAboutExpanded}
                    />
                  ) : null}
                  {hasSelectedInstrument && showIndexLens ? (
                  <div className="mt-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Info className="size-4 text-primary" />
                        Fund Basics
                      </div>
                      <Badge variant={selected.type === "ETF" ? "default" : "outline"}>{selected.type}</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {indexInsights.map((insight) => (
                        <IndexInsightTile key={insight.label} insight={insight} />
                      ))}
                    </div>
                  </div>
                  ) : null}
                </CardContent>
              </Card>

              <TrackerCommandCenter
                selected={selected}
                selectedPosition={selectedPosition}
                selectedAlert={selectedAlert}
                selectedIsWatched={isSelectedWatched}
                portfolio={portfolioAnalytics}
                watchAlerts={watchAlertRows}
                isHydrated={isLocalStateHydrated}
                persistenceStatus={trackerPersistence}
                lastSavedAt={trackerLastSavedAt}
                onToggleWatch={toggleWatchSelected}
                onTogglePosition={toggleSelectedPosition}
                onUpdatePosition={updatePosition}
                onRemovePosition={removePosition}
                onUpdateAlert={updateAlert}
                onSelectSymbol={selectSymbolFromTracker}
                onReset={resetTracker}
              />

              {comparisonVisible ? (
              <Card className="focus-rail">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Compare Funds</CardTitle>
                      <CardDescription>Fees, yield, size, risk, and top exposure.</CardDescription>
                    </div>
                    <Badge variant="secondary">{compareFunds.length} selected</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 rounded-md border border-border bg-background/35 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                          <SlidersHorizontal className="size-4" />
                        </span>
                        <div>
                          <div className="text-sm font-medium text-foreground">Compare Set</div>
                          <p className="text-xs text-muted-foreground">
                            {compareSymbols.length}/{maxCompareFunds} slots
                            {compareSymbols.length >= maxCompareFunds ? `, next add replaces ${compareSymbols[0]}` : ""}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCompareSymbols([...coreCompareSymbols])}
                      >
                        <RefreshCw />
                        Core set
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {compareCandidates.map((fund) => {
                        const isSelected = compareSymbols.includes(fund.symbol);

                        return (
                          <Button
                            key={fund.symbol}
                            type="button"
                            variant={isSelected ? "secondary" : "outline"}
                            size="sm"
                            aria-pressed={isSelected}
                            className={cn(
                              "h-8 px-2.5",
                              isSelected && "border-primary/30 bg-primary/12 text-primary hover:bg-primary/18"
                            )}
                            onClick={() => toggleCompare(fund.symbol)}
                          >
                            {isSelected ? <Check /> : <Plus />}
                            <span className="font-mono">{fund.symbol}</span>
                            {isSelected ? <X className="opacity-65" /> : null}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {compareFunds.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[840px] border-separate border-spacing-y-2 text-sm">
                        <thead className="text-left text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Fund</th>
                            <th className="px-3 py-2 font-medium">Focus</th>
                            <th className="px-3 py-2 font-medium">Expense</th>
                            <th className="px-3 py-2 font-medium">Yield</th>
                            <th className="px-3 py-2 font-medium">AUM</th>
                            <th className="px-3 py-2 font-medium">Max DD</th>
                            <th className="px-3 py-2 font-medium">Top Exposure</th>
                            <th className="px-3 py-2 text-right font-medium">Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compareFunds.map((fund) => (
                            <tr key={fund.symbol} className="rounded-md bg-secondary/45">
                              <td className="rounded-l-md px-3 py-3 font-mono font-semibold">{fund.symbol}</td>
                              <td className="max-w-[280px] px-3 py-3 text-muted-foreground">{fund.focus}</td>
                              <td className="px-3 py-3">{fund.expenseRatio ? formatPercent(fund.expenseRatio) : "n/a"}</td>
                              <td className="px-3 py-3">{fund.dividendYield ? formatPercent(fund.dividendYield) : "n/a"}</td>
                              <td className="px-3 py-3">{fund.aum ? formatCompactCurrency(fund.aum) : "n/a"}</td>
                              <td className="px-3 py-3 text-red-700 dark:text-red-200">{formatPercent(fund.maxDrawdown)}</td>
                              <td className="px-3 py-3">
                                <AllocationBar label={fund.sectors[0]?.label ?? "n/a"} value={fund.sectors[0]?.weight ?? 0} />
                              </td>
                              <td className="rounded-r-md px-3 py-3 text-right">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-8"
                                      aria-label={`Remove ${fund.symbol} from comparison`}
                                      onClick={() => toggleCompare(fund.symbol)}
                                    >
                                      <X />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove {fund.symbol}</TooltipContent>
                                </Tooltip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Layers3 />}
                      title="No funds selected"
                      description="Choose ETFs above to compare them."
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setCompareSymbols([...coreCompareSymbols])}
                      >
                        <RefreshCw />
                        Restore core set
                      </Button>
                    </EmptyState>
                  )}
                </CardContent>
              </Card>
              ) : null}
            </div>

            {researchRailVisible ? (
              <ResizeHandle
                label="quick take"
                value={researchWidth}
                min={300}
                max={520}
                invert
                onChange={setResearchWidth}
              />
            ) : null}

            {researchRailVisible ? (
            <div className="flex min-w-0 flex-col gap-4">
              <Card className="finance-card border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Quick Take</CardTitle>
                      <CardDescription>News plus a plain-English view.</CardDescription>
                    </div>
                    <DirectionBadge direction={marketSignal.direction} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isAssessing ? (
                    <StateNotice icon={<RefreshCw className="animate-spin" />} title="Checking news" tone="primary">
                      Updating the quick take for {selected.symbol}.
                    </StateNotice>
                  ) : null}

                  {assessmentError ? (
                    <StateNotice icon={<CircleAlert />} title="Could not refresh" tone="warning">
                      {assessmentError} The last quick take is still visible.
                    </StateNotice>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Confidence" value={formatPercent(marketSignal.confidence)} icon={<Gauge />} />
                    <Metric label="Window" value={marketSignal.timeHorizon} icon={<Radar />} />
                  </div>
                  <div className="rounded-md border border-border bg-secondary/45 p-3">
                    <div className="mb-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <SignalMiniStat label="Trend" value={formatPercent(marketSignal.trendReturn, { signed: true })} />
                      <SignalMiniStat label="Volatility" value={formatPercent(marketSignal.realizedVolatility)} />
                      <SignalMiniStat label="Coverage" value={marketSignal.dataWindowLabel} />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                    {assessment.summary}
                    </p>
                  </div>
                  {hasSelectedInstrument ? (
                    <Tabs defaultValue="bull">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="bull">Bull</TabsTrigger>
                        <TabsTrigger value="bear">Bear</TabsTrigger>
                        <TabsTrigger value="risk">Risks</TabsTrigger>
                      </TabsList>
                      <TabsContent value="bull">
                        <ThesisList items={assessment.bullCase} tone="green" />
                      </TabsContent>
                      <TabsContent value="bear">
                        <ThesisList items={assessment.bearCase} tone="red" />
                      </TabsContent>
                      <TabsContent value="risk">
                        <ThesisList items={assessment.keyRisks} tone="amber" />
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <EmptyState
                      icon={<Search />}
                      title="No quick take yet"
                      description="Search a ticker to calculate confidence, window, and thesis notes."
                    />
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">{assessment.notInvestmentAdvice}</p>
                </CardContent>
              </Card>

              <Card className="focus-rail">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle>Recent News</CardTitle>
                      <CardDescription>Articles used for the quick take.</CardDescription>
                    </div>
                    <Activity className="size-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {assessment.citations.length ? (
                  assessment.citations.map((article) => (
                    <a
                      key={`${article.title}-${article.url}`}
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-md border border-border bg-background/35 p-3 transition hover:border-primary/40 hover:bg-primary/7"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="outline">{article.source}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(article.publishedAt)}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium leading-5">{article.title}</p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{article.snippet}</p>
                    </a>
                  ))
                  ) : (
                    <EmptyState icon={<Activity />} title="No articles loaded" description="Search a ticker to show related news." />
                  )}
                </CardContent>
              </Card>
            </div>
            ) : null}
          </section>

          {prospectsVisible ? (
            <StockSlotBar
              results={results}
              watchAlerts={watchAlertRows}
              selectedSymbol={selected.symbol}
              isSearching={isSearching}
              searchError={searchError}
              lastSearchQuery={lastSearchQuery}
              onSelectInstrument={handleSelect}
              onTrackInstrument={trackInstrument}
              onSelectSymbol={selectSymbolFromTracker}
              onFocusSearch={() => searchInputRef.current?.focus()}
            />
          ) : null}

          {exposurePanelsVisible ? (
          <section className="grid gap-4 lg:grid-cols-3">
            <ExposurePanel title="Sector Exposure" icon={<Zap />} exposures={selected.sectors} />
            <ExposurePanel title="Region Exposure" icon={<ShieldCheck />} exposures={selected.regions} />
            <Card className="focus-rail">
              <CardHeader>
                <CardTitle>Top Holdings</CardTitle>
                <CardDescription>Biggest positions in the selected fund.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selected.holdings.length ? (
                  selected.holdings.map((holding) => (
                    <AllocationBar
                      key={holding.symbol}
                      label={`${holding.symbol} - ${holding.name}`}
                      value={holding.weight}
                    />
                  ))
                ) : (
                  <p className="rounded-md border border-border bg-secondary/35 p-3 text-sm text-muted-foreground">
                    This is a single stock. Fund holdings appear when you pick an ETF.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
          ) : null}
        </div>
      </main>
    </TooltipProvider>
  );
}

type InsightTone = "primary" | "green" | "amber" | "magenta";

type IndexInsight = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: InsightTone;
};

type MarketSignal = {
  direction: Assessment["direction"];
  confidence: number;
  timeHorizon: string;
  dataWindowLabel: string;
  trendReturn: number;
  realizedVolatility: number;
};

function WorkspaceControls({
  chartSize,
  setChartSize,
  panels,
  onPanelVisibilityChange,
  isReady
}: {
  chartSize: ChartSize;
  setChartSize: (size: ChartSize) => void;
  panels: WorkspacePanel[];
  onPanelVisibilityChange: (panelId: WorkspacePanelId, visible: boolean) => void;
  isReady: boolean;
}) {
  const visiblePanels = panels.filter((panel) => panel.visible);
  const hiddenPanels = panels.filter((panel) => !panel.visible);
  const [draggedPanel, setDraggedPanel] = useState<WorkspacePanelId | null>(null);

  function handleDragStart(event: DragEvent<HTMLButtonElement>, panelId: WorkspacePanelId) {
    setDraggedPanel(panelId);
    event.dataTransfer.setData("application/x-stock-panel", panelId);
    event.dataTransfer.setData("text/plain", panelId);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, visible: boolean) {
    event.preventDefault();
    const panelId = event.dataTransfer.getData("application/x-stock-panel") || event.dataTransfer.getData("text/plain");

    if (isWorkspacePanelId(panelId)) {
      onPanelVisibilityChange(panelId, visible);
    }

    setDraggedPanel(null);
  }

  function handleDragEnd(event: DragEvent<HTMLButtonElement>, panelId: WorkspacePanelId) {
    const dropTarget = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-panel-dropzone]");
    const zone = dropTarget?.dataset.panelDropzone;

    if (zone === "visible" || zone === "hidden") {
      onPanelVisibilityChange(panelId, zone === "visible");
    }

    setDraggedPanel(null);
  }

  function handlePointerDrop(visible: boolean) {
    if (draggedPanel) {
      const currentPanel = panels.find((panel) => panel.id === draggedPanel);

      if (currentPanel?.visible === visible) {
        window.setTimeout(() => setDraggedPanel(null), 0);
        return;
      }

      onPanelVisibilityChange(draggedPanel, visible);
      setDraggedPanel(null);
    }
  }

  return (
    <div
      className="dock-bar focus-rail rounded-lg border border-border bg-card/85 px-3 py-2 backdrop-blur-xl"
      data-ready={isReady ? "true" : "false"}
      data-testid="workspace-layout"
      suppressHydrationWarning
    >
      <div className="flex h-12 items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap pr-1">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
          <Layers3 className="size-4" />
        </span>
        <span className="shrink-0 text-sm font-medium">Layout</span>
        <div className="flex shrink-0 items-center gap-1">
          {chartSizes.map((size) => (
            <Button
              key={size}
              type="button"
              variant={chartSize === size ? "secondary" : "outline"}
              size="sm"
              aria-pressed={chartSize === size}
              data-testid={`workspace-size-${size.toLowerCase()}`}
              onClick={() => setChartSize(size)}
            >
              {size}
            </Button>
          ))}
        </div>

        <PanelDropZone
          label="On"
          panels={visiblePanels}
          visible
          onDropPanel={handleDrop}
          onPanelVisibilityChange={onPanelVisibilityChange}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onPointerDrop={handlePointerDrop}
          onBeginDrag={setDraggedPanel}
        />
        <PanelDropZone
          label="Hidden"
          panels={hiddenPanels}
          visible={false}
          onDropPanel={handleDrop}
          onPanelVisibilityChange={onPanelVisibilityChange}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onPointerDrop={handlePointerDrop}
          onBeginDrag={setDraggedPanel}
        />
      </div>
    </div>
  );
}

function PanelDropZone({
  label,
  panels,
  visible,
  onDropPanel,
  onPanelVisibilityChange,
  onDragStart,
  onDragEnd,
  onPointerDrop,
  onBeginDrag
}: {
  label: string;
  panels: WorkspacePanel[];
  visible: boolean;
  onDropPanel: (event: DragEvent<HTMLDivElement>, visible: boolean) => void;
  onPanelVisibilityChange: (panelId: WorkspacePanelId, visible: boolean) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, panelId: WorkspacePanelId) => void;
  onDragEnd: (event: DragEvent<HTMLButtonElement>, panelId: WorkspacePanelId) => void;
  onPointerDrop: (visible: boolean) => void;
  onBeginDrag: (panelId: WorkspacePanelId | null) => void;
}) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-1 rounded-md border px-2",
        visible
          ? "border-primary/20 bg-primary/6"
          : "border-dashed border-zinc-400/45 bg-zinc-100 text-zinc-950 dark:bg-zinc-200 dark:text-zinc-950"
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDropPanel(event, visible)}
      onPointerUp={() => onPointerDrop(visible)}
      data-panel-dropzone={visible ? "visible" : "hidden"}
      data-testid={visible ? "visible-panel-dock" : "hidden-panel-dock"}
    >
      <span className={cn("text-xs font-medium", visible ? "text-muted-foreground" : "text-zinc-950")}>{label}</span>
      {panels.length ? (
        panels.map((panel) => (
          <PanelDockChip
            key={panel.id}
            panel={panel}
            visible={visible}
            onVisibilityChange={onPanelVisibilityChange}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onBeginDrag={onBeginDrag}
          />
        ))
      ) : (
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs",
            visible ? "border-border text-muted-foreground" : "border-zinc-400/60 text-zinc-950"
          )}
        >
          drop here
        </span>
      )}
    </div>
  );
}

function PanelDockChip({
  panel,
  visible,
  onVisibilityChange,
  onDragStart,
  onDragEnd,
  onBeginDrag
}: {
  panel: WorkspacePanel;
  visible: boolean;
  onVisibilityChange: (panelId: WorkspacePanelId, visible: boolean) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, panelId: WorkspacePanelId) => void;
  onDragEnd: (event: DragEvent<HTMLButtonElement>, panelId: WorkspacePanelId) => void;
  onBeginDrag: (panelId: WorkspacePanelId | null) => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        const startX = event.clientX;
        const startY = event.clientY;
        const handlePointerUp = (pointerEvent: PointerEvent) => {
          const distance = Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY);
          const dropTarget = document
            .elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
            ?.closest<HTMLElement>("[data-panel-dropzone]");
          const zone = dropTarget?.dataset.panelDropzone;

          pointerEvent.stopPropagation();
          onBeginDrag(null);

          if (distance > 8 && (zone === "visible" || zone === "hidden")) {
            onVisibilityChange(panel.id, zone === "visible");
            return;
          }

          if (distance <= 8) {
            onVisibilityChange(panel.id, !visible);
          }
        };

        onBeginDrag(panel.id);
        window.addEventListener("pointerup", handlePointerUp, { capture: true, once: true });
      }}
      onDragStart={(event) => onDragStart(event, panel.id)}
      onDragEnd={(event) => onDragEnd(event, panel.id)}
      onClick={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onVisibilityChange(panel.id, !visible);
        }
      }}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition",
        visible
          ? "border-primary/30 bg-primary/10 text-foreground hover:bg-primary/16"
          : "border-zinc-400/55 bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
      )}
      aria-pressed={visible}
      data-testid={`panel-chip-${panel.id}`}
    >
      {visible ? <Check className="size-3" /> : <Plus className="size-3" />}
      {panel.label}
    </button>
  );
}

function ResizeHandle({
  label,
  value,
  min,
  max,
  invert = false,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  invert?: boolean;
  onChange: (value: number) => void;
}) {
  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startValue = value;

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const delta = pointerEvent.clientX - startX;
      const nextValue = startValue + (invert ? -delta : delta);

      onChange(clamp(Math.round(nextValue / 10) * 10, min, max));
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  return (
    <button
      type="button"
      aria-label={`Resize ${label} panel`}
      className="group hidden min-h-[220px] cursor-col-resize items-stretch justify-center rounded-md border border-transparent bg-transparent transition hover:border-primary/30 hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
      onPointerDown={handlePointerDown}
    >
      <span className="my-3 w-1 rounded-full bg-border transition group-hover:bg-primary" />
    </button>
  );
}

function isWorkspacePanelId(value: string): value is WorkspacePanelId {
  return workspacePanels.some((panel) => panel.id === value);
}

function mergeInstrumentUniverse(groups: InstrumentDetail[][]) {
  const bySymbol = new Map<string, InstrumentDetail>();

  for (const group of groups) {
    for (const instrument of group) {
      bySymbol.set(instrument.symbol, instrument);
    }
  }

  return [...bySymbol.values()];
}

function readJsonFromStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as unknown) : null;
  } catch {
    return null;
  }
}

function writeJsonToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private contexts; the in-memory tracker still works.
  }
}

function getOrCreateTrackerClientId() {
  const storedClientId = readStringFromStorage(trackerClientStorageKey);

  if (storedClientId && /^[A-Za-z0-9_-]{12,96}$/.test(storedClientId)) {
    return storedClientId;
  }

  const nextClientId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tracker_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;

  writeStringToStorage(trackerClientStorageKey, nextClientId);

  return nextClientId;
}

function readStringFromStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStringToStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The app can keep working in memory if browser storage is blocked.
  }
}

function searchLocalInstruments(query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
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
    .slice(0, 8);
}

function buildIndexInsights(instrument: InstrumentDetail): IndexInsight[] {
  const expenseCost = typeof instrument.expenseRatio === "number" ? instrument.expenseRatio * 10_000 : null;
  const topHoldingsWeight = instrument.holdings.reduce((total, holding) => total + holding.weight, 0);
  const primaryHolding = instrument.holdings[0];
  const primaryRegion = instrument.regions[0];
  const primarySector = instrument.sectors[0];
  const role = getPortfolioRole(instrument);

  return [
    {
      label: "Annual Cost",
      value: expenseCost === null ? "n/a" : `${formatCurrency(expenseCost)} / $10k`,
      detail:
        typeof instrument.expenseRatio === "number"
          ? `${formatPercent(instrument.expenseRatio)} expense ratio on the selected fund.`
          : "No fund expense ratio on this record.",
      icon: <CircleDollarSign />,
      tone:
        typeof instrument.expenseRatio !== "number"
          ? "amber"
          : instrument.expenseRatio <= 0.001
            ? "green"
            : "primary"
    },
    {
      label: "Top-5 Weight",
      value: instrument.holdings.length ? formatPercent(topHoldingsWeight) : "Single name",
      detail: primaryHolding
        ? `${primaryHolding.symbol} leads listed holdings at ${formatPercent(primaryHolding.weight)}.`
        : "Fund holdings appear when an ETF or index fund is selected.",
      icon: <ChartPie />,
      tone: instrument.holdings.length && topHoldingsWeight < 0.28 ? "green" : "amber"
    },
    {
      label: "Benchmark Fit",
      value: instrument.benchmark ?? instrument.type,
      detail:
        typeof instrument.trackingError === "number"
          ? `${formatPercent(instrument.trackingError)} tracking error; ${primaryRegion?.label ?? "region"} leads exposure.`
          : `${primarySector?.label ?? "Primary"} exposure leads this profile.`,
      icon: <Target />,
      tone:
        typeof instrument.trackingError !== "number"
          ? "amber"
          : instrument.trackingError <= 0.002
            ? "green"
            : "primary"
    },
    {
      label: "Portfolio Role",
      value: role.label,
      detail: `Beta ${instrument.beta.toFixed(2)}, volatility ${formatPercent(
        instrument.volatility
      )}, max drawdown ${formatPercent(instrument.maxDrawdown)}.`,
      icon: <Landmark />,
      tone: role.tone
    }
  ];
}

function getPortfolioRole(instrument: InstrumentDetail): { label: string; tone: InsightTone } {
  if (instrument.beta <= 0.3) {
    return { label: "Ballast", tone: "green" };
  }

  if (instrument.beta >= 1.15 || instrument.volatility >= 0.2) {
    return { label: "Satellite", tone: "amber" };
  }

  if (instrument.type === "ETF") {
    return { label: "Core", tone: "primary" };
  }

  return { label: "Single-name", tone: "magenta" };
}

function buildMarketSignal(instrument: InstrumentDetail): MarketSignal {
  if (!instrument.symbol) {
    return {
      direction: "uncertain",
      confidence: 0,
      timeHorizon: "No symbol",
      dataWindowLabel: "No data",
      trendReturn: 0,
      realizedVolatility: 0
    };
  }

  const normalizedPoints = normalizeHistoricalChartPoints(instrument);
  const points = normalizedPoints.length >= 8 ? normalizedPoints : buildChartPoints(instrument, "1Y");
  const sample = points.slice(-Math.min(points.length, 252));
  const returns = dailyReturns(sample);
  const annualizedVolatility = calculateAnnualizedVolatility(returns);
  const recentReturn = periodReturn(sample, 21);
  const intermediateReturn = periodReturn(sample, 63);
  const longReturn = periodReturn(sample, Math.min(126, sample.length - 1));
  const trendReturn = recentReturn * 0.5 + intermediateReturn * 0.32 + longReturn * 0.18;
  const trendSign = Math.sign(trendReturn);
  const trendStrength = clamp(Math.abs(trendReturn) / Math.max(annualizedVolatility * 0.42, 0.025), 0, 1);
  const consistency =
    trendSign === 0 || returns.length === 0
      ? 0.4
      : returns.filter((value) => Math.sign(value) === trendSign || Math.abs(value) < 0.001).length / returns.length;
  const agreement =
    Math.sign(recentReturn) === Math.sign(intermediateReturn) && Math.sign(intermediateReturn) === Math.sign(longReturn)
      ? 1
      : Math.sign(recentReturn) === Math.sign(intermediateReturn)
        ? 0.68
        : 0.32;
  const volatilityScore = 1 - clamp(annualizedVolatility / 0.7, 0, 1);
  const drawdownScore = 1 - clamp(Math.abs(maxDrawdown(sample)) / 0.45, 0, 1);
  const coverageScore = clamp((sample.length - 8) / 244, 0, 1);
  const rawConfidence =
    0.24 +
    trendStrength * 0.25 +
    consistency * 0.18 +
    agreement * 0.12 +
    volatilityScore * 0.1 +
    drawdownScore * 0.06 +
    coverageScore * 0.05;
  const direction =
    sample.length < 12
      ? "uncertain"
      : trendStrength < 0.18
        ? "sideways"
        : trendReturn > 0
          ? "up"
          : "down";
  const maxConfidence = direction === "up" || direction === "down" ? 0.78 : 0.66;

  return {
    direction,
    confidence: Number(clamp(rawConfidence, 0.28, maxConfidence).toFixed(2)),
    timeHorizon: chooseSignalWindow(sample.length, annualizedVolatility, trendStrength, consistency),
    dataWindowLabel: formatSignalDataWindow(sample),
    trendReturn,
    realizedVolatility: annualizedVolatility
  };
}

function dailyReturns(points: ChartPoint[]) {
  return points.slice(1).map((point, index) => {
    const previous = points[index]?.close ?? point.close;

    return previous > 0 ? (point.close - previous) / previous : 0;
  });
}

function calculateAnnualizedVolatility(returns: number[]) {
  if (returns.length < 2) {
    return 0;
  }

  const average = returns.reduce((total, value) => total + value, 0) / returns.length;
  const variance = returns.reduce((total, value) => total + (value - average) ** 2, 0) / (returns.length - 1);

  return Math.sqrt(variance) * Math.sqrt(252);
}

function periodReturn(points: ChartPoint[], lookback: number) {
  if (points.length < 2) {
    return 0;
  }

  const end = points.at(-1)?.close ?? 0;
  const startIndex = Math.max(points.length - 1 - lookback, 0);
  const start = points[startIndex]?.close ?? end;

  return start > 0 ? (end - start) / start : 0;
}

function maxDrawdown(points: ChartPoint[]) {
  let peak = points[0]?.close ?? 0;
  let worst = 0;

  for (const point of points) {
    peak = Math.max(peak, point.close);
    worst = Math.min(worst, peak > 0 ? (point.close - peak) / peak : 0);
  }

  return worst;
}

function chooseSignalWindow(pointCount: number, volatility: number, trendStrength: number, consistency: number) {
  if (pointCount < 20) {
    return "5-10 days";
  }

  if (volatility >= 0.46 || trendStrength >= 0.78) {
    return "1-3 weeks";
  }

  if (trendStrength >= 0.48 && consistency >= 0.56 && pointCount >= 126) {
    return "4-8 weeks";
  }

  return "2-6 weeks";
}

function formatSignalDataWindow(points: ChartPoint[]) {
  if (!points.length) {
    return "No bars";
  }

  if (points.length < 30) {
    return `${points.length} bars`;
  }

  const first = points[0]?.date;
  const last = points.at(-1)?.date;
  const days = first && last ? Math.max(1, Math.round((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000))) : points.length;

  if (days >= 330) {
    return "1Y data";
  }

  if (days >= 120) {
    return "6M data";
  }

  if (days >= 55) {
    return "3M data";
  }

  return `${points.length} bars`;
}

function IndexInsightTile({ insight }: { insight: IndexInsight }) {
  const borderStyles = {
    primary: "border-primary/25 bg-primary/7",
    green: "border-emerald-300/25 bg-emerald-400/7",
    amber: "border-amber-300/25 bg-amber-400/8",
    magenta: "border-fuchsia-300/25 bg-fuchsia-400/8"
  };
  const iconStyles = {
    primary: "text-primary",
    green: "text-emerald-700 dark:text-emerald-200",
    amber: "text-amber-700 dark:text-amber-200",
    magenta: "text-fuchsia-700 dark:text-fuchsia-200"
  };

  return (
    <div className={cn("rounded-md border p-3", borderStyles[insight.tone])}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <span className={cn("[&_svg]:size-3.5", iconStyles[insight.tone])}>{insight.icon}</span>
        {insight.label}
      </div>
      <div className="mt-2 break-words text-lg font-semibold tracking-normal">{insight.value}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.detail}</p>
    </div>
  );
}

function InstrumentLogo({ instrument }: { instrument: InstrumentDetail }) {
  const letters = instrument.symbol.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase() || "ST";

  return (
    <div className="hidden size-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-xl font-semibold text-muted-foreground sm:flex">
      {letters}
    </div>
  );
}

function AboutInstrumentStrip({
  instrument,
  expanded,
  onExpandedChange
}: {
  instrument: InstrumentDetail;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  return (
    <div className={cn("mt-4 border border-border bg-secondary/45 px-4 py-3", expanded ? "rounded-xl" : "rounded-full")}>
      <div className={cn("flex gap-3", expanded ? "flex-col" : "items-center")}>
        <button
          type="button"
          className="inline-flex max-w-[52vw] shrink-0 items-center justify-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-foreground transition hover:bg-background sm:max-w-[360px]"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
        >
          <span className="truncate">{expanded ? "Less about" : "More about"} {instrument.name}</span>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <p className={cn("min-w-0 text-sm leading-6 text-muted-foreground", expanded ? "max-w-5xl" : "line-clamp-1 flex-1")}>
          {instrument.summary}
        </p>
      </div>
    </div>
  );
}

function SignalMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}

function StateNotice({
  icon,
  title,
  tone = "muted",
  children
}: {
  icon: ReactNode;
  title: string;
  tone?: "muted" | "primary" | "warning";
  children: ReactNode;
}) {
  const styles = {
    muted: "border-border bg-secondary/45 text-muted-foreground",
    primary: "border-primary/25 bg-primary/8 text-primary",
    warning: "border-amber-500/30 bg-amber-400/10 text-amber-700 dark:text-amber-100"
  };

  return (
    <div className={cn("flex gap-3 rounded-md border p-3", styles[tone])} role="status">
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  children
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background/30 p-4 text-center" role="status">
      <div className="mx-auto flex size-10 items-center justify-center rounded-md border border-border bg-secondary/60 text-primary [&_svg]:size-5">
        {icon}
      </div>
      <div className="mt-3 text-sm font-medium text-foreground">{title}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      {children ? <div className="mt-3 flex justify-center">{children}</div> : null}
    </div>
  );
}

function StockSlotBar({
  results,
  watchAlerts,
  selectedSymbol,
  isSearching,
  searchError,
  lastSearchQuery,
  onSelectInstrument,
  onTrackInstrument,
  onSelectSymbol,
  onFocusSearch
}: {
  results: InstrumentDetail[];
  watchAlerts: WatchAlertRow[];
  selectedSymbol: string;
  isSearching: boolean;
  searchError: string | null;
  lastSearchQuery: string;
  onSelectInstrument: (instrument: InstrumentDetail) => void;
  onTrackInstrument: (instrument: InstrumentDetail) => void;
  onSelectSymbol: (symbol: string) => void;
  onFocusSearch: () => void;
}) {
  const trackedRows = watchAlerts.slice(0, stockSlotCount);
  const emptySlotCount = Math.max(stockSlotCount - trackedRows.length, 0);

  return (
    <section
      className="stock-slot-bar focus-rail rounded-lg border border-border bg-card/94 p-2 backdrop-blur-xl lg:fixed lg:inset-x-8 lg:bottom-3 lg:z-40 lg:mx-auto lg:max-w-[1480px]"
      data-testid="stock-slot-bar"
    >
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div
          className={cn(
            "flex h-[64px] min-w-[136px] flex-col justify-center rounded-md border px-3",
            searchError ? "border-amber-500/30 bg-amber-400/10" : "border-primary/20 bg-primary/7"
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {searchError ? <CircleAlert className="size-4 text-amber-600 dark:text-amber-200" /> : <ListFilter className="size-4 text-primary" />}
            Stock Bar
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {isSearching ? "Searching" : searchError ? "Fallback results" : `${trackedRows.length} tracked`}
          </div>
        </div>

        {isSearching ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[64px] min-w-[154px] animate-pulse rounded-md border border-border bg-secondary/45 p-3"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="h-3 w-16 rounded bg-background/80" />
              <div className="mt-3 h-3 w-24 rounded bg-background/70" />
            </div>
          ))
        ) : results.length ? (
          results.map((instrument) => {
            const isSelected = selectedSymbol === instrument.symbol;

            return (
              <div
                key={instrument.symbol}
                className={cn(
                  "flex h-[64px] min-w-[210px] max-w-[240px] items-stretch gap-2 rounded-md border bg-background/45 p-2 transition",
                  isSelected ? "border-primary/55 bg-primary/10" : "border-border"
                )}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectInstrument(instrument)}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">{instrument.symbol}</span>
                    <Badge variant="outline">{instrument.type}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{instrument.name}</p>
                </button>
                <Button type="button" variant="secondary" size="sm" className="h-8 self-center" onClick={() => onTrackInstrument(instrument)}>
                  <Plus />
                  Add
                </Button>
              </div>
            );
          })
        ) : lastSearchQuery ? (
          <div className="flex h-[64px] min-w-[220px] items-center gap-2 rounded-md border border-dashed border-border bg-background/35 px-3 text-sm text-muted-foreground">
            <SearchX className="size-4 text-primary" />
            No matches for <span className="font-mono text-foreground">{lastSearchQuery}</span>.
          </div>
        ) : null}

        {trackedRows.map((row) => (
          <button
            type="button"
            key={row.symbol}
            onClick={() => onSelectSymbol(row.symbol)}
            className={cn(
              "h-[64px] min-w-[156px] rounded-md border p-2 text-left transition hover:border-primary/45 hover:bg-primary/7",
              selectedSymbol === row.symbol ? "border-primary/55 bg-primary/10" : "border-border bg-background/45"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-sm font-semibold text-foreground">{row.symbol}</div>
              <ChangePill value={row.instrument.changePercent} />
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{row.instrument.name}</p>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {row.priceCad > 0 ? formatCadCurrency(row.priceCad) : "No price"} CAD
            </div>
          </button>
        ))}

        {Array.from({ length: emptySlotCount }).map((_, index) => (
          <button
            type="button"
            key={`empty-${index}`}
            onClick={onFocusSearch}
            className="flex h-[64px] min-w-[132px] items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/35 px-3 text-sm text-muted-foreground transition hover:border-primary/45 hover:bg-primary/7 hover:text-foreground"
          >
            <Plus className="size-4" />
            Add stock
          </button>
        ))}
      </div>
    </section>
  );
}

function ChangePill({ value, large = false }: { value: number; large?: boolean }) {
  const positive = value >= 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs",
        large && "px-3 py-1.5 text-sm",
        positive
          ? "border-emerald-500/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200"
          : "border-red-500/30 bg-red-400/10 text-red-700 dark:text-red-200"
      )}
    >
      {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {formatPercent(value, { signed: true })}
    </span>
  );
}

function Metric({ label, value, icon, compact = false }: { label: string; value: string; icon?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn("rounded-md border border-border bg-secondary/45", compact ? "p-2" : "p-3")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon ? <span className="[&_svg]:size-3.5">{icon}</span> : null}
        {label}
      </div>
      <div className={cn("mt-1 font-semibold tracking-normal", compact ? "text-sm" : "text-lg")}>{value}</div>
    </div>
  );
}

function TooltipMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/45 px-2 py-1.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-[12px] text-foreground">{value}</div>
    </div>
  );
}

function TrackerCommandCenter({
  selected,
  selectedPosition,
  selectedAlert,
  selectedIsWatched,
  portfolio,
  watchAlerts,
  isHydrated,
  persistenceStatus,
  lastSavedAt,
  onToggleWatch,
  onTogglePosition,
  onUpdatePosition,
  onRemovePosition,
  onUpdateAlert,
  onSelectSymbol,
  onReset
}: {
  selected: InstrumentDetail;
  selectedPosition: TrackerPosition | null;
  selectedAlert: WatchAlert | null;
  selectedIsWatched: boolean;
  portfolio: PortfolioAnalytics;
  watchAlerts: WatchAlertRow[];
  isHydrated: boolean;
  persistenceStatus: TrackerPersistenceStatus;
  lastSavedAt: string | null;
  onToggleWatch: () => void;
  onTogglePosition: () => void;
  onUpdatePosition: (
    symbol: string,
    patch: Partial<Pick<TrackerPosition, "shares" | "averageCostCad" | "notes">>
  ) => void;
  onRemovePosition: (symbol: string) => void;
  onUpdateAlert: (symbol: string, patch: Partial<Pick<WatchAlert, "lowTargetCad" | "highTargetCad">>) => void;
  onSelectSymbol: (symbol: string) => void;
  onReset: () => void;
}) {
  const selectedPriceCad = toCadPrice(selected.price, selected);
  const selectedWatchRow = watchAlerts.find((row) => row.symbol === selected.symbol);
  const triggeredAlerts = watchAlerts.filter((row) => row.status === "below" || row.status === "above");
  const selectedMarketValue = selectedPosition ? selectedPosition.shares * selectedPriceCad : 0;
  const persistenceBadge = getTrackerPersistenceBadge(persistenceStatus, isHydrated, lastSavedAt);
  const hasSelected = Boolean(selected.symbol);

  return (
    <Card className="focus-rail" data-testid="portfolio-tracker">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Portfolio Tracker</CardTitle>
            <CardDescription>Positions, alerts, allocation, and risk flags.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={triggeredAlerts.length ? "warning" : "secondary"}>
              {triggeredAlerts.length ? `${triggeredAlerts.length} alert${triggeredAlerts.length === 1 ? "" : "s"}` : "No alerts"}
            </Badge>
            <Badge variant={persistenceBadge.variant}>{persistenceBadge.label}</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              <RefreshCw />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Market Value" value={formatCadCurrency(portfolio.totalMarketValueCad)} icon={<CircleDollarSign />} />
          <Metric label="Day Move" value={formatSignedCad(portfolio.dayChangeCad)} icon={<Activity />} />
          <Metric
            label="Unrealized P/L"
            value={`${formatSignedCad(portfolio.unrealizedPnlCad)} ${formatPercent(portfolio.unrealizedPnlPercent, {
              signed: true
            })}`}
            icon={<Gauge />}
          />
          <Metric
            label="Weighted Cost"
            value={portfolio.weightedExpenseRatio === null ? "n/a" : formatPercent(portfolio.weightedExpenseRatio)}
            icon={<Landmark />}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-md border border-border bg-background/35 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{hasSelected ? selected.symbol : "No selection"}</span>
                  {hasSelected ? <ChangePill value={selected.changePercent} /> : null}
                  {selectedWatchRow ? <AlertStatusBadge status={selectedWatchRow.status} /> : null}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {hasSelected ? selected.name : "Search a ticker or choose a tracking slot."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {hasSelected ? `${formatCadCurrency(selectedPriceCad)} CAD current tracker price` : "Alerts and positions appear after you select a stock."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={selectedIsWatched ? "secondary" : "outline"}
                  size="sm"
                  onClick={onToggleWatch}
                  aria-pressed={selectedIsWatched}
                  disabled={!hasSelected}
                >
                  {selectedIsWatched ? <Check /> : <Bell />}
                  {selectedIsWatched ? "Watched" : "Watch"}
                </Button>
                <Button
                  type="button"
                  variant={selectedPosition ? "secondary" : "outline"}
                  size="sm"
                  onClick={onTogglePosition}
                  aria-pressed={Boolean(selectedPosition)}
                  disabled={!hasSelected}
                >
                  {selectedPosition ? <Check /> : <Plus />}
                  {selectedPosition ? "Tracked" : "Position"}
                </Button>
              </div>
            </div>

            {hasSelected && selectedIsWatched ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Low alert CAD
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={numberInputValue(selectedAlert?.lowTargetCad)}
                    onChange={(event) => onUpdateAlert(selected.symbol, { lowTargetCad: numberFromInput(event.currentTarget.value) })}
                    className="mt-1"
                    data-testid="alert-low-input"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  High alert CAD
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={numberInputValue(selectedAlert?.highTargetCad)}
                    onChange={(event) => onUpdateAlert(selected.symbol, { highTargetCad: numberFromInput(event.currentTarget.value) })}
                    className="mt-1"
                    data-testid="alert-high-input"
                  />
                </label>
              </div>
            ) : (
              <StateNotice icon={<Bell />} title="Not watched" tone="primary">
                {hasSelected
                  ? `Add ${selected.symbol} to the watchlist to track CAD price bands.`
                  : "Search a ticker to create watch alerts and positions."}
              </StateNotice>
            )}

            {selectedPosition ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Shares
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={numberInputValue(selectedPosition.shares)}
                    onChange={(event) => onUpdatePosition(selected.symbol, { shares: numberFromInput(event.currentTarget.value) ?? 0 })}
                    className="mt-1"
                    data-testid="position-shares-input"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Avg cost CAD
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={numberInputValue(selectedPosition.averageCostCad)}
                    onChange={(event) =>
                      onUpdatePosition(selected.symbol, { averageCostCad: numberFromInput(event.currentTarget.value) ?? 0 })
                    }
                    className="mt-1"
                    data-testid="position-cost-input"
                  />
                </label>
                <div className="rounded-md border border-border bg-background/45 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Selected value</div>
                  <div className="mt-1 font-semibold">{formatCadCurrency(selectedMarketValue)}</div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => onRemovePosition(selected.symbol)}>
                  <X />
                  Remove position
                </Button>
              </div>
            ) : null}
          </div>

          <div
            id="tracker-alerts"
            className="scroll-mt-6 rounded-md border border-border bg-background/35 p-3 lg:scroll-mt-28"
            data-testid="tracker-alerts"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="size-4 text-primary" />
                Alert Center
              </div>
              <Badge variant={triggeredAlerts.length ? "warning" : "outline"}>{watchAlerts.length} watched</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {watchAlerts.length ? (
                watchAlerts.map((row) => (
                  <button
                    type="button"
                    key={row.symbol}
                    onClick={() => onSelectSymbol(row.symbol)}
                    className="w-full rounded-md border border-border bg-secondary/35 p-3 text-left transition hover:border-primary/40 hover:bg-primary/7"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm font-semibold">{row.symbol}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{formatCadCurrency(row.priceCad)} CAD</div>
                      </div>
                      <AlertStatusBadge status={row.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Low {row.lowTargetCad === undefined ? "n/a" : formatCadCurrency(row.lowTargetCad)}</span>
                      <span>High {row.highTargetCad === undefined ? "n/a" : formatCadCurrency(row.highTargetCad)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState icon={<Bell />} title="No watchlist symbols" description="Track a symbol to create alerts." />
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="rounded-md border border-border bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ChartPie className="size-4 text-primary" />
                Positions
              </div>
              <Badge variant="secondary">{portfolio.rows.length} tracked</Badge>
            </div>
            {portfolio.rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Symbol</th>
                      <th className="px-3 py-2 font-medium">Shares</th>
                      <th className="px-3 py-2 font-medium">Value</th>
                      <th className="px-3 py-2 font-medium">Allocation</th>
                      <th className="px-3 py-2 font-medium">Day</th>
                      <th className="px-3 py-2 font-medium">P/L</th>
                      <th className="px-3 py-2 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.rows.map((row) => (
                      <tr key={row.position.symbol} className="bg-secondary/45">
                        <td className="rounded-l-md px-3 py-3">
                          <button
                            type="button"
                            className="font-mono font-semibold text-foreground hover:text-primary"
                            onClick={() => onSelectSymbol(row.position.symbol)}
                          >
                            {row.position.symbol}
                          </button>
                          <div className="mt-1 max-w-[180px] truncate text-xs text-muted-foreground">{row.instrument.name}</div>
                        </td>
                        <td className="px-3 py-3 font-mono">{formatPositionShares(row.position.shares)}</td>
                        <td className="px-3 py-3">{formatCadCurrency(row.marketValueCad)}</td>
                        <td className="px-3 py-3">
                          <AllocationBar label={formatPercent(row.allocation)} value={row.allocation} />
                        </td>
                        <td className="px-3 py-3">{formatSignedCad(row.dayChangeCad)}</td>
                        <td className={cn("px-3 py-3", row.unrealizedPnlCad >= 0 ? "text-emerald-700 dark:text-emerald-200" : "text-red-700 dark:text-red-200")}>
                          {formatSignedCad(row.unrealizedPnlCad)}
                          <div className="text-xs">{formatPercent(row.unrealizedPnlPercent, { signed: true })}</div>
                        </td>
                        <td className="rounded-r-md px-3 py-3 text-muted-foreground">{getPortfolioRole(row.instrument).label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<CircleDollarSign />} title="No positions" description="Track a selected symbol as a position." />
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-border bg-background/35 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-primary" />
                Risk Flags
              </div>
              <ul className="space-y-2">
                {portfolio.riskFlags.map((flag) => (
                  <li key={flag} className="rounded-md border border-border bg-secondary/35 p-2 text-xs leading-5 text-muted-foreground">
                    {flag}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-border bg-background/35 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Layers3 className="size-4 text-primary" />
                Allocation
              </div>
              <div className="space-y-3">
                {portfolio.sectorExposures.map((slice) => (
                  <AllocationBar key={slice.label} label={slice.label} value={slice.weight} />
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border bg-background/35 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Target className="size-4 text-primary" />
                Underlying
              </div>
              <div className="space-y-3">
                {portfolio.underlyingHoldings.map((slice) => (
                  <AllocationBar key={slice.label} label={slice.label} value={slice.weight} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertStatusBadge({ status }: { status: WatchAlertRow["status"] }) {
  const label = {
    above: "Above target",
    below: "Below target",
    inside: "Inside band",
    unconfigured: "No band"
  }[status];
  const variant = status === "above" || status === "below" ? "warning" : status === "inside" ? "default" : "outline";

  return <Badge variant={variant}>{label}</Badge>;
}

function getTrackerPersistenceBadge(
  status: TrackerPersistenceStatus,
  isHydrated: boolean,
  lastSavedAt: string | null
): { label: string; variant: "default" | "secondary" | "outline" | "warning" | "magenta" } {
  if (!isHydrated || status === "loading") {
    return { label: "Loading", variant: "outline" };
  }

  if (status === "syncing") {
    return { label: "Syncing", variant: "magenta" };
  }

  if (status === "synced") {
    return { label: lastSavedAt ? `DB saved ${formatClock(lastSavedAt)}` : "DB saved", variant: "default" };
  }

  if (status === "error") {
    return { label: "Local fallback", variant: "warning" };
  }

  return { label: "Saved locally", variant: "secondary" };
}

function formatSignedCad(value: number) {
  const formatted = formatCadCurrency(Math.abs(value));

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function formatPositionShares(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 10 ? 4 : 2
  }).format(value);
}

function numberInputValue(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function numberFromInput(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

type ChartPoint = {
  date: Date;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
};

type ChartPlotPoint = {
  x: number;
  y: number;
  point: ChartPoint;
  value: number;
};

function ChartTerminal({
  instrument,
  benchmark,
  range,
  style,
  scale,
  showVolume,
  showMovingAverage,
  showBenchmark,
  showGrid,
  showCrosshair,
  size,
  autoRefresh,
  isHydrating,
  lastHydratedAt,
  onRangeChange,
  onStyleChange,
  onScaleChange,
  onToggleSettings
}: {
  instrument: InstrumentDetail;
  benchmark?: InstrumentDetail;
  range: ChartRange;
  style: ChartStyle;
  scale: ChartScale;
  showVolume: boolean;
  showMovingAverage: boolean;
  showBenchmark: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
  size: ChartSize;
  autoRefresh: boolean;
  isHydrating: boolean;
  lastHydratedAt: string | null;
  onRangeChange: (range: ChartRange) => void;
  onStyleChange: (style: ChartStyle) => void;
  onScaleChange: (scale: ChartScale) => void;
  onToggleSettings: () => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const points = useMemo(() => buildChartPoints(instrument, range), [instrument, range]);
  const benchmarkPoints = useMemo(
    () => (benchmark ? buildChartPoints(benchmark, range) : []),
    [benchmark, range]
  );
  const cadMultiplier = getCadPriceMultiplier(instrument);
  const chart = useMemo(
    () => buildChartGeometry(points, scale, benchmarkPoints, cadMultiplier),
    [points, scale, benchmarkPoints, cadMultiplier]
  );
  const latest = points.at(-1);
  const first = points[0];
  const latestValue = getDisplayPrice(instrument) || latest?.close || instrument.price;
  const totalChange = first ? (latestValue - first.close) / first.close : instrument.changePercent;
  const chartToneColor = totalChange >= 0 ? "var(--chart-positive)" : "var(--chart-negative)";
  const chartFillStart = totalChange >= 0 ? "rgba(24,128,56,0.18)" : "rgba(217,48,37,0.16)";
  const chartFillEnd = totalChange >= 0 ? "rgba(24,128,56,0.01)" : "rgba(217,48,37,0.01)";
  const chartId = instrument.symbol.replace(/[^A-Za-z0-9_-]/g, "-");
  const averageVolume = points.reduce((total, point) => total + point.volume, 0) / Math.max(points.length, 1);
  const rangeHigh = Math.max(...points.map((point) => point.high), latestValue);
  const rangeLow = Math.min(...points.map((point) => point.low), latestValue);
  const lastChartIndex = Math.max(chart.linePoints.length - 1, 0);
  const isHoveringChart = hoverIndex !== null && chart.linePoints.length > 0;
  const activeIndex = isHoveringChart ? clamp(hoverIndex, 0, lastChartIndex) : lastChartIndex;
  const activePoint = chart.linePoints[activeIndex] ?? chart.lastPoint;
  const activeBenchmarkIndex =
    activePoint && chart.benchmarkLinePoints.length
      ? clamp(
          Math.round((activeIndex / Math.max(chart.linePoints.length - 1, 1)) * (chart.benchmarkLinePoints.length - 1)),
          0,
          chart.benchmarkLinePoints.length - 1
        )
      : null;
  const activeBenchmarkPoint = activeBenchmarkIndex === null ? null : chart.benchmarkLinePoints[activeBenchmarkIndex];
  const activePriceCad = activePoint ? toCadPrice(activePoint.point.close, instrument) : toCadPrice(latestValue, instrument);
  const activeReturn = activePoint && first ? (activePoint.point.close - first.close) / first.close : totalChange;
  const activeDayChange =
    activePoint && activePoint.point.open ? (activePoint.point.close - activePoint.point.open) / activePoint.point.open : 0;
  const rangeLabel = first && latest ? `${formatLongChartDate(first.date)} - ${formatLongChartDate(latest.date)}` : range;
  const tooltipStyle =
    activePoint && isHoveringChart
      ? ({
          left: `${activePoint.x}%`,
          top: `${clamp(activePoint.y, 14, 78)}%`,
          transform: activePoint.x > 62 ? "translate(-104%, -50%)" : "translate(12px, -50%)"
        } satisfies CSSProperties)
      : undefined;
  const chartHeightClass = {
    Compact: "h-[340px] min-h-[340px]",
    Focus: "h-[520px] min-h-[520px]",
    Max: "h-[720px] min-h-[720px] md:h-[820px] md:min-h-[820px]"
  } satisfies Record<ChartSize, string>;
  const sideRailClass = cn("grid gap-2 sm:grid-cols-2", size === "Max" ? "2xl:grid-cols-2" : "2xl:grid-cols-1");
  const lastRefreshLabel = lastHydratedAt ? formatClock(lastHydratedAt) : "pending";
  const hasChartData =
    Boolean(instrument.symbol) &&
    (instrument.price > 0 || instrument.history.some((point) => Number.isFinite(point.close) && point.close > 0));

  function handleChartPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!chart.linePoints.length) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    if (!rect.width) {
      return;
    }

    const relativeX = ((event.clientX - rect.left) / rect.width) * 100;
    const nextIndex = clamp(
      Math.round(((relativeX - 8) / 84) * (chart.linePoints.length - 1)),
      0,
      chart.linePoints.length - 1
    );

    setHoverIndex(nextIndex);
  }

  if (!hasChartData) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">No symbol</Badge>
              {isHydrating ? <Badge variant="secondary">hydrating</Badge> : null}
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Last price</p>
              <p className="text-4xl font-semibold tracking-normal">n/a</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onToggleSettings}>
            <SlidersHorizontal />
            Settings
          </Button>
        </div>
        <div
          className={cn(
            "mt-4 flex items-center justify-center rounded-lg border border-dashed border-border bg-background p-6 text-center",
            chartHeightClass[size]
          )}
        >
          <div>
            <div className="mx-auto flex size-12 items-center justify-center rounded-md border border-border bg-secondary/60 text-primary">
              <Search className="size-5" />
            </div>
            <div className="mt-3 text-sm font-medium text-foreground">Search a ticker to load the chart</div>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Live quote and history will replace this empty chart area after a symbol loads.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={instrument.history.length > 126 ? "default" : "warning"}>
            {instrument.history.length > 126 ? `${instrument.history.length} history bars` : "Mock feed"}
          </Badge>
          <Badge variant={autoRefresh ? "magenta" : "outline"}>{autoRefresh ? "Live pulse" : "Manual"}</Badge>
          <Badge variant="outline">{range}</Badge>
          {showBenchmark && benchmark ? <Badge variant="secondary">Benchmark: {benchmark.symbol}</Badge> : null}
          {isHydrating ? <Badge variant="secondary">hydrating</Badge> : null}
          <ChangePill value={totalChange} />
          <span className="text-xs text-muted-foreground">Refresh {lastRefreshLabel}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onToggleSettings}>
            <SlidersHorizontal />
            Settings
          </Button>
          <Button
            type="button"
            variant={scale === "% Change" ? "secondary" : "outline"}
            size="sm"
            onClick={() => onScaleChange(scale === "Price" ? "% Change" : "Price")}
          >
            {scale}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 border-b border-border lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-1">
          {chartRanges.map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "h-9 border-b-2 px-3 text-sm font-medium transition",
                item === range
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onRangeChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pb-2">
          {chartStyles.map((item) => (
            <Button
              key={item}
              type="button"
              variant={item === style ? "secondary" : "outline"}
              size="sm"
              className="h-8 px-3"
              onClick={() => onStyleChange(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{range} range: {rangeLabel}.</p>

      <div className={cn("mt-4 grid gap-3", size === "Max" ? "2xl:grid-cols-[minmax(0,1fr)_150px]" : "2xl:grid-cols-[minmax(0,1fr)_112px]")}>
        <div
          className={cn("relative overflow-visible rounded-lg border border-border bg-background p-3", chartHeightClass[size])}
          data-testid="price-chart-panel"
          onPointerMove={handleChartPointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${instrument.symbol} ${range} ${style.toLowerCase()} price chart`}
          >
            <defs>
              <linearGradient id={`chart-line-${chartId}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={chartToneColor} />
                <stop offset="100%" stopColor={chartToneColor} />
              </linearGradient>
              <linearGradient id={`chart-fill-${chartId}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={chartFillStart} />
                <stop offset="100%" stopColor={chartFillEnd} />
              </linearGradient>
            </defs>

            {showGrid
              ? [20, 38, 56, 74].map((y) => (
                  <line key={y} x1="8" x2="92" y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="0.35" />
                ))
              : null}

            {showVolume
              ? chart.volumeBars.map((bar) => (
                  <rect
                    key={`${bar.x}-${bar.height}`}
                    x={bar.x}
                    y={96 - bar.height}
                    width={bar.width}
                    height={bar.height}
                    fill="var(--chart-volume)"
                  />
                ))
              : null}

            {showBenchmark && benchmark && chart.benchmarkPath ? (
              <polyline
                points={chart.benchmarkPath}
                fill="none"
                stroke="var(--chart-benchmark)"
                strokeDasharray="2 2"
                strokeLinecap="round"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            {style === "Area" ? (
              <polygon points={`${chart.areaPath} 92,82 8,82`} fill={`url(#chart-fill-${chartId})`} />
            ) : null}

            {style === "Candles"
              ? chart.candles.map((candle) => (
                  <g key={`${candle.x}-${candle.yHigh}`}>
                    <line
                      x1={candle.x}
                      x2={candle.x}
                      y1={candle.yHigh}
                      y2={candle.yLow}
                      stroke={candle.positive ? "var(--chart-positive)" : "var(--chart-negative)"}
                      strokeWidth="1.2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <rect
                      x={candle.x - candle.width / 2}
                      y={Math.min(candle.yOpen, candle.yClose)}
                      width={candle.width}
                      height={Math.max(Math.abs(candle.yClose - candle.yOpen), 1.1)}
                      rx="0.3"
                      fill={candle.positive ? "rgba(24,128,56,0.58)" : "rgba(217,48,37,0.58)"}
                    />
                  </g>
                ))
              : (
                  <polyline
                    points={chart.linePath}
                    fill="none"
                    stroke={`url(#chart-line-${chartId})`}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

            {showMovingAverage && chart.movingAveragePath ? (
              <polyline
                points={chart.movingAveragePath}
                fill="none"
                stroke="var(--chart-moving-average)"
                strokeLinecap="round"
                strokeWidth="1.4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            {showCrosshair && activePoint ? (
              <g>
                <line
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1="10"
                  y2="96"
                  stroke={isHoveringChart ? "var(--chart-crosshair-active)" : "var(--chart-crosshair)"}
                  strokeWidth="0.5"
                />
                <line
                  x1="8"
                  x2="92"
                  y1={activePoint.y}
                  y2={activePoint.y}
                  stroke={isHoveringChart ? "var(--chart-crosshair-active)" : "var(--chart-crosshair)"}
                  strokeWidth="0.5"
                />
              </g>
            ) : null}

            <rect
              data-testid="price-chart-hit-area"
              x="0"
              y="0"
              width="100"
              height="100"
              fill="transparent"
              pointerEvents="all"
            />
          </svg>

          {activePoint ? (
            <div className="pointer-events-none absolute inset-3">
              <span
                data-testid="chart-active-marker"
                className={cn(
                  "absolute rounded-full border-2 border-background shadow-sm",
                  isHoveringChart ? "size-2.5" : "size-2"
                )}
                style={{
                  left: `${activePoint.x}%`,
                  top: `${activePoint.y}%`,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: chartToneColor
                }}
              />
            </div>
          ) : null}

          <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
            {chart.yLabels[2]} / {chart.yLabels[1]} / {chart.yLabels[0]}
          </div>
          {activePoint && tooltipStyle ? (
            <div
              data-testid="chart-hover-card"
              className="pointer-events-none absolute z-10 min-w-[230px] max-w-[260px] rounded-md border border-border bg-card/95 p-3 text-xs shadow-xl backdrop-blur"
              style={tooltipStyle}
            >
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{formatLongChartDate(activePoint.point.date)}</span>
                  <span className="rounded-md border border-border px-1.5 py-0.5 font-mono">{range} range</span>
              </div>
              <div className="mt-2 text-[10px] font-semibold uppercase text-muted-foreground">Price in CAD</div>
              <div className="mt-0.5 text-xl font-semibold tracking-normal text-foreground">
                {formatCadCurrency(activePriceCad)}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <TooltipMetric label="Return" value={formatPercent(activeReturn, { signed: true })} />
                <TooltipMetric label="Day" value={formatPercent(activeDayChange, { signed: true })} />
                <TooltipMetric label="Volume" value={formatCompactNumber(activePoint.point.volume)} />
                {activeBenchmarkPoint ? (
                  <TooltipMetric label="Benchmark" value={formatPercent(activeBenchmarkPoint.value / 100, { signed: true })} />
                ) : (
                  <TooltipMetric label="Close" value={formatCurrency(activePoint.point.close)} />
                )}
              </div>
              <div className="mt-2 rounded-md border border-border bg-secondary/45 px-2 py-1 text-[11px] text-muted-foreground">
                {getCadPriceNote(instrument)}
              </div>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{chart.xLabels[0]}</span>
            <span>{chart.xLabels[1]}</span>
            <span>{chart.xLabels[2]}</span>
          </div>
        </div>

        <div className={sideRailClass}>
          <Metric label={`${range} Return`} value={formatPercent(totalChange, { signed: true })} compact />
          <Metric label="High (CAD)" value={formatCadCurrency(toCadPrice(rangeHigh, instrument))} compact />
          <Metric label="Low (CAD)" value={formatCadCurrency(toCadPrice(rangeLow, instrument))} compact />
          <Metric label="Avg Volume" value={formatCompactNumber(averageVolume)} compact />
        </div>
      </div>
    </div>
  );
}

function ChartSettingsPanel({
  chartSize,
  setChartSize,
  chartScale,
  setChartScale,
  showVolume,
  setShowVolume,
  showMovingAverage,
  setShowMovingAverage,
  showBenchmark,
  setShowBenchmark,
  showGrid,
  setShowGrid,
  showCrosshair,
  setShowCrosshair,
  autoRefresh,
  setAutoRefresh,
  refreshIntervalMs,
  setRefreshIntervalMs
}: {
  chartSize: ChartSize;
  setChartSize: (size: ChartSize) => void;
  chartScale: ChartScale;
  setChartScale: (scale: ChartScale) => void;
  showVolume: boolean;
  setShowVolume: (value: boolean) => void;
  showMovingAverage: boolean;
  setShowMovingAverage: (value: boolean) => void;
  showBenchmark: boolean;
  setShowBenchmark: (value: boolean) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
  showCrosshair: boolean;
  setShowCrosshair: (value: boolean) => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  refreshIntervalMs: (typeof refreshIntervals)[number];
  setRefreshIntervalMs: (value: (typeof refreshIntervals)[number]) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-background/45 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <div>
            <div className="text-sm font-medium">Chart Settings</div>
            <p className="text-xs text-muted-foreground">Range, overlays, volume, scale, and visual aids.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {chartSizes.map((size) => (
            <Button
              key={size}
              type="button"
              variant={chartSize === size ? "secondary" : "outline"}
              size="sm"
              onClick={() => setChartSize(size)}
            >
              {size}
            </Button>
          ))}
          {chartScales.map((scale) => (
            <Button
              key={scale}
              type="button"
              variant={chartScale === scale ? "secondary" : "outline"}
              size="sm"
              onClick={() => setChartScale(scale)}
            >
              {scale}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <SettingToggle label="Volume" checked={showVolume} onChange={setShowVolume} />
        <SettingToggle label="Moving avg" checked={showMovingAverage} onChange={setShowMovingAverage} />
        <SettingToggle label="Benchmark" checked={showBenchmark} onChange={setShowBenchmark} />
        <SettingToggle label="Grid lines" checked={showGrid} onChange={setShowGrid} />
        <SettingToggle label="Crosshair" checked={showCrosshair} onChange={setShowCrosshair} />
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-background/35 p-3 lg:flex-row lg:items-center lg:justify-between">
        <SettingToggle label="Live pulse" checked={autoRefresh} onChange={setAutoRefresh} compact />
        <div className="flex flex-wrap gap-2">
          {refreshIntervals.map((interval) => (
            <Button
              key={interval}
              type="button"
              variant={refreshIntervalMs === interval ? "secondary" : "outline"}
              size="sm"
              onClick={() => setRefreshIntervalMs(interval)}
            >
              {interval / 1000}s
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
  compact = false
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-3 text-left text-sm transition",
        compact ? "py-1.5" : "py-2",
        checked ? "border-primary/35 bg-primary/10 text-foreground" : "border-border bg-background/35 text-muted-foreground"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded border text-[10px]",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary"
        )}
      >
        {checked ? <Check className="size-3" /> : null}
      </span>
    </button>
  );
}

function buildChartPoints(instrument: InstrumentDetail, range: ChartRange): ChartPoint[] {
  const count = rangeToPointCount(range);
  const historicalPoints = normalizeHistoricalChartPoints(instrument);

  if (historicalPoints.length) {
    const rangePoints = range === "MAX" ? historicalPoints : historicalPoints.slice(-count);

    if (rangePoints.length >= Math.min(count, 8)) {
      return rangePoints;
    }
  }

  const seed = symbolSeed(instrument.symbol);
  const history = instrument.history.length ? instrument.history : [{ close: instrument.price, date: new Date().toISOString() }];
  const firstHistorical = history[0]?.close ?? instrument.price;
  const lastHistorical = history.at(-1)?.close ?? instrument.price;
  const drift = (lastHistorical - firstHistorical) / Math.max(history.length - 1, 1);
  const lastClose = instrument.price || lastHistorical || 1;
  const volatility = Math.max(instrument.volatility, 0.03);
  const end = new Date(Date.UTC(2026, 5, 2));

  return Array.from({ length: count }, (_, index) => {
    const remaining = count - index - 1;
    const trend = lastClose - drift * remaining * 0.72;
    const wave =
      Math.sin((index + seed) / 8) * lastClose * volatility * 0.045 +
      Math.cos((index + seed) / 19) * lastClose * volatility * 0.026;
    const close = Math.max(0.5, trend + wave);
    const previousClose = index === 0 ? close * (1 - instrument.changePercent / 3) : Math.max(0.5, trend - drift + wave * 0.92);
    const open = previousClose;
    const dailySpread = Math.max(close * volatility * (0.022 + ((index + seed) % 7) * 0.0018), close * 0.002);
    const high = Math.max(open, close) + dailySpread;
    const low = Math.max(0.25, Math.min(open, close) - dailySpread);
    const volumeBase = instrument.type === "ETF" ? 1_800_000 : 42_000_000;
    const volume = volumeBase * (1 + Math.abs(Math.sin((index + seed) / 5)) * 1.8 + volatility * 2);
    const date = new Date(end.getTime() - remaining * 24 * 60 * 60 * 1000);

    return {
      date,
      close: Number(close.toFixed(2)),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      volume: Math.round(volume)
    };
  });
}

function normalizeHistoricalChartPoints(instrument: InstrumentDetail): ChartPoint[] {
  const seed = symbolSeed(instrument.symbol);
  const volumeBase = instrument.type === "ETF" ? 1_800_000 : 42_000_000;
  let previousClose = (instrument.history[0]?.close ?? instrument.price) || 1;

  return instrument.history
    .map((point, index) => {
      const date = new Date(point.date);
      const close = point.close;

      if (!Number.isFinite(date.getTime()) || !Number.isFinite(close) || close <= 0) {
        return null;
      }

      const open = point.open && point.open > 0 ? point.open : previousClose;
      const high = point.high && point.high > 0 ? point.high : Math.max(open, close);
      const low = point.low && point.low > 0 ? point.low : Math.min(open, close);
      const volume =
        point.volume && point.volume > 0
          ? point.volume
          : volumeBase * (1 + Math.abs(Math.sin((index + seed) / 5)) * 1.8 + Math.max(instrument.volatility, 0.03) * 2);

      previousClose = close;

      return {
        date,
        close: Number(close.toFixed(2)),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        volume: Math.round(volume)
      };
    })
    .filter((point): point is ChartPoint => Boolean(point))
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

function buildChartGeometry(
  points: ChartPoint[],
  scale: ChartScale,
  benchmarkPoints: ChartPoint[],
  cadPriceMultiplier: number
) {
  const scaled = toScaledValues(points, scale);
  const benchmarkScaled = benchmarkPoints.length ? toScaledValues(benchmarkPoints, "% Change") : [];
  const allValues = [...scaled.map((point) => point.value), ...benchmarkScaled.map((point) => point.value)];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const padding = Math.max((max - min) * 0.12, scale === "Price" ? 1 : 0.5);
  const domainMin = min - padding;
  const domainMax = max + padding;
  const domainRange = Math.max(domainMax - domainMin, 1);
  const yFor = (value: number) => 82 - ((value - domainMin) / domainRange) * 70;
  const xFor = (index: number, length: number) => 8 + (index / Math.max(length - 1, 1)) * 84;
  const linePoints: ChartPlotPoint[] = scaled.map((point, index) => ({
    x: xFor(index, scaled.length),
    y: yFor(point.value),
    point: point.point,
    value: point.value
  }));
  const linePath = linePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const movingAveragePath = movingAverage(scaled.map((point) => point.value), 12)
    .map((value, index) => (value === null ? null : `${xFor(index, scaled.length)},${yFor(value)}`))
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const benchmarkLinePoints: ChartPlotPoint[] = benchmarkScaled.map((point, index) => ({
    x: xFor(index, benchmarkScaled.length),
    y: yFor(point.value),
    point: point.point,
    value: point.value
  }));
  const benchmarkPath = benchmarkLinePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const maxVolume = Math.max(...points.map((point) => point.volume), 1);
  const volumeStep = Math.max(1, Math.ceil(points.length / 64));
  const volumeBars = points
    .filter((_, index) => index % volumeStep === 0)
    .map((point, index, rows) => ({
      x: xFor(index, rows.length) - 0.35,
      width: 0.7,
      height: (point.volume / maxVolume) * 14
    }));
  const candleStep = Math.max(1, Math.ceil(points.length / 34));
  const candles = points
    .filter((_, index) => index % candleStep === 0)
    .map((point, index, rows) => {
      const x = xFor(index, rows.length);

      return {
        x,
        width: Math.max(0.9, 76 / rows.length),
        yOpen: yFor(scaleValue(point.open, points[0]?.close ?? point.open, scale)),
        yClose: yFor(scaleValue(point.close, points[0]?.close ?? point.close, scale)),
        yHigh: yFor(scaleValue(point.high, points[0]?.close ?? point.high, scale)),
        yLow: yFor(scaleValue(point.low, points[0]?.close ?? point.low, scale)),
        positive: point.close >= point.open
      };
    });

  return {
    linePath,
    linePoints,
    areaPath: linePath,
    movingAveragePath,
    benchmarkPath,
    benchmarkLinePoints,
    candles,
    volumeBars,
    lastPoint: linePoints.at(-1),
    yLabels: [domainMin, (domainMin + domainMax) / 2, domainMax].map((value) =>
      formatChartAxis(value, scale, cadPriceMultiplier)
    ),
    xLabels: [points[0], points[Math.floor(points.length / 2)], points.at(-1)].map((point) =>
      point ? formatChartDate(point.date) : ""
    )
  };
}

function toScaledValues(points: ChartPoint[], scale: ChartScale) {
  const base = points[0]?.close ?? 1;
  return points.map((point) => ({
    point,
    value: scaleValue(point.close, base, scale)
  }));
}

function scaleValue(value: number, base: number, scale: ChartScale) {
  return scale === "% Change" ? ((value - base) / base) * 100 : value;
}

function movingAverage(values: number[], windowSize: number) {
  return values.map((_, index) => {
    if (index < windowSize - 1) {
      return null;
    }

    const window = values.slice(index - windowSize + 1, index + 1);
    return window.reduce((total, value) => total + value, 0) / window.length;
  });
}

function rangeToPointCount(range: ChartRange) {
  const counts: Record<ChartRange, number> = {
    "1D": 2,
    "5D": 5,
    "1M": 22,
    "6M": 126,
    YTD: 126,
    "1Y": 252,
    "5Y": 520,
    MAX: 780
  };

  return counts[range];
}

function symbolSeed(symbol: string) {
  return symbol.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function formatChartAxis(value: number, scale: ChartScale, cadPriceMultiplier = 1) {
  if (scale === "% Change") {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  }

  return formatCadCurrency(value * cadPriceMultiplier);
}

function formatChartDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit"
  }).format(date);
}

function formatLongChartDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatClock(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function getCadPriceMultiplier(instrument: InstrumentDetail) {
  return isCadListedInstrument(instrument) ? 1 : estimatedUsdToCadRate;
}

function toCadPrice(value: number, instrument: InstrumentDetail) {
  return value * getCadPriceMultiplier(instrument);
}

function getInstrumentCadPrice(instrument: InstrumentDetail) {
  return toCadPrice(instrument.price, instrument);
}

function getDisplayPrice(instrument: InstrumentDetail) {
  const latestClose = instrument.history.at(-1)?.close;

  return instrument.price > 0 ? instrument.price : latestClose && latestClose > 0 ? latestClose : 0;
}

function getInstrumentCurrencyLabel(instrument: InstrumentDetail) {
  return isCadListedInstrument(instrument) ? "CAD" : "USD";
}

function getCadPriceNote(instrument: InstrumentDetail) {
  return isCadListedInstrument(instrument)
    ? "CAD-listed price"
    : `Estimated at ${estimatedUsdToCadRate.toFixed(2)} USD/CAD`;
}

function isCadListedInstrument(instrument: InstrumentDetail) {
  const exchange = instrument.exchange.toLowerCase();
  const symbol = instrument.symbol.toUpperCase();

  return (
    symbol.endsWith(".TO") ||
    symbol === "XEQT" ||
    exchange.includes("toronto") ||
    exchange.includes("tsx") ||
    exchange.includes("neo")
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function DirectionBadge({ direction }: { direction: Assessment["direction"] }) {
  const styles = {
    up: "border-emerald-500/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200",
    down: "border-red-500/30 bg-red-400/10 text-red-700 dark:text-red-200",
    sideways: "border-amber-500/30 bg-amber-400/10 text-amber-700 dark:text-amber-200",
    uncertain: "border-fuchsia-500/30 bg-fuchsia-400/10 text-fuchsia-700 dark:text-fuchsia-200"
  };

  return <span className={cn("rounded-md border px-3 py-1 text-xs font-semibold uppercase", styles[direction])}>{direction}</span>;
}

function ThesisList({ items, tone }: { items: string[]; tone: "green" | "red" | "amber" }) {
  const dot = {
    green: "bg-emerald-300",
    red: "bg-red-300",
    amber: "bg-amber-300"
  };

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 rounded-md bg-secondary/35 p-3 text-sm leading-5 text-muted-foreground">
          <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dot[tone])} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ExposurePanel({
  title,
  icon,
  exposures
}: {
  title: string;
  icon: ReactNode;
  exposures: { label: string; weight: number }[];
}) {
  return (
    <Card className="focus-rail">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>Weighted allocation profile.</CardDescription>
          </div>
          <span className="text-primary [&_svg]:size-4">{icon}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {exposures.map((exposure) => (
          <AllocationBar key={exposure.label} label={exposure.label} value={exposure.weight} />
        ))}
      </CardContent>
    </Card>
  );
}

function AllocationBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{formatPercent(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}
