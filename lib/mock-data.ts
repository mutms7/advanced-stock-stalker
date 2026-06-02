import type { Assessment, InstrumentDetail, NewsArticle } from "@/lib/types";

const history = (start: number, drift: number, wobble = 4) =>
  Array.from({ length: 32 }, (_, index) => {
    const wave = Math.sin(index / 2.8) * wobble + Math.cos(index / 5.2) * (wobble / 2);
    return {
      date: new Date(Date.UTC(2026, 4, index + 1)).toISOString(),
      close: Number((start + index * drift + wave).toFixed(2))
    };
  });

export const instruments: InstrumentDetail[] = [
  {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    type: "ETF",
    exchange: "NYSE Arca",
    price: 514.83,
    changePercent: 0.0068,
    expenseRatio: 0.0003,
    dividendYield: 0.0129,
    aum: 492_000_000_000,
    benchmark: "S&P 500",
    focus: "Low-cost U.S. large-cap index core",
    summary:
      "VOO tracks the S&P 500 with a very low expense ratio and broad exposure to profitable U.S. large-cap companies.",
    beta: 1,
    volatility: 0.151,
    maxDrawdown: -0.238,
    trackingError: 0.0011,
    holdings: [
      { symbol: "NVDA", name: "NVIDIA", weight: 0.068, sector: "Technology" },
      { symbol: "MSFT", name: "Microsoft", weight: 0.062, sector: "Technology" },
      { symbol: "AAPL", name: "Apple", weight: 0.057, sector: "Technology" },
      { symbol: "AMZN", name: "Amazon", weight: 0.037, sector: "Consumer Cyclical" },
      { symbol: "META", name: "Meta Platforms", weight: 0.028, sector: "Communication" }
    ],
    sectors: [
      { label: "Technology", weight: 0.312 },
      { label: "Financials", weight: 0.138 },
      { label: "Health Care", weight: 0.107 },
      { label: "Consumer Cyclical", weight: 0.102 },
      { label: "Industrials", weight: 0.084 }
    ],
    regions: [
      { label: "United States", weight: 0.991 },
      { label: "Other", weight: 0.009 }
    ],
    history: history(484, 1.12)
  },
  {
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    type: "ETF",
    exchange: "NYSE Arca",
    price: 286.41,
    changePercent: 0.0044,
    expenseRatio: 0.0003,
    dividendYield: 0.0133,
    aum: 433_000_000_000,
    benchmark: "CRSP US Total Market",
    focus: "Total U.S. equity market exposure",
    summary:
      "VTI gives investors the broad U.S. market, extending beyond the S&P 500 into mid- and small-cap stocks.",
    beta: 1.02,
    volatility: 0.158,
    maxDrawdown: -0.265,
    trackingError: 0.0014,
    holdings: [
      { symbol: "NVDA", name: "NVIDIA", weight: 0.058, sector: "Technology" },
      { symbol: "MSFT", name: "Microsoft", weight: 0.053, sector: "Technology" },
      { symbol: "AAPL", name: "Apple", weight: 0.048, sector: "Technology" },
      { symbol: "AMZN", name: "Amazon", weight: 0.031, sector: "Consumer Cyclical" },
      { symbol: "AVGO", name: "Broadcom", weight: 0.022, sector: "Technology" }
    ],
    sectors: [
      { label: "Technology", weight: 0.294 },
      { label: "Financials", weight: 0.142 },
      { label: "Health Care", weight: 0.104 },
      { label: "Industrials", weight: 0.093 },
      { label: "Consumer Cyclical", weight: 0.101 }
    ],
    regions: [
      { label: "United States", weight: 0.995 },
      { label: "Other", weight: 0.005 }
    ],
    history: history(268, 0.64, 3)
  },
  {
    symbol: "QQQM",
    name: "Invesco NASDAQ 100 ETF",
    type: "ETF",
    exchange: "NASDAQ",
    price: 213.95,
    changePercent: 0.0117,
    expenseRatio: 0.0015,
    dividendYield: 0.0064,
    aum: 42_000_000_000,
    benchmark: "NASDAQ-100",
    focus: "Growth-heavy large-cap technology index",
    summary:
      "QQQM provides NASDAQ-100 exposure with a lower fee than QQQ, making it a strong long-horizon growth-index candidate.",
    beta: 1.18,
    volatility: 0.208,
    maxDrawdown: -0.338,
    trackingError: 0.0018,
    holdings: [
      { symbol: "NVDA", name: "NVIDIA", weight: 0.084, sector: "Technology" },
      { symbol: "MSFT", name: "Microsoft", weight: 0.077, sector: "Technology" },
      { symbol: "AAPL", name: "Apple", weight: 0.071, sector: "Technology" },
      { symbol: "AVGO", name: "Broadcom", weight: 0.045, sector: "Technology" },
      { symbol: "COST", name: "Costco", weight: 0.028, sector: "Consumer Defensive" }
    ],
    sectors: [
      { label: "Technology", weight: 0.512 },
      { label: "Communication", weight: 0.153 },
      { label: "Consumer Cyclical", weight: 0.136 },
      { label: "Health Care", weight: 0.062 },
      { label: "Consumer Defensive", weight: 0.056 }
    ],
    regions: [
      { label: "United States", weight: 0.963 },
      { label: "International", weight: 0.037 }
    ],
    history: history(192, 0.88, 5)
  },
  {
    symbol: "VXUS",
    name: "Vanguard Total International Stock ETF",
    type: "ETF",
    exchange: "NASDAQ",
    price: 64.22,
    changePercent: -0.0029,
    expenseRatio: 0.0007,
    dividendYield: 0.0302,
    aum: 82_000_000_000,
    benchmark: "FTSE Global All Cap ex US",
    focus: "International developed and emerging equity",
    summary:
      "VXUS adds non-U.S. diversification across developed and emerging markets, reducing reliance on U.S. mega-cap leadership.",
    beta: 0.92,
    volatility: 0.146,
    maxDrawdown: -0.284,
    trackingError: 0.0021,
    holdings: [
      { symbol: "TSM", name: "Taiwan Semiconductor", weight: 0.023, sector: "Technology" },
      { symbol: "NESN", name: "Nestle", weight: 0.011, sector: "Consumer Defensive" },
      { symbol: "ASML", name: "ASML", weight: 0.01, sector: "Technology" },
      { symbol: "NOVN", name: "Novartis", weight: 0.009, sector: "Health Care" },
      { symbol: "SAP", name: "SAP", weight: 0.008, sector: "Technology" }
    ],
    sectors: [
      { label: "Financials", weight: 0.213 },
      { label: "Industrials", weight: 0.141 },
      { label: "Technology", weight: 0.127 },
      { label: "Consumer Cyclical", weight: 0.109 },
      { label: "Health Care", weight: 0.09 }
    ],
    regions: [
      { label: "Europe", weight: 0.399 },
      { label: "Pacific", weight: 0.276 },
      { label: "Emerging Markets", weight: 0.247 },
      { label: "Canada", weight: 0.078 }
    ],
    history: history(61, 0.08, 1.1)
  },
  {
    symbol: "BND",
    name: "Vanguard Total Bond Market ETF",
    type: "ETF",
    exchange: "NASDAQ",
    price: 73.11,
    changePercent: 0.0012,
    expenseRatio: 0.0003,
    dividendYield: 0.0367,
    aum: 119_000_000_000,
    benchmark: "Bloomberg U.S. Aggregate Float Adjusted",
    focus: "Core U.S. investment-grade bond ballast",
    summary:
      "BND is a broad, low-cost U.S. aggregate bond fund built to dampen equity volatility and provide income.",
    beta: 0.08,
    volatility: 0.054,
    maxDrawdown: -0.177,
    trackingError: 0.0019,
    holdings: [
      { symbol: "UST", name: "U.S. Treasuries", weight: 0.468, sector: "Government" },
      { symbol: "MBS", name: "Mortgage-backed securities", weight: 0.204, sector: "Securitized" },
      { symbol: "IGC", name: "Investment-grade corporates", weight: 0.247, sector: "Corporate" },
      { symbol: "AGY", name: "Agency debt", weight: 0.029, sector: "Government" },
      { symbol: "CMBS", name: "Commercial MBS", weight: 0.021, sector: "Securitized" }
    ],
    sectors: [
      { label: "Treasury", weight: 0.468 },
      { label: "Corporate", weight: 0.247 },
      { label: "Mortgage", weight: 0.204 },
      { label: "Agency", weight: 0.029 },
      { label: "Other", weight: 0.052 }
    ],
    regions: [
      { label: "United States", weight: 0.91 },
      { label: "International USD", weight: 0.09 }
    ],
    history: history(72, 0.025, 0.55)
  },
  {
    symbol: "SCHD",
    name: "Schwab U.S. Dividend Equity ETF",
    type: "ETF",
    exchange: "NYSE Arca",
    price: 82.48,
    changePercent: -0.0016,
    expenseRatio: 0.0006,
    dividendYield: 0.0346,
    aum: 66_000_000_000,
    benchmark: "Dow Jones U.S. Dividend 100",
    focus: "Quality dividend U.S. equity factor tilt",
    summary:
      "SCHD tilts toward profitable dividend growers and tends to trade some mega-cap growth exposure for income and quality factors.",
    beta: 0.88,
    volatility: 0.139,
    maxDrawdown: -0.221,
    trackingError: 0.026,
    holdings: [
      { symbol: "TXN", name: "Texas Instruments", weight: 0.046, sector: "Technology" },
      { symbol: "PEP", name: "PepsiCo", weight: 0.043, sector: "Consumer Defensive" },
      { symbol: "HD", name: "Home Depot", weight: 0.041, sector: "Consumer Cyclical" },
      { symbol: "CSCO", name: "Cisco", weight: 0.039, sector: "Technology" },
      { symbol: "ABBV", name: "AbbVie", weight: 0.038, sector: "Health Care" }
    ],
    sectors: [
      { label: "Financials", weight: 0.185 },
      { label: "Health Care", weight: 0.161 },
      { label: "Consumer Defensive", weight: 0.148 },
      { label: "Technology", weight: 0.142 },
      { label: "Industrials", weight: 0.121 }
    ],
    regions: [
      { label: "United States", weight: 1 }
    ],
    history: history(80, 0.06, 1.2)
  },
  {
    symbol: "XEQT",
    name: "iShares Core Equity ETF Portfolio",
    type: "ETF",
    exchange: "Toronto Stock Exchange",
    price: 38.64,
    changePercent: 0.0039,
    expenseRatio: 0.002,
    dividendYield: 0.0208,
    aum: 8_900_000_000,
    benchmark: "Global all-equity ETF portfolio",
    focus: "All-in-one globally diversified equity ETF for Canadian investors",
    summary:
      "XEQT is an iShares all-equity ETF portfolio that holds underlying equity ETFs for U.S., Canadian, international developed, and emerging-market exposure.",
    beta: 1.02,
    volatility: 0.164,
    maxDrawdown: -0.287,
    trackingError: 0.0048,
    holdings: [
      { symbol: "ITOT", name: "iShares Core S&P Total U.S. Stock Market ETF", weight: 0.439, sector: "U.S. Equity" },
      { symbol: "XIC", name: "iShares Core S&P/TSX Capped Composite Index ETF", weight: 0.253, sector: "Canadian Equity" },
      { symbol: "XEF", name: "iShares Core MSCI EAFE IMI Index ETF", weight: 0.247, sector: "Developed International" },
      { symbol: "IEMG", name: "iShares Core MSCI Emerging Markets ETF", weight: 0.053, sector: "Emerging Markets" },
      { symbol: "CASH", name: "Cash and other net assets", weight: 0.008, sector: "Cash" }
    ],
    sectors: [
      { label: "U.S. Equity", weight: 0.439 },
      { label: "Canadian Equity", weight: 0.253 },
      { label: "Developed International", weight: 0.247 },
      { label: "Emerging Markets", weight: 0.053 },
      { label: "Cash", weight: 0.008 }
    ],
    regions: [
      { label: "United States", weight: 0.439 },
      { label: "Canada", weight: 0.253 },
      { label: "International Developed", weight: 0.247 },
      { label: "Emerging Markets", weight: 0.053 },
      { label: "Cash", weight: 0.008 }
    ],
    history: history(35.2, 0.095, 0.75)
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    type: "Stock",
    exchange: "NASDAQ",
    price: 184.37,
    changePercent: 0.021,
    dividendYield: 0.0003,
    aum: undefined,
    benchmark: "NASDAQ-100",
    focus: "AI accelerator and data-center semiconductor leader",
    summary:
      "NVIDIA remains a high-momentum AI infrastructure stock with exceptional growth, but valuation sensitivity is high.",
    beta: 1.72,
    volatility: 0.417,
    maxDrawdown: -0.55,
    holdings: [],
    sectors: [{ label: "Technology", weight: 1 }],
    regions: [{ label: "United States", weight: 1 }],
    history: history(164, 0.78, 6)
  }
];

