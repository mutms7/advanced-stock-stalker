"use client";

import {
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CandlestickChart,
  ChartPie,
  Check,
  CircleAlert,
  CircleDollarSign,
  Gauge,
  Info,
  Landmark,
  Layers3,
  ListFilter,
  Plus,
  Radar,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
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
import type { Assessment, InstrumentDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const initialInstrument = instruments[0];
const coreCompareSymbols = ["VOO", "VTI", "QQQM", "XEQT"];
const maxCompareFunds = 5;
const quickSearches = ["VOO", "VTI", "XEQT", "VXUS", "BND", "SCHD", "NASDAQ"];
const compareCandidates = instruments.filter((instrument) => instrument.type === "ETF");
const chartRanges = ["1M", "3M", "6M", "1Y", "5Y", "MAX"] as const;
const chartStyles = ["Line", "Area", "Candles"] as const;
const chartScales = ["Price", "% Change"] as const;
const chartSizes = ["Compact", "Focus", "Max"] as const;
const refreshIntervals = [15_000, 30_000, 60_000] as const;
const estimatedUsdToCadRate = 1.37;
const workspacePanels = [
  { id: "prospects", label: "List" },
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
  const [results, setResults] = useState<InstrumentDetail[]>(instruments.slice(0, 7));
  const [selected, setSelected] = useState<InstrumentDetail>(initialInstrument);
  const [compareSymbols, setCompareSymbols] = useState(coreCompareSymbols);
  const [assessment, setAssessment] = useState<Assessment>(() => mockAssessment(initialInstrument.symbol));
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
  const [showProspects, setShowProspects] = useState(true);
  const [showResearchRail, setShowResearchRail] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showIndexLens, setShowIndexLens] = useState(true);
  const [showComparison, setShowComparison] = useState(true);
  const [showExposurePanels, setShowExposurePanels] = useState(true);
  const [prospectWidth, setProspectWidth] = useState(320);
  const [researchWidth, setResearchWidth] = useState(390);
  const [metricsWidth, setMetricsWidth] = useState(280);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState<(typeof refreshIntervals)[number]>(30_000);
  const [isHydratingDetail, setIsHydratingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [lastHydratedAt, setLastHydratedAt] = useState<string | null>(null);
  const isWorkspaceReady = useSyncExternalStore(
    subscribeWorkspaceReady,
    getWorkspaceReadySnapshot,
    getWorkspaceServerSnapshot
  );

  const compareFunds = useMemo(
    () =>
      compareSymbols
        .map((symbol) => instruments.find((instrument) => instrument.symbol === symbol))
        .filter((instrument): instrument is InstrumentDetail => Boolean(instrument)),
    [compareSymbols]
  );

  const indexInsights = useMemo(() => buildIndexInsights(selected), [selected]);
  const selectedBenchmark = useMemo(() => compareFunds.find((fund) => fund.symbol !== selected.symbol), [compareFunds, selected.symbol]);
  const nextCompareReplacement =
    compareSymbols.length >= maxCompareFunds && !compareSymbols.includes(selected.symbol) ? compareSymbols[0] : null;
  const prospectsVisible = showProspects && chartSize !== "Max";
  const researchRailVisible = showResearchRail && chartSize !== "Max";
  const metricsVisible = showMetrics && chartSize !== "Max";
  const comparisonVisible = showComparison && chartSize !== "Max";
  const exposurePanelsVisible = showExposurePanels && chartSize !== "Max";
  const workspaceColumns = [
    prospectsVisible ? `${prospectWidth}px` : null,
    "minmax(0, 1fr)",
    researchRailVisible ? `${researchWidth}px` : null
  ]
    .filter(Boolean)
    .join(" ");
  const workspaceStyle = {
    "--workspace-columns": workspaceColumns,
    "--metric-column": `${metricsWidth}px`
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

  const hydrateSelectedDetail = useCallback(
    async (symbol: string, options: { refresh?: boolean; silent?: boolean } = {}) => {
      if (!options.silent) {
        setIsHydratingDetail(true);
      }

      try {
        const search = options.refresh ? "?refresh=1" : "";
        const response = await fetch(`/api/instruments/${encodeURIComponent(symbol)}${search}`);
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
    if (!autoRefresh) {
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
    setSelected(instrument);
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

  return (
    <TooltipProvider>
      <main className="min-h-screen px-4 py-4 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
          <header className="focus-rail sticky top-4 z-30 rounded-lg border border-white/10 bg-background/82 p-3 backdrop-blur-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <CandlestickChart className="size-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">Advanced Stock Stalker</h1>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Search stocks, compare funds, read news, and keep the chart front and center.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-[390px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
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
                <Button onClick={() => void handleSearch()} disabled={isSearching}>
                  {isSearching ? <RefreshCw className="animate-spin" /> : <Search />}
                  Search
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Watch alerts">
                      <Bell />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Watch alerts</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </header>

          <WorkspaceControls
            chartSize={chartSize}
            setChartSize={setChartSize}
            panels={panelStates}
            onPanelVisibilityChange={setPanelVisibility}
            prospectWidth={prospectWidth}
            setProspectWidth={setProspectWidth}
            researchWidth={researchWidth}
            setResearchWidth={setResearchWidth}
            metricsWidth={metricsWidth}
            setMetricsWidth={setMetricsWidth}
            isReady={isWorkspaceReady}
          />

          <section className="workspace-grid grid gap-4" style={workspaceStyle}>
            {prospectsVisible ? (
            <Card className="noise-panel focus-rail">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Stock List</CardTitle>
                    <CardDescription>ETFs and stocks you can open quickly.</CardDescription>
                  </div>
                  <Badge variant={searchError ? "warning" : "magenta"}>
                    {isSearching ? "scanning" : `${results.length} live`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="rounded-md border border-white/10 bg-background/35 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <ListFilter className="size-3.5 text-primary" />
                    Quick Picks
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {quickSearches.map((term) => (
                      <Button
                        key={term}
                        type="button"
                        variant={query.trim().toUpperCase() === term ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 px-2.5 font-mono"
                        onClick={() => void handleSearch(term)}
                      >
                        {term}
                      </Button>
                    ))}
                  </div>
                </div>

                {searchError ? (
                  <StateNotice icon={<CircleAlert />} title="Search fallback" tone="warning">
                    {searchError} Local matches are shown when available.
                  </StateNotice>
                ) : null}

                {isSearching ? (
                  <ProspectQueueSkeleton />
                ) : results.length ? (
                  results.map((instrument) => (
                    <button
                      type="button"
                      key={instrument.symbol}
                      onClick={() => handleSelect(instrument)}
                      className={cn(
                        "w-full rounded-md border p-3 text-left transition hover:border-primary/45 hover:bg-primary/7",
                        selected.symbol === instrument.symbol
                          ? "border-primary/55 bg-primary/10"
                          : "border-border bg-background/35"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-foreground">{instrument.symbol}</span>
                            <Badge variant="secondary">{instrument.type}</Badge>
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{instrument.name}</p>
                        </div>
                        <ChangePill value={instrument.changePercent} />
                      </div>
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{instrument.focus}</p>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    icon={<SearchX />}
                    title={lastSearchQuery ? `No matches for "${lastSearchQuery}"` : "No prospects found"}
                    description="Try another ticker or choose a quick pick."
                  >
                    <Button type="button" variant="secondary" size="sm" onClick={() => void handleSearch("")}>
                      <RefreshCw />
                      Reset queue
                    </Button>
                  </EmptyState>
                )}
              </CardContent>
            </Card>
            ) : null}

            <div className="flex min-w-0 flex-col gap-4">
              <Card className="noise-panel focus-rail overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{selected.exchange}</Badge>
                        {selected.benchmark ? <Badge variant="outline">{selected.benchmark}</Badge> : null}
                      </div>
                      <CardTitle className="mt-4 text-3xl leading-tight sm:text-4xl">
                        {selected.symbol}
                        <span className="ml-3 text-xl font-normal text-muted-foreground sm:text-2xl">
                          {selected.name}
                        </span>
                      </CardTitle>
                      <CardDescription className="mt-2 max-w-3xl text-sm leading-6">{selected.summary}</CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={compareSymbols.includes(selected.symbol) ? "secondary" : "outline"}
                          onClick={() => toggleCompare(selected.symbol)}
                          aria-pressed={compareSymbols.includes(selected.symbol)}
                        >
                          {compareSymbols.includes(selected.symbol) ? <Check /> : <Plus />}
                          {compareSymbols.includes(selected.symbol) ? "In compare" : "Add to compare"}
                        </Button>
                        <Button onClick={handleAssess} disabled={isAssessing} aria-busy={isAssessing}>
                          {isAssessing ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                          {isAssessing ? "Assessing" : "Assess"}
                        </Button>
                      </div>
                      {nextCompareReplacement ? (
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
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                      <Metric label="Expense" value={selected.expenseRatio ? formatPercent(selected.expenseRatio) : "n/a"} />
                      <Metric label="Yield" value={selected.dividendYield ? formatPercent(selected.dividendYield) : "n/a"} />
                      <Metric label="AUM" value={selected.aum ? formatCompactCurrency(selected.aum) : "n/a"} />
                      <Metric label="Volatility" value={formatPercent(selected.volatility)} />
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
                  {showIndexLens ? (
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
                  <div className="mb-3 rounded-md border border-white/10 bg-background/35 p-3">
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
                              <td className="px-3 py-3 text-red-200">{formatPercent(fund.maxDrawdown)}</td>
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
            <div className="flex min-w-0 flex-col gap-4">
              <Card className="focus-rail border-primary/25">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Quick Take</CardTitle>
                      <CardDescription>News plus a plain-English view.</CardDescription>
                    </div>
                    <DirectionBadge direction={assessment.direction} />
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
                    <Metric label="Confidence" value={formatPercent(assessment.confidence)} icon={<Gauge />} />
                    <Metric label="Window" value={assessment.timeHorizon} icon={<Radar />} />
                  </div>
                  <p className="rounded-md border border-white/10 bg-background/45 p-3 text-sm leading-6 text-muted-foreground">
                    {assessment.summary}
                  </p>
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
                  {assessment.citations.map((article) => (
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
                  ))}
                </CardContent>
              </Card>
            </div>
            ) : null}
          </section>

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

function WorkspaceControls({
  chartSize,
  setChartSize,
  panels,
  onPanelVisibilityChange,
  prospectWidth,
  setProspectWidth,
  researchWidth,
  setResearchWidth,
  metricsWidth,
  setMetricsWidth,
  isReady
}: {
  chartSize: ChartSize;
  setChartSize: (size: ChartSize) => void;
  panels: WorkspacePanel[];
  onPanelVisibilityChange: (panelId: WorkspacePanelId, visible: boolean) => void;
  prospectWidth: number;
  setProspectWidth: (value: number) => void;
  researchWidth: number;
  setResearchWidth: (value: number) => void;
  metricsWidth: number;
  setMetricsWidth: (value: number) => void;
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
      className="dock-bar focus-rail rounded-lg border border-white/10 bg-background/72 px-3 py-2 backdrop-blur-xl"
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

        <DockSlider label="List" value={prospectWidth} min={240} max={460} onChange={setProspectWidth} />
        <DockSlider label="Take" value={researchWidth} min={300} max={540} onChange={setResearchWidth} />
        <DockSlider label="Stats" value={metricsWidth} min={190} max={380} onChange={setMetricsWidth} />
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
        visible ? "border-primary/20 bg-primary/6" : "border-dashed border-fuchsia-300/25 bg-fuchsia-400/7"
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDropPanel(event, visible)}
      onPointerUp={() => onPointerDrop(visible)}
      data-panel-dropzone={visible ? "visible" : "hidden"}
      data-testid={visible ? "visible-panel-dock" : "hidden-panel-dock"}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
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
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-muted-foreground">drop here</span>
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
          : "border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-100 hover:bg-fuchsia-400/16"
      )}
      aria-pressed={visible}
      data-testid={`panel-chip-${panel.id}`}
    >
      {visible ? <Check className="size-3" /> : <Plus className="size-3" />}
      {panel.label}
    </button>
  );
}

function DockSlider({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-white/10 bg-background/35 px-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={10}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-24 accent-primary"
        aria-label={`${label} width`}
      />
      <span className="w-9 text-right font-mono text-foreground">{value}</span>
    </label>
  );
}

function isWorkspacePanelId(value: string): value is WorkspacePanelId {
  return workspacePanels.some((panel) => panel.id === value);
}

function searchLocalInstruments(query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return instruments.slice(0, 7);
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

function IndexInsightTile({ insight }: { insight: IndexInsight }) {
  const borderStyles = {
    primary: "border-primary/25 bg-primary/7",
    green: "border-emerald-300/25 bg-emerald-400/7",
    amber: "border-amber-300/25 bg-amber-400/8",
    magenta: "border-fuchsia-300/25 bg-fuchsia-400/8"
  };
  const iconStyles = {
    primary: "text-primary",
    green: "text-emerald-200",
    amber: "text-amber-200",
    magenta: "text-fuchsia-200"
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
    muted: "border-white/10 bg-background/45 text-muted-foreground",
    primary: "border-primary/25 bg-primary/8 text-primary",
    warning: "border-amber-300/30 bg-amber-400/10 text-amber-100"
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
      <div className="mx-auto flex size-10 items-center justify-center rounded-md border border-white/10 bg-secondary/60 text-primary [&_svg]:size-5">
        {icon}
      </div>
      <div className="mt-3 text-sm font-medium text-foreground">{title}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      {children ? <div className="mt-3 flex justify-center">{children}</div> : null}
    </div>
  );
}

function ProspectQueueSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/7 p-3 text-sm text-primary">
        <RefreshCw className="size-4 animate-spin" />
        Searching fund universe
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-md border border-border bg-background/35 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-16 rounded bg-secondary" />
              <div className="h-3 w-36 rounded bg-secondary/80" />
            </div>
            <div className="h-6 w-16 rounded bg-secondary" />
          </div>
          <div className="mt-4 h-3 w-full rounded bg-secondary/80" />
          <div className="mt-2 h-3 w-2/3 rounded bg-secondary/60" />
        </div>
      ))}
    </div>
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
          ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
          : "border-red-300/30 bg-red-400/10 text-red-200"
      )}
    >
      {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {formatPercent(value, { signed: true })}
    </span>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-background/45 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon ? <span className="[&_svg]:size-3.5">{icon}</span> : null}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-normal">{value}</div>
    </div>
  );
}

function TooltipMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-[12px] text-foreground">{value}</div>
    </div>
  );
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
  const latestValue = latest?.close ?? instrument.price;
  const totalChange = first ? (latestValue - first.close) / first.close : instrument.changePercent;
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
    Compact: "h-[300px] min-h-[300px]",
    Focus: "h-[430px] min-h-[430px]",
    Max: "h-[620px] min-h-[620px] md:h-[700px] md:min-h-[700px]"
  } satisfies Record<ChartSize, string>;
  const sideRailClass = cn("grid gap-2 sm:grid-cols-2", size === "Max" ? "2xl:grid-cols-2" : "xl:grid-cols-1");
  const lastRefreshLabel = lastHydratedAt ? formatClock(lastHydratedAt) : "pending";

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

  return (
    <div className="rounded-lg border border-white/10 bg-[#080b0b] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={instrument.history.length > 126 ? "default" : "warning"}>
              {instrument.history.length > 126 ? `${instrument.history.length} history bars` : "Mock feed"}
            </Badge>
            <Badge variant={autoRefresh ? "magenta" : "outline"}>{autoRefresh ? "Live pulse" : "Manual"}</Badge>
            <Badge variant="outline">{range}</Badge>
            {showBenchmark && benchmark ? <Badge variant="secondary">Benchmark: {benchmark.symbol}</Badge> : null}
            {isHydrating ? <Badge variant="secondary">hydrating</Badge> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Last price</p>
              <p className="text-4xl font-semibold tracking-normal">{formatCurrency(latestValue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCadCurrency(toCadPrice(latestValue, instrument))} CAD - {getCadPriceNote(instrument)}
              </p>
            </div>
            <ChangePill value={totalChange} large />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Last refresh {lastRefreshLabel}</p>
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

      <div className="mt-4 flex flex-wrap gap-2">
        {chartRanges.map((item) => (
          <Button
            key={item}
            type="button"
            variant={item === range ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-3 font-mono"
            onClick={() => onRangeChange(item)}
          >
            {item}
          </Button>
        ))}
        <span className="mx-1 hidden h-8 w-px bg-border sm:block" />
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
      <p className="mt-2 text-xs text-muted-foreground">
        {range} range: {rangeLabel}. Hover the chart for the exact date, CAD price, return, and volume.
      </p>

      <div className={cn("mt-4 grid gap-3", size === "Max" ? "2xl:grid-cols-[minmax(0,1fr)_180px]" : "xl:grid-cols-[minmax(0,1fr)_120px]")}>
        <div
          className={cn("relative overflow-visible rounded-md border border-white/10 bg-background/35 p-3", chartHeightClass[size])}
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
              <linearGradient id={`chart-line-${instrument.symbol}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#52eec5" />
                <stop offset="55%" stopColor="#f5c451" />
                <stop offset="100%" stopColor="#e365ff" />
              </linearGradient>
              <linearGradient id={`chart-fill-${instrument.symbol}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(82,238,197,0.28)" />
                <stop offset="100%" stopColor="rgba(227,101,255,0.02)" />
              </linearGradient>
            </defs>

            {showGrid
              ? [20, 38, 56, 74].map((y) => (
                  <line key={y} x1="8" x2="92" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.35" />
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
                    fill="rgba(82,238,197,0.22)"
                  />
                ))
              : null}

            {showBenchmark && benchmark && chart.benchmarkPath ? (
              <polyline
                points={chart.benchmarkPath}
                fill="none"
                stroke="rgba(245,196,81,0.72)"
                strokeDasharray="2 2"
                strokeLinecap="round"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            {style === "Area" ? (
              <polygon points={`${chart.areaPath} 92,82 8,82`} fill={`url(#chart-fill-${instrument.symbol})`} />
            ) : null}

            {style === "Candles"
              ? chart.candles.map((candle) => (
                  <g key={`${candle.x}-${candle.yHigh}`}>
                    <line
                      x1={candle.x}
                      x2={candle.x}
                      y1={candle.yHigh}
                      y2={candle.yLow}
                      stroke={candle.positive ? "#52eec5" : "#ff8a8a"}
                      strokeWidth="1.2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <rect
                      x={candle.x - candle.width / 2}
                      y={Math.min(candle.yOpen, candle.yClose)}
                      width={candle.width}
                      height={Math.max(Math.abs(candle.yClose - candle.yOpen), 1.1)}
                      rx="0.3"
                      fill={candle.positive ? "rgba(82,238,197,0.62)" : "rgba(255,138,138,0.62)"}
                    />
                  </g>
                ))
              : (
                  <polyline
                    points={chart.linePath}
                    fill="none"
                    stroke={`url(#chart-line-${instrument.symbol})`}
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
                stroke="rgba(255,255,255,0.72)"
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
                  stroke={isHoveringChart ? "rgba(245,196,81,0.45)" : "rgba(255,255,255,0.12)"}
                  strokeWidth="0.5"
                />
                <line
                  x1="8"
                  x2="92"
                  y1={activePoint.y}
                  y2={activePoint.y}
                  stroke={isHoveringChart ? "rgba(245,196,81,0.32)" : "rgba(255,255,255,0.08)"}
                  strokeWidth="0.5"
                />
                <circle cx={activePoint.x} cy={activePoint.y} r={isHoveringChart ? "2.1" : "1.6"} fill="#f5c451" />
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

          <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/10 bg-background/75 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
            {chart.yLabels[2]} / {chart.yLabels[1]} / {chart.yLabels[0]}
          </div>
          {activePoint && tooltipStyle ? (
            <div
              data-testid="chart-hover-card"
              className="pointer-events-none absolute z-10 min-w-[230px] max-w-[260px] rounded-md border border-primary/30 bg-[#07100f]/95 p-3 text-xs shadow-2xl shadow-black/30 backdrop-blur"
              style={tooltipStyle}
            >
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{formatLongChartDate(activePoint.point.date)}</span>
                <span className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono">{range} range</span>
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
              <div className="mt-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted-foreground">
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
          <Metric label={`${range} Return`} value={formatPercent(totalChange, { signed: true })} />
          <Metric label="High (CAD)" value={formatCadCurrency(toCadPrice(rangeHigh, instrument))} />
          <Metric label="Low (CAD)" value={formatCadCurrency(toCadPrice(rangeLow, instrument))} />
          <Metric label="Avg Volume" value={formatCompactNumber(averageVolume)} />
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
    <div className="mt-3 rounded-lg border border-white/10 bg-background/45 p-3">
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

      <div className="mt-3 flex flex-col gap-2 rounded-md border border-white/10 bg-background/35 p-3 lg:flex-row lg:items-center lg:justify-between">
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
    "1M": 22,
    "3M": 64,
    "6M": 126,
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
    up: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
    down: "border-red-300/30 bg-red-400/10 text-red-200",
    sideways: "border-amber-300/30 bg-amber-400/10 text-amber-200",
    uncertain: "border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-200"
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
          className="h-full rounded-full bg-[linear-gradient(90deg,#52eec5,#f5c451,#e365ff)]"
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
