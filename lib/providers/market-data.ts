import { instruments } from "@/lib/mock-data";
import type { InstrumentDetail } from "@/lib/types";

export async function searchInstruments(query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return instruments.slice(0, 6);
  }

  return instruments
    .filter((instrument) => {
      return (
        instrument.symbol.toLowerCase().includes(normalized) ||
        instrument.name.toLowerCase().includes(normalized) ||
        instrument.focus.toLowerCase().includes(normalized) ||
        instrument.benchmark?.toLowerCase().includes(normalized)
      );
    })
    .slice(0, 8);
}

export async function getInstrumentDetail(symbol: string): Promise<InstrumentDetail | null> {
  return instruments.find((instrument) => instrument.symbol === symbol.toUpperCase()) ?? null;
}

export function getFeaturedIndexFunds() {
  return instruments.filter((instrument) => instrument.type === "ETF").slice(0, 6);
}