export const newsBySymbol: Record<string, NewsArticle[]> = {
  VOO: [
    {
      title: "S&P 500 funds see steady inflows as investors favor low-cost core exposure",
      source: "Market Desk",
      url: "https://example.com/sp500-fund-flows",
      publishedAt: new Date(Date.UTC(2026, 5, 1, 14)).toISOString(),
      snippet:
        "Low-fee S&P 500 ETFs continued to attract retirement and model-portfolio allocations as broad-market momentum held."
    },
    {
      title: "Mega-cap concentration remains the key debate for U.S. index investors",
      source: "Fund Wire",
      url: "https://example.com/mega-cap-concentration",
      publishedAt: new Date(Date.UTC(2026, 4, 31, 16)).toISOString(),
      snippet:
        "Analysts noted that market-cap weighted funds are increasingly tied to a small cohort of technology leaders."
    }
  ],
  VTI: [
    {
      title: "Total-market ETFs gain attention as investors look beyond the largest stocks",
      source: "ETF Brief",
      url: "https://example.com/total-market-etfs",
      publishedAt: new Date(Date.UTC(2026, 5, 1, 12)).toISOString(),
      snippet:
        "Advisors highlighted total-market exposure as a way to keep small- and mid-cap optionality inside a simple core allocation."
    }
  ],
  QQQM: [
    {
      title: "NASDAQ-100 trackers rally as AI infrastructure demand remains firm",
      source: "Growth Tape",
      url: "https://example.com/nasdaq-ai-demand",
      publishedAt: new Date(Date.UTC(2026, 5, 1, 13)).toISOString(),
      snippet:
        "Growth-heavy index funds were supported by continued optimism around cloud capex and semiconductor demand."
    }
  ],
  VXUS: [
    {
      title: "International equity ETFs draw tactical interest on currency and valuation setup",
      source: "Global Allocation",
      url: "https://example.com/international-etf-valuations",
      publishedAt: new Date(Date.UTC(2026, 4, 30, 15)).toISOString(),
      snippet:
        "Strategists pointed to valuation discounts outside the U.S., while noting that currency moves remain a swing factor."
    }
  ],
  BND: [
    {
      title: "Core bond ETFs stabilize as rate-volatility expectations ease",
      source: "Fixed Income Today",
      url: "https://example.com/core-bond-stability",
      publishedAt: new Date(Date.UTC(2026, 4, 31, 11)).toISOString(),
      snippet:
        "Aggregate bond funds held steady as investors watched inflation data and central-bank guidance."
    }
  ],
  SCHD: [
    {
      title: "Dividend ETFs regain focus as investors screen for quality and income",
      source: "Income Lens",
      url: "https://example.com/dividend-quality-etfs",
      publishedAt: new Date(Date.UTC(2026, 5, 1, 10)).toISOString(),
      snippet:
        "Dividend quality strategies saw renewed attention amid debate over broad-market valuations."
    }
  ],
  XEQT: [
    {
      title: "All-in-one equity ETF portfolios remain popular with Canadian long-term investors",
      source: "ETF Allocation Desk",
      url: "https://example.com/canadian-all-equity-etfs",
      publishedAt: new Date(Date.UTC(2026, 5, 1, 9)).toISOString(),
      snippet:
        "Canadian investors continued to use globally diversified all-equity ETF portfolios as simple core holdings for long horizons."
    },
    {
      title: "Global equity allocation funds balance U.S. leadership with Canadian home bias",
      source: "Portfolio Monitor",
      url: "https://example.com/global-equity-home-bias",
      publishedAt: new Date(Date.UTC(2026, 4, 31, 13)).toISOString(),
      snippet:
        "Strategists noted that all-equity allocation ETFs can reduce maintenance burden while keeping investors exposed to regional valuation shifts."
    }
  ],
  NVDA: [
    {
      title: "AI chip demand keeps semiconductor growth expectations elevated",
      source: "Tech Tape",
      url: "https://example.com/ai-chip-demand",
      publishedAt: new Date(Date.UTC(2026, 5, 1, 17)).toISOString(),
      snippet:
        "Data-center spending remained the central driver for AI semiconductor estimates, with valuation risk still prominent."
    }
  ]
};

