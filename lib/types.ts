export type AssetType = "ETF" | "Stock" | "Mutual Fund" | "Index";

export type PricePoint = {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
};

export type Holding = {
  symbol: string;
  name: string;
  weight: number;
  sector: string;
};

export type Exposure = {
  label: string;
  weight: number;
};

export type Instrument = {
  symbol: string;
  name: string;
  type: AssetType;
  exchange: string;
  price: number;
  changePercent: number;
  expenseRatio?: number;
  dividendYield?: number;
  aum?: number;
  benchmark?: string;
  focus: string;
};

export type InstrumentDetail = Instrument & {
  summary: string;
  beta: number;
  volatility: number;
  maxDrawdown: number;
  trackingError?: number;
  holdings: Holding[];
  sectors: Exposure[];
  regions: Exposure[];
  history: PricePoint[];
};

export type NewsArticle = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  snippet: string;
};

export type AssessmentDirection = "up" | "down" | "sideways" | "uncertain";

export type Assessment = {
  symbol: string;
  direction: AssessmentDirection;
  confidence: number;
  timeHorizon: string;
  summary: string;
  bullCase: string[];
  bearCase: string[];
  keyRisks: string[];
  citations: NewsArticle[];
  generatedAt: string;
  notInvestmentAdvice: string;
};
