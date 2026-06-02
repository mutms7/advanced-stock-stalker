import { mockAssessment } from "@/lib/mock-data";
import type { Assessment, InstrumentDetail, NewsArticle } from "@/lib/types";

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
    symbol: { type: "string" },
    direction: { enum: ["up", "down", "sideways", "uncertain"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    timeHorizon: { type: "string" },
    summary: { type: "string" },
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
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

export async function createAssessment(
  instrument: InstrumentDetail,
  citations: NewsArticle[]
): Promise<Assessment> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ...mockAssessment(instrument.symbol),
      citations
    };
  }

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
              instrument,
              recentNews: citations,
              outputRules: {
                includeDirectionOnlyAsDirectionalBias: true,
                citeOnlyProvidedNews: true,
                timeHorizon: "2-6 weeks",
                notInvestmentAdvice:
                  "For research only. This tool does not provide personalized financial, tax, or investment advice."
              }
            })
          }
        ]
      })
    });

    if (!response.ok) {
      return {
        ...mockAssessment(instrument.symbol),
        citations
      };
    }

    const payload = (await response.json()) as ResponsesApiPayload;
    const outputText = extractOutputText(payload);
    const parsed = JSON.parse(outputText) as Omit<Assessment, "citations">;

    return {
      ...parsed,
      citations,
      generatedAt: parsed.generatedAt || new Date().toISOString()
    };
  } catch {
    return {
      ...mockAssessment(instrument.symbol),
      citations
    };
  }
}

function extractOutputText(payload: ResponsesApiPayload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  const content = payload.output?.flatMap((item) => item.content ?? []) ?? [];
  const text = content.find((item) => item.type === "output_text" || item.text)?.text;

  if (!text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return text;
}
