import { NextResponse } from "next/server";
import { searchInstruments } from "@/lib/providers/market-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const results = await searchInstruments(query);

  return NextResponse.json({ results });
}
