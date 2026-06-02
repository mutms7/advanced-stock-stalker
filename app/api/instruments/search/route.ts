import { NextResponse } from "next/server";
import { isMarketDataError, parseInstrumentSearchQuery, searchInstruments } from "@/lib/providers/market-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = parseInstrumentSearchQuery(searchParams.get("q") ?? "");
    const results = await searchInstruments(query);

    return NextResponse.json({ results });
  } catch (error) {
    if (isMarketDataError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("[market-data] Instrument search failed.", error);

    return NextResponse.json({ error: "Unable to search instruments." }, { status: 500 });
  }
}
