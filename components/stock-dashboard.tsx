"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CandlestickChart,
  Gauge,
  Layers3,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/format";
import { instruments, mockAssessment, newsBySymbol } from "@/lib/mock-data";
import type { Assessment, InstrumentDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const initialInstrument = instruments[0];

export function StockDashboard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InstrumentDetail[]>(instruments.slice(0, 6));
  const [selected, setSelected] = useState<InstrumentDetail>(initialInstrument);
  const [compareSymbols, setCompareSymbols] = useState(["VOO", "VTI", "QQQM"]);
  const [assessment, setAssessment] = useState<Assessment>(() => mockAssessment(initialInstrument.symbol));
  const [isSearching, setIsSearching] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);

  const compareFunds = useMemo(
    () => instruments.filter((instrument) => compareSymbols.includes(instrument.symbol)),
    [compareSymbols]
  );

  async function handleSearch() {
    setIsSearching(true);

    try {
      const response = await fetch(`/api/instruments/search?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { results: InstrumentDetail[] };
      setResults(payload.results);

      if (payload.results[0]) {
        setSelected(payload.results[0]);
      }
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSelect(instrument: InstrumentDetail) {
    setSelected(instrument);
    setAssessment({
      ...mockAssessment(instrument.symbol),
      citations: newsBySymbol[instrument.symbol] ?? newsBySymbol.VOO
    });
  }

  async function handleAssess() {
    setIsAssessing(true);

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ symbol: selected.symbol })
      });
      const payload = (await response.json()) as { assessment: Assessment };
      setAssessment(payload.assessment);
    } finally {
      setIsAssessing(false);
    }
  }

  function toggleCompare(symbol: string) {
    setCompareSymbols((current) => {
      if (current.includes(symbol)) {
        return current.filter((item) => item !== symbol);
      }

      return [...current.slice(-3), symbol];
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
                    Prospect, compare, and stress-test index funds with cited market context.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-[390px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleSearch();
                      }
                    }}
                    placeholder="Search VOO, QQQM, VXUS, SCHD..."
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching}>
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

          <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_390px]">
            <Card className="noise-panel focus-rail">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Prospect Queue</CardTitle>
                    <CardDescription>Index funds first, single stocks when useful.</CardDescription>
                  </div>
                  <Badge variant="magenta">{results.length} live</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {results.map((instrument) => (
                  <button
                    type="button"
                    key={instrument.symbol}
                    onClick={() => void handleSelect(instrument)}
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
                ))}
              </CardContent>
            </Card>

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
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant={compareSymbols.includes(selected.symbol) ? "secondary" : "outline"}
                        onClick={() => toggleCompare(selected.symbol)}
                      >
                        <Layers3 />
                        Compare
                      </Button>
                      <Button onClick={handleAssess} disabled={isAssessing}>
                        {isAssessing ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                        Assess
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                    <div className="rounded-lg border border-white/10 bg-background/45 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Last price</p>
                          <p className="text-4xl font-semibold tracking-normal">{formatCurrency(selected.price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ChangePill value={selected.changePercent} large />
                          <Badge variant="warning">Mock feed</Badge>
                        </div>
                      </div>
                      <MiniChart points={selected.history.map((point) => point.close)} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <Metric label="Expense" value={selected.expenseRatio ? formatPercent(selected.expenseRatio) : "n/a"} />
                      <Metric label="Yield" value={selected.dividendYield ? formatPercent(selected.dividendYield) : "n/a"} />
                      <Metric label="AUM" value={selected.aum ? formatCompactCurrency(selected.aum) : "n/a"} />
                      <Metric label="Volatility" value={formatPercent(selected.volatility)} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="focus-rail">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>ETF Comparison Matrix</CardTitle>
                      <CardDescription>Cost, exposure, ballast, and concentration in one scan.</CardDescription>
                    </div>
                    <Badge variant="secondary">{compareFunds.length} selected</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                      <thead className="text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Fund</th>
                          <th className="px-3 py-2 font-medium">Focus</th>
                          <th className="px-3 py-2 font-medium">Expense</th>
                          <th className="px-3 py-2 font-medium">Yield</th>
                          <th className="px-3 py-2 font-medium">AUM</th>
                          <th className="px-3 py-2 font-medium">Max DD</th>
                          <th className="px-3 py-2 font-medium">Top Exposure</th>
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
                            <td className="rounded-r-md px-3 py-3">
                              <AllocationBar label={fund.sectors[0]?.label ?? "n/a"} value={fund.sectors[0]?.weight ?? 0} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <Card className="focus-rail border-primary/25">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Directional Thesis</CardTitle>
                      <CardDescription>Cited, cautious, and time-boxed.</CardDescription>
                    </div>
                    <DirectionBadge direction={assessment.direction} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
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
                      <CardTitle>Recent Signal Feed</CardTitle>
                      <CardDescription>News/search context for the assessment.</CardDescription>
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
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <ExposurePanel title="Sector Exposure" icon={<Zap />} exposures={selected.sectors} />
            <ExposurePanel title="Region Exposure" icon={<ShieldCheck />} exposures={selected.regions} />
            <Card className="focus-rail">
              <CardHeader>
                <CardTitle>Top Holdings</CardTitle>
                <CardDescription>Concentration check for the selected instrument.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selected.holdings.length ? (
                  selected.holdings.map((holding) => (
                    <AllocationBar
                      key={holding.symbol}
                      label={`${holding.symbol} · ${holding.name}`}
                      value={holding.weight}
                    />
                  ))
                ) : (
                  <p className="rounded-md border border-border bg-secondary/35 p-3 text-sm text-muted-foreground">
                    Single-stock view. ETF holding analysis appears when a fund is selected.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </TooltipProvider>
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

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
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

function MiniChart({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1);
  const coords = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - ((point - min) / range) * 86 - 7;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-5 h-[230px] rounded-md border border-white/10 bg-[#080b0b] p-3">
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="chart-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#52eec5" />
            <stop offset="55%" stopColor="#f5c451" />
            <stop offset="100%" stopColor="#e365ff" />
          </linearGradient>
        </defs>
        <polyline
          points={coords}
          fill="none"
          stroke="url(#chart-line)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
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
  icon: React.ReactNode;
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
