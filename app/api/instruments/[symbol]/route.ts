import { NextResponse } from "next/server";
import { getInstrumentDetail, isMarketDataError, parseInstrumentSymbol } from "@/lib/providers/market-data";

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await params;
    const normalizedSymbol = parseInstrumentSymbol(symbol);
    const { searchParams } = new URL(_request.url);
    const instrument = await getInstrumentDetail(normalizedSymbol, {
      bypassCache: searchParams.get("refresh") === "1"
    });

    if (!instrument) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
    }

    return NextResponse.json({ instrument });
  } catch (error) {
    if (isMarketDataError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("[market-data] Instrument detail failed.", error);

    return NextResponse.json({ error: "Unable to load instrument." }, { status: 500 });
  }
}