export function mockAssessment(symbol: string): Assessment {
  const detail = instruments.find((instrument) => instrument.symbol === symbol) ?? instruments[0];
  const news = newsBySymbol[detail.symbol] ?? newsBySymbol.VOO;
  const riskIsHigh = detail.volatility > 0.2 || detail.changePercent > 0.012;

  return {
    symbol: detail.symbol,
    direction: riskIsHigh ? "sideways" : detail.changePercent >= 0 ? "up" : "uncertain",
    confidence: riskIsHigh ? 0.54 : 0.63,
    timeHorizon: "2-6 weeks",
    summary:
      detail.type === "ETF"
        ? `${detail.symbol} screens as a patient core-allocation candidate. Recent momentum is constructive, but the thesis depends on benchmark breadth and valuation discipline.`
        : `${detail.symbol} has positive momentum but carries single-company valuation and earnings-execution risk.`,
    bullCase: [
      "Recent price action and fund-flow tone are supportive.",
      "Low costs and benchmark clarity help long-horizon index-fund investors stay allocated.",
      "Underlying holdings still show resilient earnings expectations."
    ],
    bearCase: [
      "Concentration risk can make a diversified-looking fund behave like a narrower factor bet.",
      "Higher yields or weaker earnings revisions could pressure risk assets.",
      "Short-term news can reverse quickly around macro data and guidance."
    ],
    keyRisks: [
      "This is a directional thesis, not investment advice.",
      "News samples can miss private, paywalled, or very recent market-moving information.",
      "ETF holdings, AUM, and yield data should be refreshed from a licensed provider before production use."
    ],
    citations: news,
    generatedAt: new Date().toISOString(),
    notInvestmentAdvice:
      "For research only. This tool does not provide personalized financial, tax, or investment advice."
  };
}
