import { expect, test } from "@playwright/test";

test.describe("instrument search API", () => {
  test("returns the default prospect queue when no query is provided", async ({ request }) => {
    const response = await request.get("/api/instruments/search");

    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload.results).toHaveLength(7);
    expect(payload.results.map((instrument) => instrument.symbol)).toEqual([
      "VOO",
      "VTI",
      "QQQM",
      "VXUS",
      "BND",
      "SCHD",
      "XEQT"
    ]);
  });

  test("trims and matches symbols, names, focus text, and benchmarks case-insensitively", async ({ request }) => {
    const bySymbol = await request.get("/api/instruments/search?q=%20vti%20");
    const byFocus = await request.get("/api/instruments/search?q=international");
    const byBenchmark = await request.get("/api/instruments/search?q=S%26P%20500");

    expect(bySymbol.status()).toBe(200);
    expect(byFocus.status()).toBe(200);
    expect(byBenchmark.status()).toBe(200);

    expect((await bySymbol.json()).results.map((instrument) => instrument.symbol)).toContain("VTI");
    expect((await byFocus.json()).results.map((instrument) => instrument.symbol)).toEqual(["VXUS"]);
    expect((await byBenchmark.json()).results.map((instrument) => instrument.symbol)).toContain("VOO");
  });

  test("returns an empty result set for unknown terms", async ({ request }) => {
    const response = await request.get("/api/instruments/search?q=not-a-real-fund");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
  });
});

test.describe("assessments API", () => {
  test("rejects requests without a valid symbol", async ({ request }) => {
    const response = await request.post("/api/assessments", {
      data: { symbol: "" }
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "Expected a valid symbol." });
  });

  test("returns 404 for unsupported symbols", async ({ request }) => {
    const response = await request.post("/api/assessments", {
      data: { symbol: "NOPE" }
    });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "Instrument not found." });
  });

  test("returns a cited assessment for a valid symbol", async ({ request }) => {
    const response = await request.post("/api/assessments", {
      data: { symbol: "voo" }
    });

    expect(response.status()).toBe(200);

    const { assessment } = await response.json();
    expect(assessment.symbol).toBe("VOO");
    expect(["up", "down", "sideways", "uncertain"]).toContain(assessment.direction);
    expect(assessment.confidence).toBeGreaterThanOrEqual(0);
    expect(assessment.confidence).toBeLessThanOrEqual(1);
    expect(assessment.bullCase.length).toBeGreaterThanOrEqual(2);
    expect(assessment.bearCase.length).toBeGreaterThanOrEqual(2);
    expect(assessment.keyRisks.length).toBeGreaterThanOrEqual(2);
    expect(Number.isNaN(Date.parse(assessment.generatedAt))).toBe(false);
    expect(assessment.notInvestmentAdvice).toContain("does not provide personalized");
    expect(assessment.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.any(String),
          source: expect.any(String),
          url: expect.stringMatching(/^https?:\/\//)
        })
      ])
    );
  });
});

test.describe("tracker API", () => {
  test("loads tracker persistence mode for a valid anonymous client", async ({ request }) => {
    const response = await request.get("/api/tracker", {
      headers: {
        "x-tracker-client-id": "test-client-load-001"
      }
    });

    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(["database", "local"]).toContain(payload.persistence);
    expect(typeof payload.saved).toBe("boolean");
  });

  test("accepts a tracker snapshot and returns a normalized state", async ({ request }) => {
    const response = await request.put("/api/tracker", {
      headers: {
        "x-tracker-client-id": "test-client-save-001"
      },
      data: {
        state: {
          watchlist: ["voo", "xeqt"],
          positions: [{ symbol: "voo", shares: 3, averageCostCad: 650, addedAt: "2026-06-01T12:00:00.000Z" }],
          alerts: [{ symbol: "voo", lowTargetCad: 600, highTargetCad: 760, createdAt: "2026-06-01T12:00:00.000Z" }]
        }
      }
    });

    expect([200, 202]).toContain(response.status());

    const payload = await response.json();
    expect(["database", "local"]).toContain(payload.persistence);
    expect(payload.state.watchlist).toContain("VOO");
    expect(payload.state.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "VOO",
          shares: 3,
          averageCostCad: 650
        })
      ])
    );
  });

  test("rejects missing tracker client ids", async ({ request }) => {
    const response = await request.get("/api/tracker");

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "Expected a valid tracker client id." });
  });
});
