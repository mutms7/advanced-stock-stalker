import { z } from "zod";
import { mockAssessment } from "@/lib/mock-data";
import {
  MAX_CITATIONS,
  cleanText,
  normalizeSymbol,
  safeIsoDate,
  sanitizeCitations
} from "@/lib/providers/assessment/sanitize";
import type { Assessment, InstrumentDetail, NewsArticle } from "@/lib/types";

const TIME_HORIZON = "2-6 weeks";
const NOT_INVESTMENT_ADVICE =
  "For research only. This tool provides a cautious directional bias and does not provide personalized financial, tax, or investment advice.";
const OPENAI_TIMEOUT_MS = 15000;
const MAX_DIRECTIONAL_CONFIDENCE = 0.74;
const MAX_NON_DIRECTIONAL_CONFIDENCE = 0.68;

const assessmentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "symbol",
    "direction",
    "confidence",
    "timeHorizon",
    "summary",
    "bullCase",
    "bearCase",
    "keyRisks",
    "generatedAt",
    "notInvestmentAdvice"
  ],
  properties: {
    symbol: { type: "string", description: "The instrument ticker symbol." },
    direction: {
      enum: ["up", "down", "sideways", "uncertain"],
      description: "A cautious research bias only; never an investment recommendation."
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    timeHorizon: { type: "string", description: "Use the 2-6 week research window." },
    summary: {
      type: "string",
      description: "Frame up/down as a cautious directional bias, not a buy/sell/hold recommendation."
    },
    bullCase: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" }
    },
    bearCase: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" }
    },
    keyRisks: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" }
    },
    generatedAt: { type: "string" },
    notInvestmentAdvice: { type: "string" }
  }
};

type ResponsesApiPayload = {
  output_text?: unknown;
  output?: unknown;
};

const assessmentOutputSchema = z.object({
  symbol: z.string().min(1).max(24),
  direction: z.enum(["up", "down", "sideways", "uncertain"]),
  confidence: z.preprocess((value) => {
    if (typeof value === "string") {
      return Number(value);
    }

    return value;
  }, z.number().finite().min(0).max(1)),
  timeHorizon: z.string().min(1).max(80),
  summary: z.string().min(1).max(1200),
  bullCase: z.array(z.string()).min(2).max(4),
  bearCase: z.array(z.string()).min(2).max(4),
  keyRisks: z.array(z.string()).min(2).max(5),
  generatedAt: z.string().optional(),
  notInvestmentAdvice: z.string().optional()
});

type AssessmentModelOutput = z.infer<typeof assessmentOutputSchema>;

export async function createAssessment(
  instrument: InstrumentDetail,
  citations: NewsArticle[]
): Promise<Assessment> {
  const safeCitations = sanitizeCitations(citations, {
    fallback: mockAssessment(instrument.symbol).citations,
    maxItems: MAX_CITATIONS
  });

  if (!process.env.OPENAI_API_KEY) {
    return fallbackAssessment(instrument, safeCitations);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5.5",
        reasoning: { effort: "low" },
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "market_directional_assessment",
            strict: true,
            schema: assessmentSchema
          }
        },
        input: [
          {
            role: "system",
            content:
              "You assess market instruments for research dashboards. Produce a cautious, cited directional thesis. Never provide personalized financial advice. Prefer uncertainty when evidence is mixed."
          },
          {
            role: "user",
            content: JSON.stringify({
              instrument: instrumentSnapshotForPrompt(instrument),
              recentNews: safeCitations,
              outputRules: {
                includeDirectionOnlyAsDirectionalBias: true,
                directionalLabelsAreNotAdvice: true,
                avoidRecommendationLanguage: ["buy", "sell", "hold", "short", "go long", "go short"],
                citeOnlyProvidedNews: true,
                ifEvidenceIsThinPrefer: ["sideways", "uncertain"],
                maximumConfidenceForUpOrDown: MAX_DIRECTIONAL_CONFIDENCE,
                timeHorizon: TIME_HORIZON,
                notInvestmentAdvice: NOT_INVESTMENT_ADVICE
              }
            })
          }
        ],
        max_output_tokens: 1200
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return fallbackAssessment(instrument, safeCitations);
    }

    const payload = (await response.json()) as ResponsesApiPayload;
    const parsed = parseAssessmentOutput(payload);

    return finalizeAssessment(parsed, instrument, safeCitations);
  } catch {
    return fallbackAssessment(instrument, safeCitations);
  } finally {
    clearTimeout(timeout);
  }
}

