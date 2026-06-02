import { newsBySymbol } from "@/lib/mock-data";
import {
  MAX_CITATIONS,
  cleanText,
  hostnameFromUrl,
  normalizeSymbol,
  sanitizeCitations,
  sanitizeSearchTerm
} from "@/lib/providers/assessment/sanitize";
import type { NewsArticle } from "@/lib/types";

type BraveNewsResult = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  age?: unknown;
  source?: unknown;
  meta_url?: {
    hostname?: unknown;
  };
};

export async function searchRecentNews(symbol: string, name: string): Promise<NewsArticle[]> {
  const normalizedSymbol = normalizeSymbol(symbol);
  const fallback = getMockNewsFallback(normalizedSymbol);
  const provider = (process.env.NEWS_SEARCH_PROVIDER ?? "mock").trim().toLowerCase();

  if (!normalizedSymbol || provider !== "brave" || !process.env.BRAVE_SEARCH_API_KEY) {
    return fallback;
  }

  return searchBraveNews(normalizedSymbol, name, fallback);
}

async function searchBraveNews(symbol: string, name: string, fallback: NewsArticle[]): Promise<NewsArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  const query = sanitizeSearchTerm(`${symbol} ${name} stock ETF recent news`, `${symbol} market news`, 120);
  const params = new URLSearchParams({
    count: String(MAX_CITATIONS),
    freshness: "pd",
    q: query
  });
  const requestOptions = {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY ?? ""
    },
    next: {
      revalidate: 900
    },
    signal: controller.signal
  } satisfies RequestInit & { next: { revalidate: number } };

  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/news/search?${params.toString()}`, requestOptions);

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as { results?: unknown };
    const results = Array.isArray(payload.results) ? payload.results.filter(isBraveNewsResult) : [];
    const articles = results.map((result) => {
      const rawUrl = typeof result.url === "string" ? result.url : "";
      const hostname = typeof result.meta_url?.hostname === "string" ? result.meta_url.hostname : hostnameFromUrl(rawUrl);

      return {
        title: cleanText(result.title, "Untitled market update", 180),
        source: cleanText(result.source, hostname ?? "Brave News", 64),
        url: rawUrl,
        publishedAt: typeof result.age === "string" ? result.age : undefined,
        snippet: cleanText(result.description, "No summary was provided by the search provider.", 320)
      };
    });

    return sanitizeCitations(articles, { fallback, maxItems: MAX_CITATIONS });
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

function getMockNewsFallback(symbol: string): NewsArticle[] {
  const fallback = newsBySymbol[symbol] ?? newsBySymbol.VOO;
  return sanitizeCitations(fallback, { fallback: newsBySymbol.VOO, maxItems: MAX_CITATIONS });
}

function isBraveNewsResult(value: unknown): value is BraveNewsResult {
  return typeof value === "object" && value !== null;
}
