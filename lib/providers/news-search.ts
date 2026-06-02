import { newsBySymbol } from "@/lib/mock-data";
import type { NewsArticle } from "@/lib/types";

type BraveNewsResult = {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  source?: string;
  meta_url?: {
    hostname?: string;
  };
};

export async function searchRecentNews(symbol: string, name: string): Promise<NewsArticle[]> {
  const provider = process.env.NEWS_SEARCH_PROVIDER ?? "mock";

  if (provider === "brave" && process.env.BRAVE_SEARCH_API_KEY) {
    return searchBraveNews(symbol, name);
  }

  return newsBySymbol[symbol] ?? newsBySymbol.VOO;
}

async function searchBraveNews(symbol: string, name: string): Promise<NewsArticle[]> {
  const query = encodeURIComponent(`${symbol} ${name} ETF stock recent news`);
  const response = await fetch(`https://api.search.brave.com/res/v1/news/search?q=${query}&count=6&freshness=pd`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY ?? ""
    },
    next: {
      revalidate: 900
    }
  });

  if (!response.ok) {
    return newsBySymbol[symbol] ?? newsBySymbol.VOO;
  }

  const payload = (await response.json()) as { results?: BraveNewsResult[] };

  return (payload.results ?? []).slice(0, 6).map((result) => ({
    title: result.title ?? "Untitled market update",
    source: result.source ?? result.meta_url?.hostname ?? "Brave News",
    url: result.url ?? "https://search.brave.com/",
    publishedAt: result.age ?? new Date().toISOString(),
    snippet: result.description ?? "No summary was provided by the search provider."
  }));
}