function parseAssessmentOutput(payload: ResponsesApiPayload): AssessmentModelOutput {
  for (const candidate of extractOutputCandidates(payload)) {
    let parsedJson: unknown;

    try {
      parsedJson = parseJsonCandidate(candidate);
    } catch {
      continue;
    }

    const parsed = assessmentOutputSchema.safeParse(parsedJson);

    if (parsed.success) {
      return parsed.data;
    }
  }

  throw new Error("OpenAI response did not include a valid assessment.");
}

function extractOutputCandidates(payload: ResponsesApiPayload): unknown[] {
  const candidates: unknown[] = [];

  if (typeof payload.output_text === "string") {
    candidates.push(payload.output_text);
  }

  if (Array.isArray(payload.output)) {
    for (const outputItem of payload.output) {
      if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
        continue;
      }

      for (const contentItem of outputItem.content) {
        if (!isRecord(contentItem)) {
          continue;
        }

        if (typeof contentItem.text === "string") {
          candidates.push(contentItem.text);
        }

        if (isRecord(contentItem.parsed)) {
          candidates.push(contentItem.parsed);
        }

        if (isRecord(contentItem.json)) {
          candidates.push(contentItem.json);
        }
      }
    }
  }

  return candidates;
}

function parseJsonCandidate(candidate: unknown): unknown {
  if (isRecord(candidate)) {
    return candidate;
  }

  if (typeof candidate !== "string") {
    throw new Error("OpenAI output candidate was not text or JSON.");
  }

  const trimmed = candidate.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const objectStart = withoutFence.indexOf("{");
  const objectEnd = withoutFence.lastIndexOf("}");
  const attempts = [
    trimmed,
    withoutFence,
    objectStart >= 0 && objectEnd > objectStart ? withoutFence.slice(objectStart, objectEnd + 1) : ""
  ].filter(Boolean);

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Try the next representation.
    }
  }

  throw new Error("OpenAI output text was not valid JSON.");
}

function fallbackAssessment(instrument: InstrumentDetail, citations: NewsArticle[]): Assessment {
  const base = mockAssessment(instrument.symbol);
  const modelOutput: Omit<Assessment, "citations"> = {
    symbol: base.symbol,
    direction: base.direction,
    confidence: base.confidence,
    timeHorizon: base.timeHorizon,
    summary: base.summary,
    bullCase: base.bullCase,
    bearCase: base.bearCase,
    keyRisks: base.keyRisks,
    generatedAt: base.generatedAt,
    notInvestmentAdvice: base.notInvestmentAdvice
  };

  return finalizeAssessment(modelOutput, instrument, citations);
}

function finalizeAssessment(
  output: AssessmentModelOutput | Omit<Assessment, "citations">,
  instrument: InstrumentDetail,
  citations: NewsArticle[]
): Assessment {
  const normalizedSymbol = normalizeSymbol(instrument.symbol) || normalizeSymbol(output.symbol) || cleanText(output.symbol, "UNKNOWN", 12);
  const direction = chooseSafeDirection(output.direction, output.confidence, citations);
  const confidence = clampConfidence(output.confidence, direction);
  const timeHorizon = cleanText(output.timeHorizon, TIME_HORIZON, 80) || TIME_HORIZON;
  const summary = summarizeAsDirectionalBias(output.summary, direction, timeHorizon);
  const fallback = mockAssessment(normalizedSymbol);

  return {
    symbol: normalizedSymbol,
    direction,
    confidence,
    timeHorizon,
    summary,
    bullCase: sanitizeThesisList(output.bullCase, fallback.bullCase, 2, 4),
    bearCase: sanitizeThesisList(output.bearCase, fallback.bearCase, 2, 4),
    keyRisks: ensureCoreRisks(sanitizeThesisList(output.keyRisks, fallback.keyRisks, 2, 5)),
    citations,
    generatedAt: safeIsoDate(output.generatedAt),
    notInvestmentAdvice: NOT_INVESTMENT_ADVICE
  };
}

