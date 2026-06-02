import { NextResponse } from "next/server";
import { z } from "zod";
import { createAssessment } from "@/lib/providers/ai-assessment";
import { normalizeSymbol } from "@/lib/providers/assessment/sanitize";
import { getInstrumentDetail } from "@/lib/providers/market-data";
import { searchRecentNews } from "@/lib/providers/news-search";

const assessmentRequestSchema = z.object({
  symbol: z
    .string()
    .transform((value) => normalizeSymbol(value))
    .refine((value) => value.length > 0, "Expected a valid symbol.")
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const parsed = assessmentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Expected a valid symbol." }, { status: 400 });
  }

  const instrument = await getInstrumentDetail(parsed.data.symbol);

  if (!instrument) {
    return NextResponse.json({ error: "Instrument not found." }, { status: 404 });
  }

  try {
    const citations = await searchRecentNews(instrument.symbol, instrument.name);
    const assessment = await createAssessment(instrument, citations);

    return NextResponse.json({ assessment });
  } catch {
    return NextResponse.json({ error: "Unable to create assessment." }, { status: 502 });
  }
}
