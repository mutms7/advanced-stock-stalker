import { NextResponse } from "next/server";
import { normalizeStoredTrackerState } from "@/lib/tracker";
import {
  isTrackerDatabaseEnabled,
  readTrackerSnapshot,
  writeTrackerSnapshot
} from "@/lib/server/tracker-store";

export const runtime = "nodejs";

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{12,96}$/;

type TrackerRequestBody = {
  clientId?: unknown;
  state?: unknown;
};

export async function GET(request: Request) {
  const clientId = parseClientId(request);

  if (!clientId) {
    return NextResponse.json({ error: "Expected a valid tracker client id." }, { status: 400 });
  }

  if (!isTrackerDatabaseEnabled()) {
    return NextResponse.json({ state: null, persistence: "local", saved: false });
  }

  try {
    const snapshot = await readTrackerSnapshot(clientId);

    return NextResponse.json({
      state: snapshot?.state ?? null,
      persistence: "database",
      saved: Boolean(snapshot),
      updatedAt: snapshot?.updatedAt ?? null
    });
  } catch (error) {
    console.error("[tracker] Could not read tracker snapshot.", error);

    return NextResponse.json({
      state: null,
      persistence: "local",
      saved: false,
      error: "Tracker database is unavailable; using browser-local state."
    });
  }
}

export async function PUT(request: Request) {
  let body: TrackerRequestBody;

  try {
    body = (await request.json()) as TrackerRequestBody;
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }

  const clientId = parseClientId(request, body.clientId);

  if (!clientId) {
    return NextResponse.json({ error: "Expected a valid tracker client id." }, { status: 400 });
  }

  const state = normalizeStoredTrackerState(body.state);

  if (!isTrackerDatabaseEnabled()) {
    return NextResponse.json({ state, persistence: "local", saved: false }, { status: 202 });
  }

  try {
    const savedAt = await writeTrackerSnapshot(clientId, state);

    return NextResponse.json({
      state,
      persistence: "database",
      saved: true,
      updatedAt: savedAt
    });
  } catch (error) {
    console.error("[tracker] Could not write tracker snapshot.", error);

    return NextResponse.json(
      {
        state,
        persistence: "local",
        saved: false,
        error: "Tracker database is unavailable; changes remain saved in the browser."
      },
      { status: 202 }
    );
  }
}

function parseClientId(request: Request, fallback?: unknown) {
  const headerValue = request.headers.get("x-tracker-client-id");
  const candidate = typeof headerValue === "string" && headerValue.trim() ? headerValue : fallback;

  if (typeof candidate !== "string") {
    return "";
  }

  const normalized = candidate.trim();

  return CLIENT_ID_PATTERN.test(normalized) ? normalized : "";
}
