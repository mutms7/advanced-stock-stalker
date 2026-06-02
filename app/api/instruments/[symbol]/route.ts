import { NextResponse } from "next/server";
import { getInstrumentDetail } from "@/lib/providers/market-data";

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const instrument = await getInstrumentDetail(symbol);

  if (!instrument) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  return NextResponse.json({ instrument });
}
