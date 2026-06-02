import type { NewsArticle } from "@/lib/types";

export const MAX_CITATIONS = 6;

const SAFE_SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;
const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"'
};

export function normalizeSymbol(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toUpperCase();
  return SAFE_SYMBOL_PATTERN.test(normalized) ? normalized : "";
}

export function sanitizeSearchTerm(value: unknown, fallback: string, maxLength = 80): string {
  return cleanText(value, fallback, maxLength)
    .replace(/[^A-Za-z0-9 .&'()/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanText(value: unknown, fallback: string, maxLength = 240): string {
  const raw = typeof value === "string" ? value : "";
  const stripped = decodeHtmlEntities(raw)
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const text = stripped || fallback;

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function hostnameFromUrl(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

export function safeIsoDate(value: unknown, now = new Date()): string {
  if (typeof value === "string") {
    const absolute = Date.parse(value);

    if (Number.isFinite(absolute)) {
      return new Date(absolute).toISOString();
    }

    const relative = parseRelativeDate(value, now);

    if (relative) {
      return relative.toISOString();
    }
  }

  return now.toISOString();
}

export function sanitizeCitation(article: Partial<NewsArticle>, now = new Date()): NewsArticle | null {
  const url = normalizeHttpUrl(article.url);

  if (!url) {
    return null;
  }

  const source = cleanText(article.source, hostnameFromUrl(url) ?? "Market News", 64);

  return {
    title: cleanText(article.title, "Untitled market update", 180),
    source,
    url,
    publishedAt: safeIsoDate(article.publishedAt, now),
    snippet: cleanText(article.snippet, "No summary was provided by the search provider.", 320)
  };
}

export function sanitizeCitations(
  articles: Array<Partial<NewsArticle>>,
  options: { fallback?: Array<Partial<NewsArticle>>; maxItems?: number; now?: Date } = {}
): NewsArticle[] {
  const maxItems = options.maxItems ?? MAX_CITATIONS;
  const now = options.now ?? new Date();
  const seen = new Set<string>();
  const sanitized: NewsArticle[] = [];

  for (const article of articles) {
    const citation = sanitizeCitation(article, now);

    if (!citation) {
      continue;
    }

    const key = `${citation.url.toLowerCase()}|${citation.title.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    sanitized.push(citation);

    if (sanitized.length >= maxItems) {
      break;
    }
  }

  if (sanitized.length === 0 && options.fallback) {
    return sanitizeCitations(options.fallback, { maxItems, now });
  }

  return sanitized;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const lowerEntity = entity.toLowerCase();

    if (lowerEntity.startsWith("#x")) {
      const codePoint = Number.parseInt(lowerEntity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (lowerEntity.startsWith("#")) {
      const codePoint = Number.parseInt(lowerEntity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return ENTITY_MAP[lowerEntity] ?? match;
  });
}

function parseRelativeDate(value: string, now: Date): Date | null {
  const lowerValue = value.trim().toLowerCase();

  if (lowerValue === "yesterday") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const match = lowerValue.match(/^(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago$/);

  if (!match) {
    return null;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000
  };

  return new Date(now.getTime() - amount * multipliers[unit]);
}