function instrumentSnapshotForPrompt(instrument: InstrumentDetail) {
  return {
    symbol: normalizeSymbol(instrument.symbol) || cleanText(instrument.symbol, "UNKNOWN", 12),
    name: cleanText(instrument.name, "Unknown instrument", 120),
    type: instrument.type,
    exchange: cleanText(instrument.exchange, "Unknown exchange", 64),
    price: finiteNumber(instrument.price),
    changePercent: finiteNumber(instrument.changePercent),
    expenseRatio: finiteNumber(instrument.expenseRatio),
    dividendYield: finiteNumber(instrument.dividendYield),
    aum: finiteNumber(instrument.aum),
    benchmark: cleanText(instrument.benchmark, "Unknown benchmark", 120),
    focus: cleanText(instrument.focus, "No stated focus", 180),
    summary: cleanText(instrument.summary, "No instrument summary provided.", 400),
    beta: finiteNumber(instrument.beta),
    volatility: finiteNumber(instrument.volatility),
    maxDrawdown: finiteNumber(instrument.maxDrawdown),
    trackingError: finiteNumber(instrument.trackingError),
    topHoldings: instrument.holdings.slice(0, 8).map((holding) => ({
      symbol: normalizeSymbol(holding.symbol) || cleanText(holding.symbol, "UNKNOWN", 12),
      name: cleanText(holding.name, "Unknown holding", 100),
      weight: finiteNumber(holding.weight),
      sector: cleanText(holding.sector, "Unknown sector", 80)
    })),
    sectors: instrument.sectors.slice(0, 8).map((sector) => ({
      label: cleanText(sector.label, "Unknown sector", 80),
      weight: finiteNumber(sector.weight)
    })),
    regions: instrument.regions.slice(0, 8).map((region) => ({
      label: cleanText(region.label, "Unknown region", 80),
      weight: finiteNumber(region.weight)
    })),
    recentHistory: instrument.history.slice(-16).map((point) => ({
      date: safeIsoDate(point.date),
      close: finiteNumber(point.close)
    }))
  };
}

function chooseSafeDirection(
  direction: Assessment["direction"],
  confidence: number,
  citations: NewsArticle[]
): Assessment["direction"] {
  if ((direction === "up" || direction === "down") && (citations.length === 0 || confidence < 0.35)) {
    return "uncertain";
  }

  return direction;
}

function clampConfidence(confidence: number, direction: Assessment["direction"]) {
  const maxConfidence = direction === "up" || direction === "down" ? MAX_DIRECTIONAL_CONFIDENCE : MAX_NON_DIRECTIONAL_CONFIDENCE;
  return Number(clamp(confidence, 0, maxConfidence).toFixed(2));
}

function summarizeAsDirectionalBias(summary: string, direction: Assessment["direction"], timeHorizon: string) {
  const cleanedSummary = sanitizeInvestorLanguage(summary, 700);
  const lowerSummary = cleanedSummary.toLowerCase();
  const biasLabel = direction === "up" ? "positive" : direction === "down" ? "negative" : direction;

  if (lowerSummary.includes("directional bias") || lowerSummary.includes("research bias")) {
    return cleanedSummary;
  }

  return cleanText(`Cautious ${biasLabel} directional bias over ${timeHorizon}: ${cleanedSummary}`, cleanedSummary, 760);
}

function sanitizeThesisList(items: string[], fallbackItems: string[], minItems: number, maxItems: number) {
  const sanitized = items
    .map((item) => sanitizeInvestorLanguage(item, 220))
    .filter((item) => item.length > 0);
  const fallback = fallbackItems.map((item) => sanitizeInvestorLanguage(item, 220));
  const merged: string[] = [];

  for (const item of [...sanitized, ...fallback]) {
    if (!merged.includes(item)) {
      merged.push(item);
    }

    if (merged.length >= maxItems) {
      break;
    }
  }

  return merged.slice(0, Math.max(minItems, Math.min(maxItems, merged.length)));
}

function ensureCoreRisks(items: string[]) {
  const directionalRisk = "This is a directional bias, not investment advice.";
  const citationRisk = "News/search coverage can be incomplete or stale; verify material developments before making decisions.";
  const filteredItems = items.filter((item) => {
    const lowerItem = item.toLowerCase();
    return !lowerItem.includes("not investment advice") && !lowerItem.includes("directional bias");
  });

  return [directionalRisk, ...filteredItems.slice(0, 3), citationRisk].slice(0, 5);
}

function sanitizeInvestorLanguage(value: string, maxLength: number) {
  return cleanText(value, "No assessment detail was provided.", maxLength)
    .replace(/\binvestors?\s+should\s+buy\b/gi, "the evidence supports a cautious positive bias")
    .replace(/\binvestors?\s+should\s+sell\b/gi, "the evidence supports a cautious negative bias")
    .replace(/\binvestors?\s+should\s+hold\b/gi, "the evidence supports a cautious neutral bias")
    .replace(/\byou\s+should\s+(buy|sell|hold|short|add|trim|exit)\b/gi, "the evidence should be treated as research context")
    .replace(/\b(buy|sell|hold)\s+recommendation\b/gi, "directional bias")
    .replace(/\bprice target\b/gi, "scenario level")
    .replace(/\bguaranteed\b/gi, "not guaranteed")
    .replace(/\brisk-free\b/gi, "lower-risk");
}

function finiteNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
