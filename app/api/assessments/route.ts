import { NextResponse } from "next/server";
import { z } from "zod";
import { createAssessment } from "@/lib/providers/ai-assessment";
import { getInstrumentDetail } from "@/lib/providers/market-data";
import { searchRecentNews } from "@/lib/providers/news-search";

const assessmentRequestSchema = z.object({
  symbol: z.string().min(1).max(12)
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = assessmentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Expected a valid symbol." }, { status: 400 });
  }

  const instrument = await getInstrumentDetail(parsed.data.symbol);

  if (!instrument) {
    return NextResponse.json({ error: "Instrument not found." }, { status: 404 });
  }

  const citations = await searchRecentNews(instrument.symbol, instrument.name);
  const assessment = await createAssessment(instrument, citations);

  return NextResponse.json({ assessment });
}
